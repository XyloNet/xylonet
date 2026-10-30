import { NextRequest, NextResponse } from 'next/server';
import { formatUnits } from 'viem';
import { PayXTippingABI } from '@/config/abis/PayXTipping';
import { PAYX_ASSETS, PAYX_ASSET_KEYS, type PayXAssetKey } from '@/config/constants';
import { getPayXPublicClient, isRpcConfigured } from '@/lib/payx/client';
import { getServerPayXAddressFor } from '@/lib/payx/env';
import { normalizeHandle } from '@/lib/payx/handle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };
const ZERO = '0x0000000000000000000000000000000000000000';

interface AssetInfo {
  asset: PayXAssetKey;
  symbol: string;
  decimals: number;
  contract: `0x${string}` | null;
  deployed: boolean;
  pendingBalance: string;
  pendingBalanceRaw: string;
  linkedWallet: string;
  isRegistered: boolean;
  totalReceived: string;
  totalClaimed: string;
  tipCount: number;
}

function emptyAssetInfo(asset: PayXAssetKey, contract: `0x${string}` | null): AssetInfo {
  const a = PAYX_ASSETS[asset];
  return {
    asset,
    symbol: a.token.symbol,
    decimals: a.token.decimals,
    contract,
    deployed: false,
    pendingBalance: '0',
    pendingBalanceRaw: '0',
    linkedWallet: ZERO,
    isRegistered: false,
    totalReceived: '0',
    totalClaimed: '0',
    tipCount: 0,
  };
}

async function readAssetInfo(asset: PayXAssetKey, handle: string): Promise<AssetInfo> {
  const contract = getServerPayXAddressFor(asset);
  if (!contract || !isRpcConfigured()) return emptyAssetInfo(asset, contract);
  const a = PAYX_ASSETS[asset];
  const client = getPayXPublicClient();
  const info = await client.readContract({
    address: contract,
    abi: PayXTippingABI,
    functionName: 'getHandleInfo',
    args: [handle],
  });
  return {
    asset,
    symbol: a.token.symbol,
    decimals: a.token.decimals,
    contract,
    deployed: true,
    pendingBalance: formatUnits(info.pendingBalance, a.token.decimals),
    pendingBalanceRaw: info.pendingBalance.toString(),
    linkedWallet: info.linkedWallet,
    isRegistered: info.isRegistered,
    totalReceived: formatUnits(info.totalReceived, a.token.decimals),
    totalClaimed: formatUnits(info.totalClaimed, a.token.decimals),
    tipCount: Number(info.tipCount),
  };
}

/**
 * GET /api/payx/tips/:handle — onchain HandleInfo for an X handle, per asset.
 *
 * Response: { handle, assets: AssetInfo[], <asset key lowercased>: AssetInfo, ... }
 * (one lowercase key per registry asset, e.g. `usdc`)
 * plus the legacy top-level USDC fields (pendingBalance, linkedWallet, ...)
 * for existing integrations. Amounts are formatted with each token's decimals.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle: raw } = await params;
  const handle = normalizeHandle(raw);
  if (!handle) {
    return NextResponse.json({ error: 'Invalid handle' }, { status: 400, headers: NO_STORE });
  }

  try {
    const infos = await Promise.all(PAYX_ASSET_KEYS.map((k) => readAssetInfo(k, handle)));
    const byKey = Object.fromEntries(infos.map((i) => [i.asset, i])) as Record<PayXAssetKey, AssetInfo>;
    const usdc = byKey.USDC;

    return NextResponse.json(
      {
        handle,
        // Legacy USDC fields (unchanged shape).
        pendingBalance: usdc.pendingBalance,
        pendingBalanceRaw: usdc.pendingBalanceRaw,
        linkedWallet: usdc.linkedWallet,
        isRegistered: usdc.isRegistered,
        totalReceived: usdc.totalReceived,
        totalClaimed: usdc.totalClaimed,
        tipCount: usdc.tipCount,
        deployed: usdc.deployed,
        // Per-asset info, keyed by lowercase asset key (usdc, ...).
        ...Object.fromEntries(infos.map((i) => [i.asset.toLowerCase(), i])),
        assets: infos,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error('[payx/tips] read failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to fetch tip data' }, { status: 502, headers: NO_STORE });
  }
}
