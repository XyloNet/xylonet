import { NextRequest, NextResponse, after } from 'next/server'
import { isAddress } from 'viem'
import { SEASON } from '@/lib/points/rules'
import { getPoints, refreshInBackground } from '@/lib/points/sync'
import { clientIp, rateLimit } from '@/lib/payx/rate-limit'
import type { WalletScore } from '@/lib/points/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NO_STORE = { 'cache-control': 'no-store' }
/** Only the top 100 are ever public; the total number of ranked wallets is not exposed. */
const TOP_N = 100

function clampInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? '', 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

/** Public leaderboard rows carry no per-wallet volume/tx data — that is only shown to the wallet itself. */
function publicRow(e: WalletScore) {
  return { rank: e.rank, wallet: e.wallet, handle: e.handle, tier: e.tier, points: e.points }
}

/**
 * GET /api/points/leaderboard?limit=100&offset=0&wallet=0x…
 * The top 100 ranked wallets (XyloNet's own wallets excluded) and — when
 * `wallet` is given — that wallet's own row even if it is outside the top 100.
 * Never more than 100 rows, and no count of how many wallets are ranked:
 * platform-wide numbers are deliberately NOT public (see /api/points/sync).
 */
export async function GET(request: NextRequest) {
  if (!rateLimit(`points:lb:${clientIp(request.headers)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE })
  }
  const { searchParams } = new URL(request.url)
  const limit = clampInt(searchParams.get('limit'), TOP_N, 1, TOP_N)
  const offset = clampInt(searchParams.get('offset'), 0, 0, TOP_N - 1)
  const walletParam = searchParams.get('wallet')
  const wallet = walletParam && isAddress(walletParam) ? walletParam.toLowerCase() : null

  const { snapshot, ledger, partial, stale, refreshDue } = await getPoints()
  if (refreshDue) after(refreshInBackground)
  const entries = ledger.entries.slice(offset, Math.min(TOP_N, offset + limit)).map(publicRow)
  const mine = wallet ? ledger.byWallet.get(wallet) : null
  const me = mine ? publicRow(mine) : null

  return NextResponse.json(
    {
      season: { id: SEASON.id, name: SEASON.name, startsAt: SEASON.startsAt, endsAt: SEASON.endsAt, rulesVersion: SEASON.rulesVersion },
      updatedAt: snapshot.updatedAt,
      partial,
      stale,
      offset,
      limit,
      entries,
      me,
    },
    { headers: NO_STORE }
  )
}
