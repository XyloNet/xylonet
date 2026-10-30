import { NextResponse } from 'next/server'
import { getPointsStore, storeDiagnostics } from '@/lib/points/store'
import { getPoints, getSyncHealth } from '@/lib/points/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/points/health — operational status of the points indexer.
 * Read-only, no platform metrics: store kind, sync cursors, last refresh
 * times and the last error per source (so a stuck backfill is diagnosable
 * without dashboard access).
 */
export async function GET() {
  // Warm this instance the same way a read route would, so the report reflects a real sync attempt.
  await getPoints()
  const h = await getSyncHealth()
  return NextResponse.json(
    { ok: h.payx.complete && !h.lifi.error && !h.payx.error, store: getPointsStore().kind, storeDiagnostics, ...h },
    { headers: { 'cache-control': 'no-store' } }
  )
}
