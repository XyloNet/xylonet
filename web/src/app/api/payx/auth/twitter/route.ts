import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getTwitterCallbackUrl, isTwitterConfigured } from '@/lib/payx/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * GET /api/payx/auth/twitter
 * Start the X OAuth 2.0 PKCE flow. State + code verifier are kept in the
 * encrypted session cookie and checked in the callback.
 */
export async function GET() {
  if (!isTwitterConfigured()) {
    return NextResponse.json(
      { error: 'Sign in with X is not available yet. Please check back shortly.' },
      { status: 503, headers: NO_STORE }
    );
  }

  try {
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
    });

    // State carries a fixed prefix so the callback page on www.xylonet.xyz can
    // recognise a mainnet login and forward it to the mainnet host while the
    // domain still serves the testnet build (pre-launch only; harmless after).
    const { randomBytes } = await import('node:crypto');
    const { url, state, codeVerifier } = client.generateOAuth2AuthLink(getTwitterCallbackUrl(), {
      scope: ['tweet.read', 'users.read'],
      state: `xm_${randomBytes(24).toString('base64url')}`,
    });

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.twitterState = state;
    session.twitterCodeVerifier = codeVerifier;
    await session.save();

    return NextResponse.json({ authUrl: url }, { headers: NO_STORE });
  } catch (error) {
    console.error('[payx/auth/twitter] failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to start sign in with X' }, { status: 500, headers: NO_STORE });
  }
}
