import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, type SessionData } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

/** POST /api/payx/auth/logout — destroy the PayX session cookie. */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.destroy();
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    console.error('[payx/auth/logout] failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to log out' }, { status: 500, headers: NO_STORE });
  }
}
