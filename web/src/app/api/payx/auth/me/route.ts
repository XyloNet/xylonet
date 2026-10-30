import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, type SessionData } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

/** GET /api/payx/auth/me — current signed-in X user (public profile only). */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.isLoggedIn || !session.twitterHandle) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    }

    return NextResponse.json(
      {
        handle: session.twitterHandle,
        name: session.twitterName,
        profileImage: session.twitterProfileImage,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error('[payx/auth/me] failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to read session' }, { status: 500, headers: NO_STORE });
  }
}
