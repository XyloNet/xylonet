import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { isAddress } from 'viem';
import { sessionOptions, type SessionData } from '@/lib/session';
import { signClaim } from '@/lib/payx/oracle';
import { getOraclePrivateKey, getServerPayXAddressFor } from '@/lib/payx/env';
import { normalizeHandle } from '@/lib/payx/handle';
import { clientIp, rateLimit } from '@/lib/payx/rate-limit';
import { ARC_CHAIN_ID } from '@/config/wagmi';
import { PAYX_ASSETS, parsePayXAssetKey, type PayXAssetKey } from '@/config/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * POST /api/payx/claim/sign  body: { walletAddress, asset?: PayXAssetKey }
 *   (`asset` must be a PAYX_ASSETS registry key, e.g. 'USDC'; default USDC)
 *
 * Issues an EIP-712 claim authorization for the X handle in the caller's
 * OAuth session, bound to the wallet address in the body, Arc mainnet (5042)
 * and the PayXTipping v2 instance of the requested asset (default USDC).
 * Each asset has its own contract, so the domain — and therefore the
 * signature — is per asset.
 *
 * Threat model: A-1 (chain/contract binding), A-2 (handle only from session),
 * A-3 (wallet validated), A-4 (random 32-byte nonce), A-6 (rate limit),
 * A-7 (no key/stack leakage), A-8 (503 when not configured).
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.isLoggedIn || !session.twitterHandle) {
      return NextResponse.json({ error: 'Not authenticated with X' }, { status: 401, headers: NO_STORE });
    }

    const handle = normalizeHandle(session.twitterHandle);
    if (!handle) {
      return NextResponse.json(
        { error: 'Your X handle cannot receive tips onchain (unsupported characters).' },
        { status: 400, headers: NO_STORE }
      );
    }

    const ip = clientIp(request.headers);
    if (
      !rateLimit(`sign:h:${handle}`, RATE_LIMIT, RATE_WINDOW_MS) ||
      !rateLimit(`sign:ip:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    ) {
      return NextResponse.json(
        { error: 'Too many claim requests. Please wait a few minutes and try again.' },
        { status: 429, headers: { ...NO_STORE, 'retry-after': '600' } }
      );
    }

    let body: { walletAddress?: unknown; asset?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
    }
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : '';
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400, headers: NO_STORE });
    }

    let asset: PayXAssetKey = 'USDC';
    if (body.asset !== undefined && body.asset !== null) {
      const parsed = parsePayXAssetKey(body.asset);
      if (!parsed) {
        return NextResponse.json({ error: 'Unknown asset' }, { status: 400, headers: NO_STORE });
      }
      asset = parsed;
    }

    const privateKey = getOraclePrivateKey();
    const contract = getServerPayXAddressFor(asset);
    if (!privateKey || !contract) {
      return NextResponse.json(
        { error: `PayX ${PAYX_ASSETS[asset].token.symbol} claims are not available yet. Please check back shortly.` },
        { status: 503, headers: NO_STORE }
      );
    }

    const signed = await signClaim({
      privateKey,
      contract,
      chainId: ARC_CHAIN_ID,
      handle,
      wallet: walletAddress,
    });

    return NextResponse.json(
      {
        handle: signed.handle,
        walletAddress: signed.wallet,
        nonce: signed.nonce,
        signature: signed.signature,
        oracleAddress: signed.oracleAddress,
        asset,
        symbol: PAYX_ASSETS[asset].token.symbol,
        contract,
        chainId: ARC_CHAIN_ID,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    // Never echo error details: they could include env state or stack traces.
    console.error('[payx/claim/sign] failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json(
      { error: 'Failed to generate claim authorization' },
      { status: 500, headers: NO_STORE }
    );
  }
}
