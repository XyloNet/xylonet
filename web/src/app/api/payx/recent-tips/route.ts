import { NextResponse, after } from 'next/server';
import { dispatchFromChain } from '@/lib/push/dispatch';
import { formatUnits, getAbiItem, type Log } from 'viem';
import { PayXTippingABI } from '@/config/abis/PayXTipping';
import { PAYX_ASSETS, PAYX_ASSET_KEYS, type PayXAsset, type PayXAssetKey } from '@/config/constants';
import { getPayXPublicClient, isRpcConfigured } from '@/lib/payx/client';
import { createPublicClient, http } from 'viem';
import { arcMainnet } from '@/config/wagmi';

/**
 * Optional dedicated RPC for log queries (PAYX_LOGS_RPC_URL): a provider that
 * allows wide eth_getLogs ranges (QuickNode, Circle public RPC) makes the feed a
 * single call. Falls back to the main server client otherwise.
 */
function getLogsClient() {
  const url = process.env.PAYX_LOGS_RPC_URL;
  if (url && url.startsWith('http')) {
    return createPublicClient({ chain: arcMainnet, transport: http(url, { timeout: 20_000 }) });
  }
  return getPayXPublicClient();
}
import { getServerPayXAddressFor } from '@/lib/payx/env';
import { shortenAddress, timeAgo } from '@/lib/payx/format';

/**
 * Every live PayX instance (one per tipping asset) with its server-resolved
 * address. Assets whose contract is not configured are skipped.
 */
function liveInstances(): Array<{ asset: PayXAsset; address: `0x${string}` }> {
  const out: Array<{ asset: PayXAsset; address: `0x${string}` }> = [];
  for (const key of PAYX_ASSET_KEYS) {
    const address = getServerPayXAddressFor(key);
    if (address) out.push({ asset: PAYX_ASSETS[key], address });
  }
  return out;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Cold instances may need many small eth_getLogs windows; allow up to 30s.
export const maxDuration = 15;

const NO_STORE = { 'cache-control': 'no-store' };

// Arc produces ~0.5s blocks; 400k blocks ≈ the last ~2.3 days. With a provider that
// allows 10k-block windows this is ≤ 40 calls, and the scan stops as soon as
// MAX_TIPS are found.
const MAX_LOOKBACK_BLOCKS = 400_000n;
const WIDE_WINDOW = 10_000n;
// Preferred eth_getLogs window. Some providers cap this hard (Alchemy free tier:
// 10 blocks). We detect the cap from the error and adapt.
const PREFERRED_WINDOW = WIDE_WINDOW;
const MIN_WINDOW = 10n;
// When only tiny windows are allowed, don't hammer the provider: scan at most
// this many blocks per request and rely on the accumulating cache below.
const MAX_BLOCKS_PER_REQUEST_SMALL_WINDOW = 300n;
// Small windows are fetched in parallel batches to keep latency down.
const PARALLEL_WINDOWS = 3;
const MAX_TIPS = 20;
const CACHE_TTL_MS = 10_000;

const TIP_SENT_EVENT = getAbiItem({ abi: PayXTippingABI, name: 'TipSent' });

export interface RecentTip {
  id: string;
  /** Which PayX instance (tipping asset) emitted the event. */
  asset: PayXAssetKey;
  symbol: string;
  decimals: number;
  contract: string;
  handle: string;
  to: string;
  tipper: string;
  from: string;
  amount: string;
  amountRaw: string;
  fee: string;
  message: string;
  txHash: string;
  blockNumber: string;
  timestamp: number;
  timeAgo: string;
}

type Body = {
  tips: RecentTip[];
  fromBlock: string;
  toBlock: string;
  deployed: boolean;
  /** true when the provider only allowed a shallow scan (feed shows what it has seen) */
  partial?: boolean;
};

// Per-instance state: last served body, the window size the provider accepts,
// and an accumulating set of tips so a warm instance keeps everything it has
// seen even when only shallow scans are possible.
// Kept in a Map (not module-level lets) so Vercel's file tracer never tries to
// statically evaluate BigInt arithmetic against an initial null.
const state = new Map<string, unknown>();
const getCache = () => state.get('cache') as { body: Body; expires: number } | undefined;
const getWindow = () => (state.get('window') as bigint | undefined) ?? PREFERRED_WINDOW;
const getSeen = () => {
  let m = state.get('seen') as Map<string, RecentTip> | undefined;
  if (!m) { m = new Map(); state.set('seen', m); }
  return m;
};
const getScannedUpTo = () => state.get('scannedUpTo') as bigint | undefined;
// Oldest block already covered by a shallow scan; blocks below it (down to the
// floor) still need backfilling on later requests.
const getBackfillCursor = () => state.get('backfillCursor') as bigint | undefined;

function isRangeCapError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /block range|range too large|up to \d+ block|exceeds|too many blocks|limited to/.test(msg);
}

