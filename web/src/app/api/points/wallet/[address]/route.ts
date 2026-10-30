import { NextRequest, NextResponse, after } from 'next/server'
import { isAddress } from 'viem'
import { scoreWallet } from '@/lib/points/engine'
import { SEASON, isExcludedWallet, nextTierFor, tierFor } from '@/lib/points/rules'
import { eventsForWallet, getPoints, refreshInBackground } from '@/lib/points/sync'
import { clientIp, rateLimit } from '@/lib/payx/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NO_STORE = { 'cache-control': 'no-store' }
const RECENT = 25

/**
 * GET /api/points/wallet/:address
 * One wallet's score, rank, tier progress and its most recent point-earning
 * actions (each annotated with the points it produced).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  if (!rateLimit(`points:w:${clientIp(request.headers)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE })
  }
  const { address } = await params
  if (!isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400, headers: NO_STORE })
  }
  const wallet = address.toLowerCase()
  const { snapshot, ledger, partial, stale, refreshDue } = await getPoints()
  if (refreshDue) after(refreshInBackground)

  const events = eventsForWallet(snapshot, wallet)
  const { score, scored } = scoreWallet(wallet, events, snapshot.handles[wallet] ?? null)
  const ranked = ledger.byWallet.get(wallet) ?? null
  score.rank = ranked?.rank ?? null
  const tier = tierFor(score.points)
  const next = nextTierFor(score.points)

  return NextResponse.json(
    {
      season: { id: SEASON.id, name: SEASON.name, startsAt: SEASON.startsAt, endsAt: SEASON.endsAt, rulesVersion: SEASON.rulesVersion },
      updatedAt: snapshot.updatedAt,
      partial,
      stale,
      excluded: isExcludedWallet(wallet),
      score,
      tier: { ...tier, next: next ? { name: next.name, min: next.min, remaining: Math.max(0, Math.round((next.min - score.points) * 100) / 100) } : null },
      recent: scored.slice(-RECENT).reverse(),
    },
    { headers: NO_STORE }
  )
}
