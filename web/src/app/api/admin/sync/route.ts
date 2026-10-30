import { NextRequest, NextResponse } from 'next/server'
import { adminRefusal, getAdminSession } from '@/lib/admin/auth'
import { syncPoints } from '@/lib/points/sync'
import { getPointsStore } from '@/lib/points/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const NO_STORE = { 'cache-control': 'no-store' }

/**
 * POST /api/admin/sync?mode=request|full — runs the points ledger sync for a
 * signed-in team member. Calls the sync directly on the server, so the cron
 * key never reaches the browser.
 */
export async function POST(request: NextRequest) {
  const s = await getAdminSession()
  const refusal = adminRefusal(s)
  if (refusal) return NextResponse.json({ error: refusal.error }, { status: refusal.status, headers: NO_STORE })
  const mode = new URL(request.url).searchParams.get('mode') === 'full' ? 'full' : 'request'
  try {
    const report = await syncPoints(mode)
    return NextResponse.json({ ok: true, store: getPointsStore().kind, report }, { headers: NO_STORE })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500, headers: NO_STORE })
  }
}
