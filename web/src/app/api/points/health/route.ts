import { NextResponse } from 'next/server'
import { getPointsStore, storeDiagnostics } from '@/lib/points/store'
import { getPoints, getSyncHealth } from '@/lib/points/sync'
import { getAdminSession } from '@/lib/admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/points/health — operational status of the points indexer.
 * Read-only, no platform metrics. Anonymous callers get ok/updatedAt only;
 * the team (admin session) gets store kind, cursors, diagnostics and the last
 * error strings, which can carry provider detail.
 */
export async function GET() {
  // Warm this instance the same way a read route would, so the report reflects a real sync attempt.
  await getPoints()
  const h = await getSyncHealth()
  const ok = h.payx.complete && !h.lifi.error && !h.payx.error
  const admin = await getAdminSession()
  const body = admin.allowed ? { ok, store: getPointsStore().kind, storeDiagnostics, ...h } : { ok, updatedAt: h.updatedAt }
  return NextResponse.json(body, { headers: { 'cache-control': 'no-store' } })
}
