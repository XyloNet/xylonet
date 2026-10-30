import 'server-only'
import { erc20Abi, formatUnits } from 'viem'
import { CONTRACTS } from '@/config/constants'
import { getPayXPublicClient, isRpcConfigured } from '@/lib/payx/client'
import { readTrust } from '@/lib/trust/status'
import { getPoints, getSyncHealth } from '@/lib/points/sync'
import { getPointsStore, storeDiagnostics } from '@/lib/points/store'
import { RULES, SEASON } from '@/lib/points/rules'
import type { PointsEvent } from '@/lib/points/types'
import { bridgeLogStoreKind, readBridgeLog, type BridgeLogEntry } from './bridgeLog'

/**
 * Everything /admin shows, computed from the points ledger (LI.FI transfers
 * for the xylonet integrator + PayX events), live contract reads and the
 * bridge-start log. Platform-wide by design; never served to the public.
 */

export type Flow = 'swap' | 'bridgeIn' | 'bridgeOut' | 'bridgeOther' | 'tipSent' | 'tipReceived'

export interface Bucket {
  count: number
  usd: number
  feeUsd: number
}
export interface RangeTotals {
  from: number
  to: number
  /** Money moved: exchanges, bridges and payments sent. Claims are the same money leaving escrow and are not added again. */
  volumeUsd: number
  transactions: number
  wallets: number
  feeUsd: number
  flows: Record<Flow, Bucket>
}
export interface DailyRow {
  day: string
  swap: number
  bridgeIn: number
  bridgeOut: number
  pay: number
  claims: number
  feeUsd: number
  tx: number
  wallets: number
  newWallets: number
  returningWallets: number
}
export interface KeyedBucket extends Bucket {
  key: string
  label: string
}
export interface AssetRow {
  symbol: string
  decimals: number
  contract: string | null
  tips: number
  grossUsd: number
  feeUsd: number
  /** Fees accrued in token units (from TipSent.fee). */
  feeAccrued: number
  claims: number
  claimedUsd: number
  /** Live contract reads (token units); null when the RPC did not answer. */
  escrow: number | null
  feesWaiting: number | null
  balance: number | null
  solvent: boolean | null
  paused: boolean | null
  /** Accrued (ledger) minus waiting (contract): what has been withdrawn to the Treasury. */
  feesWithdrawn: number | null
}
export interface HandleRow {
  handle: string
  tips: number
  grossUsd: number
  lastAt: number
  linked: boolean
}

export interface AdminAnalytics {
  generatedAt: number
  seasonStartsAt: number
  range: { from: number; to: number }
  notes: string[]
  ranges: { today: RangeTotals; d7: RangeTotals; d30: RangeTotals; all: RangeTotals; selected: RangeTotals }
  daily: DailyRow[]
  exchange: {
    swaps: Bucket
    feeByToken: Array<{ symbol: string; amount: number; usd: number }>
    byTool: KeyedBucket[]
    bySourceChain: KeyedBucket[]
  }
  bridge: {
    lifiIn: KeyedBucket[]
    lifiOut: KeyedBucket[]
    log: { since: number; store: string; cctp: Bucket & { byRoute: KeyedBucket[] }; gatewayDeposits: Bucket; gatewaySpends: Bucket; recent: BridgeLogEntry[] }
  }
  payx: { assets: AssetRow[]; topHandles: HandleRow[]; handlesLinked: number; feeBps: number | null; minTip: number | null }
  treasury: { address: string; usdc: number | null; eurc: number | null; feesWaiting: Array<{ symbol: string; amount: number }> }
  users: { total: number; active7: number; active30: number; withHandle: number; newInRange: number }
  health: {
    sync: Awaited<ReturnType<typeof getSyncHealth>>
    store: string
    storeDiagnostics: typeof storeDiagnostics
    rpc: { ok: boolean; block: number | null; ageSeconds: number | null }
    lifi: { ok: boolean; ms: number | null }
    cctp: { ok: boolean; ms: number | null }
    cron: { pointsSync: string; pushDispatch: string }
    partial: boolean
    stale: boolean
    events: number
    minEventUsd: number
  }
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 5042: 'Arc', 8453: 'Base', 42161: 'Arbitrum', 10: 'OP Mainnet', 137: 'Polygon', 43114: 'Avalanche', 59144: 'Linea', 130: 'Unichain', 480: 'World Chain', 146: 'Sonic', 1329: 'Sei', 50: 'XDC', 57073: 'Ink', 98866: 'Plume', 143: 'Monad', 2818: 'Morph', 81224: 'Codex',
}
const chainName = (id: number) => CHAIN_NAMES[id] ?? `chain ${id}`
const ARC = 5042
const r2 = (n: number) => Math.round(n * 100) / 100
const r6 = (n: number) => Math.round(n * 1e6) / 1e6
const dayOf = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10)