type TipLog = Log<bigint, number, false, typeof TIP_SENT_EVENT, true>;

function toTip(log: TipLog, byAddress: Map<string, PayXAsset>): RecentTip | null {
  const { handle, tipper, amount, fee, message, timestamp } = log.args;
  if (!handle || !tipper || amount === undefined || timestamp === undefined) return null;
  const asset = byAddress.get((log.address ?? '').toLowerCase());
  if (!asset) return null;
  const decimals = asset.token.decimals;
  const ts = Number(timestamp);
  return {
    id: `${log.transactionHash}-${log.logIndex ?? 0}`,
    asset: asset.key,
    symbol: asset.token.symbol,
    decimals,
    contract: log.address,
    handle,
    to: `@${handle}`,
    tipper,
    from: shortenAddress(tipper),
    amount: formatUnits(amount, decimals),
    amountRaw: amount.toString(),
    fee: formatUnits(fee ?? 0n, decimals),
    message: message ?? '',
    txHash: log.transactionHash ?? '',
    blockNumber: (log.blockNumber ?? 0n).toString(),
    timestamp: ts,
    timeAgo: timeAgo(ts),
  };
}

function newestFirst(a: RecentTip, b: RecentTip): number {
  const ab = BigInt(a.blockNumber);
  const bb = BigInt(b.blockNumber);
  if (ab !== bb) return ab > bb ? -1 : 1;
  return a.id > b.id ? -1 : 1;
}

/**
 * GET /api/payx/recent-tips
 * Last 20 TipSent events across EVERY live PayX instance (one per asset)
 * from at most the trailing lookback window (or since the oldest deployment
 * block if that is more recent). One eth_getLogs pass covers all instances
 * (viem accepts an address array); each tip is tagged with its asset. Pure
 * onchain reads, no database. Adapts to provider range caps and never fails
 * the page.
 */
