import { NextRequest, NextResponse, after } from 'next/server'
import { isAddress } from 'viem'
import { eventsForWallet, getPoints, refreshInBackground } from '@/lib/points/sync'
import { clientIp, rateLimit } from '@/lib/payx/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NO_STORE = { 'cache-control': 'no-store' }

/**
 * GET /api/activity/:address
 * Everything the wallet did through XyloNet: swaps and bridges routed by
 * LI.FI, payments sent to handles, claims received. Derived from the same
 * public data as points, newest first. Only the wallet itself sees this.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  if (!rateLimit(`activity:${clientIp(request.headers)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE })
  }
  const { address } = await params
  if (!isAddress(address)) return NextResponse.json({ error: 'Invalid address' }, { status: 400, headers: NO_STORE })
  const wallet = address.toLowerCase()
  const { snapshot, partial, stale, refreshDue } = await getPoints()
  if (refreshDue) after(refreshInBackground)
  const events = eventsForWallet(snapshot, wallet)
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 500)
  return NextResponse.json({ updatedAt: snapshot.updatedAt, partial, stale, handle: snapshot.handles[wallet] ?? null, events }, { headers: NO_STORE })
}