export function flowOf(e: PointsEvent): Flow {
  if (e.kind === 'tip_sent') return 'tipSent'
  if (e.kind === 'tip_received') return 'tipReceived'
  if (e.kind === 'swap') return 'swap'
  if (e.toChainId === ARC) return 'bridgeIn'
  if (e.chainId === ARC) return 'bridgeOut'
  return 'bridgeOther'
}

const COUNTS_AS_VOLUME: Record<Flow, boolean> = { swap: true, bridgeIn: true, bridgeOut: true, bridgeOther: true, tipSent: true, tipReceived: false }

function bucket(): Bucket {
  return { count: 0, usd: 0, feeUsd: 0 }
}
function add(b: Bucket, e: { usd: number; feeUsd?: number }) {
  b.count += 1
  b.usd += e.usd
  b.feeUsd += e.feeUsd ?? 0
}
function finish(b: Bucket): Bucket {
  return { count: b.count, usd: r2(b.usd), feeUsd: r2(b.feeUsd) }
}
function keyed(map: Map<string, Bucket & { label: string }>): KeyedBucket[] {
  return [...map.entries()].map(([key, b]) => ({ key, label: b.label, ...finish(b) })).sort((a, b) => b.usd - a.usd)
}
function bump(map: Map<string, Bucket & { label: string }>, key: string, label: string, e: { usd: number; feeUsd?: number }) {
  let b = map.get(key)
  if (!b) map.set(key, (b = { ...bucket(), label }))
  add(b, e)
}

function rangeTotals(events: PointsEvent[], from: number, to: number): RangeTotals {
  const flows = { swap: bucket(), bridgeIn: bucket(), bridgeOut: bucket(), bridgeOther: bucket(), tipSent: bucket(), tipReceived: bucket() }
  const wallets = new Set<string>()
  let volume = 0
  let tx = 0
  let fee = 0
  for (const e of events) {
    if (e.ts < from || e.ts > to) continue
    const f = flowOf(e)
    add(flows[f], e)
    wallets.add(e.wallet)
    tx += 1
    fee += e.feeUsd ?? 0
    if (COUNTS_AS_VOLUME[f]) volume += e.usd
  }
  return {
    from,
    to,
    volumeUsd: r2(volume),
    transactions: tx,
    wallets: wallets.size,
    feeUsd: r2(fee),
    flows: { swap: finish(flows.swap), bridgeIn: finish(flows.bridgeIn), bridgeOut: finish(flows.bridgeOut), bridgeOther: finish(flows.bridgeOther), tipSent: finish(flows.tipSent), tipReceived: finish(flows.tipReceived) },
  }
}

function daily(events: PointsEvent[], firstSeen: Map<string, number>, from: number, to: number): DailyRow[] {
  const rows = new Map<string, DailyRow & { _w: Set<string> }>()
  const startDay = dayOf(from)
  const endDay = dayOf(to)
  for (let t = Date.UTC(Number(startDay.slice(0, 4)), Number(startDay.slice(5, 7)) - 1, Number(startDay.slice(8, 10))); ; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10)
    rows.set(d, { day: d, swap: 0, bridgeIn: 0, bridgeOut: 0, pay: 0, claims: 0, feeUsd: 0, tx: 0, wallets: 0, newWallets: 0, returningWallets: 0, _w: new Set() })
    if (d >= endDay) break
  }
  for (const e of events) {
    if (e.ts < from || e.ts > to) continue
    const row = rows.get(dayOf(e.ts))
    if (!row) continue
    const f = flowOf(e)
    if (f === 'swap') row.swap += e.usd
    else if (f === 'bridgeIn') row.bridgeIn += e.usd
    else if (f === 'bridgeOut' || f === 'bridgeOther') row.bridgeOut += e.usd
    else if (f === 'tipSent') row.pay += e.usd
    else row.claims += e.usd
    row.feeUsd += e.feeUsd ?? 0
    row.tx += 1
    if (!row._w.has(e.wallet)) {
      row._w.add(e.wallet)
      if (dayOf(firstSeen.get(e.wallet) ?? e.ts) === row.day) row.newWallets += 1
      else row.returningWallets += 1
    }
  }
  return [...rows.values()].map(({ _w, ...r }) => ({ ...r, swap: r2(r.swap), bridgeIn: r2(r.bridgeIn), bridgeOut: r2(r.bridgeOut), pay: r2(r.pay), claims: r2(r.claims), feeUsd: r2(r.feeUsd), wallets: _w.size }))
}