export async function GET() {
  const instances = liveInstances();
  if (instances.length === 0 || !isRpcConfigured()) {
    return NextResponse.json({ tips: [], deployed: false }, { headers: NO_STORE });
  }
  const byAddress = new Map(instances.map((i) => [i.address.toLowerCase(), i.asset]));
  const contractAddresses = instances.map((i) => i.address);

  const cached = getCache();
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.body, { headers: NO_STORE });
  }
  const seen = getSeen();

  const client = getLogsClient();
  let head: bigint;
  try {
    head = await client.getBlockNumber();
  } catch (error) {
    console.error('[payx/recent-tips] head failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { tips: [...getSeen().values()].sort(newestFirst).slice(0, MAX_TIPS), deployed: true, partial: true },
      { headers: NO_STORE }
    );
  }

  // Oldest known deployment block among the live instances (0 when any is unknown).
  const deploymentBlock = BigInt(Math.max(0, Math.min(...instances.map((i) => i.asset.deploymentBlock || 0))));
  const lookbackStart = head > MAX_LOOKBACK_BLOCKS ? head - MAX_LOOKBACK_BLOCKS : 0n;
  const floor = deploymentBlock > lookbackStart ? deploymentBlock : lookbackStart;

  // Segments to cover this request, newest first:
  //  1. new blocks since the last scan (or the whole lookback on a cold instance)
  //  2. any backfill left over from earlier shallow scans
  const scannedUpTo = getScannedUpTo();
  const segments: Array<{ from: bigint; to: bigint; kind: 'fresh' | 'backfill' }> = [];
  if (scannedUpTo === undefined) {
    segments.push({ from: floor, to: head, kind: 'fresh' });
  } else {
    if (head > scannedUpTo) segments.push({ from: scannedUpTo + 1n, to: head, kind: 'fresh' });
    const cursor = getBackfillCursor();
    if (cursor !== undefined && cursor >= floor) segments.push({ from: floor, to: cursor, kind: 'backfill' });
  }

  let partial = false;
  let blocksThisRequest = 0n;

  async function fetchWindow(from: bigint, to: bigint): Promise<TipLog[]> {
    return (await client.getLogs({ address: contractAddresses, event: TIP_SENT_EVENT, fromBlock: from, toBlock: to })) as TipLog[];
  }

  try {
    for (const seg of segments) {
      let toBlock = seg.to;
      let stopped = false;
      while (toBlock >= seg.from) {
        const w = getWindow();
        // Build up to PARALLEL_WINDOWS consecutive windows (newest first).
        const batch: Array<{ from: bigint; to: bigint }> = [];
        let cursor = toBlock;
        const perBatch = w <= MIN_WINDOW ? PARALLEL_WINDOWS : 1;
        for (let i = 0; i < perBatch && cursor >= seg.from; i++) {
          const candidate = cursor - w + 1n;
          const from = candidate > seg.from ? candidate : seg.from;
          batch.push({ from, to: cursor });
          cursor = from - 1n;
        }
        let results: TipLog[][];
        try {
          results = await Promise.all(batch.map((b) => fetchWindow(b.from, b.to)));
        } catch (e) {
          if (isRangeCapError(e) && w > MIN_WINDOW) {
            state.set('window', w / 10n >= MIN_WINDOW ? w / 10n : MIN_WINDOW);
            continue; // retry the same segment position with the smaller window
          }
          throw e;
        }
        for (const logs of results) for (const log of logs) {
          const tip = toTip(log, byAddress);
          if (tip) seen.set(tip.id, tip);
        }
        if (seen.size >= MAX_TIPS && seg.kind === 'fresh' && scannedUpTo === undefined) {
          // Cold start: enough for the feed; remember where to resume backfilling.
          state.set('backfillCursor', cursor);
          partial = true;
          stopped = true;
          break;
        }
        const covered = toBlock - cursor;
        blocksThisRequest += covered;
        toBlock = cursor;
        if (getWindow() <= MIN_WINDOW && blocksThisRequest >= MAX_BLOCKS_PER_REQUEST_SMALL_WINDOW && toBlock >= seg.from) {
          // Budget for this request spent: remember where to resume backfilling.
          state.set('backfillCursor', toBlock);
          partial = true;
          stopped = true;
          break;
        }
      }
      if (seg.kind === 'fresh') state.set('scannedUpTo', head);
      if (stopped) break;
      if (seg.kind === 'backfill' || (seg.kind === 'fresh' && scannedUpTo === undefined)) {
        // Fully covered down to the floor: nothing left to backfill.
        state.delete('backfillCursor');
      }
    }
    if (getBackfillCursor() !== undefined) partial = true;
  } catch (error) {
    console.error('[payx/recent-tips] scan failed:', error instanceof Error ? error.message : 'unknown error');
    partial = true;
  }

  // Keep the cache bounded.
  if (seen.size > 200) {
    state.set('seen', new Map([...seen.values()].sort(newestFirst).slice(0, 200).map((t) => [t.id, t])));
  }

  const tips = [...seen.values()]
    .sort(newestFirst)
    .slice(0, MAX_TIPS)
    .map((t) => ({ ...t, timeAgo: timeAgo(t.timestamp) }));

  const body: Body = {
    tips,
    fromBlock: floor.toString(),
    toBlock: head.toString(),
    deployed: true,
    ...(partial ? { partial: true } : {}),
  };
  state.set('cache', { body, expires: Date.now() + CACHE_TTL_MS });
  // Creators who opted in get a push the moment a payment lands (throttled inside).
  after(() => dispatchFromChain().catch(() => {}));
  return NextResponse.json(body, { headers: NO_STORE });
}
