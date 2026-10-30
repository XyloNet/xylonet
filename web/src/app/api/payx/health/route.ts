import { NextResponse } from 'next/server';
import { ARC_CHAIN_ID } from '@/config/wagmi';
import { getOracleAddress } from '@/lib/payx/oracle';
import { getOraclePrivateKey, getServerPayXAddressFor, isTwitterConfigured } from '@/lib/payx/env';
import { isRpcConfigured } from '@/lib/payx/client';
import { isSessionConfigured } from '@/lib/session';
import { PAYX_ASSETS, PAYX_ASSET_KEYS } from '@/config/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/payx/health
 * Configuration status only. Never includes secret values — the oracle is
 * reported as its public address, derived from the key at request time.
 * Lists every PayX instance (one per tipping asset).
 */
export async function GET() {
  const key = getOraclePrivateKey();
  let oracleAddress: string | null = null;
  try {
    oracleAddress = key ? getOracleAddress(key) : null;
  } catch {
    oracleAddress = null;
  }

  const contracts = PAYX_ASSET_KEYS.map((asset) => {
    const a = PAYX_ASSETS[asset];
    const address = getServerPayXAddressFor(asset);
    return {
      asset,
      symbol: a.token.symbol,
      token: a.token.address,
      decimals: a.token.decimals,
      contract: address,
      deployed: !!address,
    };
  });
  const usdcContract = contracts.find((c) => c.asset === 'USDC')?.contract ?? null;

  const configured = {
    oracle: !!oracleAddress,
    twitter: isTwitterConfigured(),
    session: isSessionConfigured(),
    rpc: isRpcConfigured(),
    // The USDC instance is the baseline; every instance is reported per contract below.
    contract: !!usdcContract,
  };

  return NextResponse.json(
    {
      ok: Object.values(configured).every(Boolean),
      service: 'PayX API',
      version: '2.1.0',
      chainId: ARC_CHAIN_ID,
      /** Legacy: the USDC instance. */
      contract: usdcContract,
      contracts,
      oracleAddress,
      configured,
      timestamp: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