async function treasuryBalances(): Promise<{ usdc: number | null; eurc: number | null }> {
  if (!isRpcConfigured()) return { usdc: null, eurc: null }
  try {
    const client = getPayXPublicClient()
    const [u, e] = await Promise.all([
      client.readContract({ address: CONTRACTS.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [CONTRACTS.TREASURY_SAFE] }),
      client.readContract({ address: CONTRACTS.EURC, abi: erc20Abi, functionName: 'balanceOf', args: [CONTRACTS.TREASURY_SAFE] }),
    ])
    return { usdc: Number(formatUnits(u, 6)), eurc: Number(formatUnits(e, 6)) }
  } catch {
    return { usdc: null, eurc: null }
  }
}

export async function buildAdminAnalytics(opts: { from?: number; to?: number } = {}): Promise<AdminAnalytics> {
  const now = Math.floor(Date.now() / 1000)
  const [{ snapshot, partial, stale }, trust, log, treasury, sync] = await Promise.all([
    getPoints(),
    readTrust().catch(() => null),
    readBridgeLog().catch(() => ({ version: 1 as const, since: Date.now(), entries: [] })),
    treasuryBalances(),
    getSyncHealth(),
  ])
  // PayX tips ingested before fee tracking carry no fee fields; the platform fee is a fixed
  // share of the gross amount (1% at launch), so it is derived here rather than rescanned.
  const feeBps = trust?.payx?.feeBps ?? 100
  const events: PointsEvent[] = snapshot.events.map((e) => {
    if (e.kind !== 'tip_sent' || e.feeUsd !== undefined) return e
    const feeUsd = (e.usd * feeBps) / 10_000
    const sym = e.fromSymbol ?? 'USDC'
    return { ...e, feeUsd, feeSymbol: sym, ...(sym === 'USDC' ? { feeAmount: feeUsd } : {}) }
  })
  const from = Math.max(SEASON.startsAt, opts.from ?? SEASON.startsAt)
  const to = Math.min(now, opts.to ?? now)

  // First time each wallet appears, over the whole ledger (new vs returning).
  const firstSeen = new Map<string, number>()
  for (const e of events) {
    const prev = firstSeen.get(e.wallet)
    if (prev === undefined || e.ts < prev) firstSeen.set(e.wallet, e.ts)
  }

  const dayStart = Math.floor(now / 86_400) * 86_400
  const ranges = {
    today: rangeTotals(events, dayStart, now),
    d7: rangeTotals(events, now - 7 * 86_400, now),
    d30: rangeTotals(events, now - 30 * 86_400, now),
    all: rangeTotals(events, SEASON.startsAt, now),
    selected: rangeTotals(events, from, to),
  }

  // Exchange and bridge breakdowns for the selected range.
  const inRange = events.filter((e) => e.ts >= from && e.ts <= to)
  const swaps = bucket()
  const feeByToken = new Map<string, { amount: number; usd: number }>()
  const byTool = new Map<string, Bucket & { label: string }>()
  const bySource = new Map<string, Bucket & { label: string }>()
  const lifiIn = new Map<string, Bucket & { label: string }>()
  const lifiOut = new Map<string, Bucket & { label: string }>()
  const perAsset = new Map<string, { tips: number; grossUsd: number; feeUsd: number; feeAccrued: number; claims: number; claimedUsd: number }>()
  const handles = new Map<string, HandleRow>()
  for (const e of inRange) {
    const f = flowOf(e)
    if (f === 'swap' || f === 'bridgeIn' || f === 'bridgeOut' || f === 'bridgeOther') {
      if (e.feeSymbol && (e.feeAmount ?? 0) > 0) {
        const t = feeByToken.get(e.feeSymbol) ?? { amount: 0, usd: 0 }
        t.amount += e.feeAmount ?? 0
        t.usd += e.feeUsd ?? 0
        feeByToken.set(e.feeSymbol, t)
      }
      bump(bySource, String(e.chainId), chainName(e.chainId), e)
    }
    if (f === 'swap') {
      add(swaps, e)
      bump(byTool, e.tool ?? 'unknown', e.tool ?? 'unknown', e)
    } else if (f === 'bridgeIn') bump(lifiIn, String(e.chainId), chainName(e.chainId), e)
    else if (f === 'bridgeOut' || f === 'bridgeOther') bump(lifiOut, String(e.toChainId ?? 0), chainName(e.toChainId ?? 0), e)
    else if (f === 'tipSent') {
      const sym = e.fromSymbol ?? 'USDC'
      const a = perAsset.get(sym) ?? { tips: 0, grossUsd: 0, feeUsd: 0, feeAccrued: 0, claims: 0, claimedUsd: 0 }
      a.tips += 1
      a.grossUsd += e.usd
      a.feeUsd += e.feeUsd ?? 0
      a.feeAccrued += e.feeAmount ?? 0
      perAsset.set(sym, a)
      if (e.handle) {
        const h = e.handle.toLowerCase()
        const row = handles.get(h) ?? { handle: h, tips: 0, grossUsd: 0, lastAt: 0, linked: false }
        row.tips += 1
        row.grossUsd += e.usd
        row.lastAt = Math.max(row.lastAt, e.ts)
        handles.set(h, row)
      }
    } else if (f === 'tipReceived') {
      const sym = e.fromSymbol ?? 'USDC'
      const a = perAsset.get(sym) ?? { tips: 0, grossUsd: 0, feeUsd: 0, feeAccrued: 0, claims: 0, claimedUsd: 0 }
      a.claims += 1
      a.claimedUsd += e.usd
      perAsset.set(sym, a)
    }
  }
  const linkedHandles = new Set(Object.values(snapshot.handles).map((h) => h.toLowerCase()))
  for (const row of handles.values()) row.linked = linkedHandles.has(row.handle)

  // PayX assets: ledger figures plus live contract reads.
  const contractByAsset = new Map<string, { contract: string; decimals: number; escrow: bigint; fees: bigint; balance: bigint; solvent: boolean; paused: boolean }>()
  if (trust?.payx) contractByAsset.set('USDC', { contract: trust.payx.address, decimals: 6, escrow: trust.payx.escrow, fees: trust.payx.fees, balance: trust.payx.balance, solvent: trust.payx.solvent, paused: trust.payx.paused })
  for (const i of trust?.instances ?? []) contractByAsset.set(i.symbol, { contract: i.address, decimals: i.decimals, escrow: i.escrow, fees: i.fees, balance: i.balance, solvent: i.solvent, paused: i.paused })
  const assetSymbols = new Set<string>([...perAsset.keys(), ...contractByAsset.keys()])
  const assets: AssetRow[] = [...assetSymbols].map((symbol) => {
    const a = perAsset.get(symbol) ?? { tips: 0, grossUsd: 0, feeUsd: 0, feeAccrued: 0, claims: 0, claimedUsd: 0 }
    const c = contractByAsset.get(symbol)
    const dec = c?.decimals ?? (symbol === 'cirBTC' ? 8 : 6)
    const feesWaiting = c ? Number(formatUnits(c.fees, dec)) : null
    // Withdrawn = everything accrued over the whole ledger minus what still waits; only meaningful for the full range.
    const accruedAll = events.filter((e) => e.kind === 'tip_sent' && (e.fromSymbol ?? 'USDC') === symbol).reduce((s, e) => s + (e.feeAmount ?? 0), 0)
    return {
      symbol,
      decimals: dec,
      contract: c?.contract ?? null,
      tips: a.tips,
      grossUsd: r2(a.grossUsd),
      feeUsd: r2(a.feeUsd),
      feeAccrued: r6(a.feeAccrued),
      claims: a.claims,
      claimedUsd: r2(a.claimedUsd),
      escrow: c ? Number(formatUnits(c.escrow, dec)) : null,
      feesWaiting,
      balance: c ? Number(formatUnits(c.balance, dec)) : null,
      solvent: c?.solvent ?? null,
      paused: c?.paused ?? null,
      feesWithdrawn: feesWaiting !== null ? r6(Math.max(0, accruedAll - feesWaiting)) : null,
    }
  })
  const order = ['USDC', 'EURC', 'cirBTC']
  assets.sort((x, y) => (order.indexOf(x.symbol) + 100) % 100 - ((order.indexOf(y.symbol) + 100) % 100))

  // Bridge-start log (CCTP, Gateway), selected range.
  const logEntries = log.entries.filter((e) => e.ts >= from && e.ts <= to)
  const cctp = bucket()
  const cctpRoutes = new Map<string, Bucket & { label: string }>()
  const gDep = bucket()
  const gSpend = bucket()
  for (const e of logEntries) {
    const v = { usd: e.amountUsd }
    if (e.kind === 'cctp') {
      add(cctp, v)
      bump(cctpRoutes, `${e.fromChainId}>${e.toChainId}`, `${chainName(e.fromChainId)} to ${chainName(e.toChainId)}`, v)
    } else if (e.kind === 'gateway_deposit') add(gDep, v)
    else add(gSpend, v)
  }

  // Users.
  const active = (days: number) => new Set(events.filter((e) => e.ts >= now - days * 86_400).map((e) => e.wallet)).size
  const walletsAll = new Set(events.map((e) => e.wallet))
  const withHandle = Object.keys(snapshot.handles).filter((w) => walletsAll.has(w)).length
  const newInRange = [...firstSeen.values()].filter((t) => t >= from && t <= to).length

  const notes = [
    `Ledger = LI.FI transfers for the xylonet integrator plus PayX events, dust under $${RULES.minEventUsd} excluded, so totals run a few dollars under LI.FI's raw figures.`,
    'Volume counts exchanges, bridges and payments sent. Claims move the same money out of escrow and are listed separately.',
    'CCTP and Gateway actions are only known from the start log on this site; nothing before the log began can be recovered.',
    'Fee revenue per transaction is filled by the sync; events ingested before fee tracking show no fee until a full resync.',
  ]

  return {
    generatedAt: Date.now(),
    seasonStartsAt: SEASON.startsAt,
    range: { from, to },
    notes,
    ranges,
    daily: daily(events, firstSeen, from, to),
    exchange: {
      swaps: finish(swaps),
      feeByToken: [...feeByToken.entries()].map(([symbol, t]) => ({ symbol, amount: r6(t.amount), usd: r2(t.usd) })).sort((a, b) => b.usd - a.usd),
      byTool: keyed(byTool),
      bySourceChain: keyed(bySource),
    },
    bridge: {
      lifiIn: keyed(lifiIn),
      lifiOut: keyed(lifiOut),
      log: { since: log.since, store: bridgeLogStoreKind(), cctp: { ...finish(cctp), byRoute: keyed(cctpRoutes) }, gatewayDeposits: finish(gDep), gatewaySpends: finish(gSpend), recent: [...logEntries].sort((a, b) => b.ts - a.ts).slice(0, 50) },
    },
    payx: {
      assets,
      topHandles: [...handles.values()].sort((a, b) => b.grossUsd - a.grossUsd).slice(0, 25).map((h) => ({ ...h, grossUsd: r2(h.grossUsd) })),
      handlesLinked: Object.keys(snapshot.handles).length,
      feeBps: trust?.payx?.feeBps ?? null,
      minTip: trust?.payx ? Number(formatUnits(trust.payx.minTip, 6)) : null,
    },
    treasury: {
      address: CONTRACTS.TREASURY_SAFE,
      usdc: treasury.usdc,
      eurc: treasury.eurc,
      feesWaiting: assets.filter((a) => a.feesWaiting !== null).map((a) => ({ symbol: a.symbol, amount: a.feesWaiting as number })),
    },
    users: { total: walletsAll.size, active7: active(7), active30: active(30), withHandle, newInRange },
    health: {
      sync,
      store: getPointsStore().kind,
      storeDiagnostics,
      rpc: trust?.rpc ?? { ok: false, block: null, ageSeconds: null },
      lifi: trust?.lifi ?? { ok: false, ms: null },
      cctp: trust?.cctp ?? { ok: false, ms: null },
      cron: { pointsSync: 'daily at 03:00 UTC (vercel.json)', pushDispatch: 'every 10 minutes (vercel.json)' },
      partial,
      stale,
      events: events.length,
      minEventUsd: RULES.minEventUsd,
    },
  }
}
