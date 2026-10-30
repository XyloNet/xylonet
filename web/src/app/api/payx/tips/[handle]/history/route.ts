import { NextRequest, NextResponse } from 'next/server';
import { formatUnits } from 'viem';
import { PayXTippingABI } from '@/config/abis/PayXTipping';
import { PAYX_ASSETS, parsePayXAssetKey, type PayXAssetKey } from '@/config/constants';
import { getPayXPublicClient, isRpcConfigured } from '@/lib/payx/client';
import { getServerPayXAddressFor } from '@/lib/payx/env';
import { normalizeHandle } from '@/lib/payx/handle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_LIMIT = 100;

function clampInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? '', 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/payx/tips/:handle/history?offset=0&limit=20&asset=USDC
 * Tip[] from that asset's PayX instance (amounts are net of fee, formatted
 * with the token's decimals). `asset` defaults to USDC.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle: raw } = await params;
  const handle = normalizeHandle(raw);
  if (!handle) {
    return NextResponse.json({ error: 'Invalid handle' }, { status: 400, headers: NO_STORE });
  }

  const { searchParams } = new URL(request.url);
  const offset = clampInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(searchParams.get('limit'), 20, 1, MAX_LIMIT);

  const assetParam = searchParams.get('asset');
  let asset: PayXAssetKey = 'USDC';
  if (assetParam) {
    const parsed = parsePayXAssetKey(assetParam);
    if (!parsed) {
      return NextResponse.json({ error: 'Unknown asset' }, { status: 400, headers: NO_STORE });
    }
    asset = parsed;
  }
  const { token } = PAYX_ASSETS[asset];

  const contract = getServerPayXAddressFor(asset);
  if (!contract || !isRpcConfigured()) {
    return NextResponse.json(
      { handle, asset, symbol: token.symbol, decimals: token.decimals, offset, limit, tips: [], deployed: false },
      { headers: NO_STORE }
    );
  }

  try {
    const client = getPayXPublicClient();
    const tips = await client.readContract({
      address: contract,
      abi: PayXTippingABI,
      functionName: 'getTipHistory',
      args: [handle, BigInt(offset), BigInt(limit)],
    });

    return NextResponse.json(
      {
        handle,
        asset,
        symbol: token.symbol,
        decimals: token.decimals,
        contract,
        offset,
        limit,
        deployed: true,
        tips: tips.map((t) => ({
          tipper: t.tipper,
          amount: formatUnits(t.amount, token.decimals),
          amountRaw: t.amount.toString(),
          timestamp: Number(t.timestamp),
          date: new Date(Number(t.timestamp) * 1000).toISOString(),
          message: t.message,
        })),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error('[payx/tips/history] read failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to fetch tip history' }, { status: 502, headers: NO_STORE });
  }
}
