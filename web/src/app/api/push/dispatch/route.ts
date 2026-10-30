import { NextRequest, NextResponse } from 'next/server'
import { dispatchFromChain } from '@/lib/push/dispatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const NO_STORE = { 'cache-control': 'no-store' }

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.POINTS_ADMIN_KEY
  if (!secret) return process.env.NODE_ENV !== 'production'
  const h = request.headers.get('authorization') || ''
  return h === `Bearer ${secret}` || request.headers.get('x-points-admin-key') === secret
}

/** GET: scan for new payments and notify subscribed creators (cron / operator). */
export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  try {
    const r = await dispatchFromChain({ force: true })
    return NextResponse.json({ ok: true, ...(r ?? { skipped: 'not configured' }) }, { headers: NO_STORE })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500, headers: NO_STORE })
  }
}
