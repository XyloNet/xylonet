import { NextRequest, NextResponse } from 'next/server'
import { getPoints, syncPoints } from '@/lib/points/sync'
import { getPointsStore } from '@/lib/points/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const NO_STORE = { 'cache-control': 'no-store' }

/**
 * Operator endpoint. Authorised by POINTS_ADMIN_KEY (header `x-points-admin-key`
 * or `authorization: Bearer …`, which is also what Vercel Cron sends when
 * CRON_SECRET is set). In local development with no key configured it is open.
 *
 *   POST /api/points/sync?mode=full    — unbounded backfill from launch
 *   POST /api/points/sync              — one budgeted incremental step
 *   GET  … same (for cron)
 */
function authorised(req: NextRequest): boolean {
  const key = process.env.POINTS_ADMIN_KEY || process.env.CRON_SECRET
  if (!key) return process.env.NODE_ENV !== 'production'
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return req.headers.get('x-points-admin-key') === key || bearer === key
}

async function handle(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  const mode = new URL(req.url).searchParams.get('mode') === 'full' ? 'full' : 'request'
  try {
    const report = await syncPoints(mode)
    const { ledger } = await getPoints({ maxAgeMs: Number.POSITIVE_INFINITY })
    return NextResponse.json({ ok: true, store: getPointsStore().kind, report, totals: ledger.totals }, { headers: NO_STORE })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500, headers: NO_STORE })
  }
}

export const GET = handle
export const POST = handle
