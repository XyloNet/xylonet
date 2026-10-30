import { NextRequest, NextResponse } from 'next/server'
import { adminRefusal, getAdminSession } from '@/lib/admin/auth'
import { buildAdminAnalytics } from '@/lib/admin/analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const NO_STORE = { 'cache-control': 'no-store, private' }

/** GET /api/admin/analytics?from=<unix s>&to=<unix s> — the whole admin dataset for one range. Team only. */
export async function GET(request: NextRequest) {
  const s = await getAdminSession()
  const refusal = adminRefusal(s)
  if (refusal) return NextResponse.json({ error: refusal.error }, { status: refusal.status, headers: NO_STORE })
  const sp = new URL(request.url).searchParams
  const num = (k: string) => {
    const v = Number(sp.get(k))
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined
  }
  try {
    const data = await buildAdminAnalytics({ from: num('from'), to: num('to') })
    return NextResponse.json(data, { headers: NO_STORE })
  } catch (e) {
    console.error('[admin/analytics] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Could not build the analytics right now.' }, { status: 500, headers: NO_STORE })
  }
}
