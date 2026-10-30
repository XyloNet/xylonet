import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getTwitterCallbackUrl, isTwitterConfigured } from '@/lib/payx/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/payx/auth/callback/twitter
 * Body: { code, state } from the X redirect (posted by the /payx/api/auth/callback/twitter page).
 * Verifies state, exchanges the code with the stored PKCE verifier, and stores
 * the verified handle in the session.
 */
export async function POST(request: NextRequest) {
  if (!isTwitterConfigured()) {
    return NextResponse.json(
      { error: 'Sign in with X is not available yet.' },
      { status: 503, headers: NO_STORE }
    );
  }

  try {
    let body: { code?: unknown; state?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
    }
    const code = typeof body.code === 'string' ? body.code : '';
    const state = typeof body.state === 'string' ? body.state : '';
    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400, headers: NO_STORE });
    }

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.twitterState || !session.twitterCodeVerifier || state !== session.twitterState) {
      return NextResponse.json({ error: 'Invalid or expired sign-in state' }, { status: 400, headers: NO_STORE });
    }

    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
    });

    const { accessToken } = await client.loginWithOAuth2({
      code,
      codeVerifier: session.twitterCodeVerifier,
      redirectUri: getTwitterCallbackUrl(),
    });

    const userClient = new TwitterApi(accessToken);
    const { data: user } = await userClient.v2.me({
      'user.fields': ['profile_image_url', 'name', 'username'],
    });

    session.twitterHandle = user.username;
    session.twitterId = user.id;
    session.twitterName = user.name;
    session.twitterProfileImage = user.profile_image_url;
    session.isLoggedIn = true;
    delete session.twitterState;
    delete session.twitterCodeVerifier;
    await session.save();

    return NextResponse.json(
      {
        success: true,
        user: { handle: user.username, name: user.name, profileImage: user.profile_image_url },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    // Surface a SAFE diagnostic: X's error code/description (no tokens, no secrets).
    const e = error as { code?: number | string; data?: { error?: string; error_description?: string; title?: string; detail?: string }; message?: string };
    const reason = [
      e?.code !== undefined ? `code=${e.code}` : '',
      e?.data?.error ?? e?.data?.title ?? '',
      e?.data?.error_description ?? e?.data?.detail ?? '',
      !e?.data && e?.message ? e.message.slice(0, 120) : '',
    ].filter(Boolean).join(': ').slice(0, 200);
    console.error('[payx/auth/callback] failed:', reason);
    return NextResponse.json({ error: 'Failed to complete sign in with X', reason }, { status: 500, headers: NO_STORE });
  }
}
