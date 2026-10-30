/**
 * Pure scoring engine: events -> per-wallet scores -> ranked ledger.
 * No I/O here, so it is trivially testable and re-runs whenever rules change.
 */

import { RULES, boostFor, inSeason, isExcludedWallet, tierFor } from './rules'
import type { CountBreakdown, Ledger, LedgerTotals, PointsBreakdown, PointsEvent, PointsSnapshot, ScoredEvent, VolumeBreakdown, WalletScore } from './types'

const KIND_LABEL: Record<PointsEvent['kind'], string> = {
  swap: 'Swap',
  bridge: 'Bridge',
  tip_sent: 'Tip sent',
  tip_received: 'Tip claimed',
}

const round2 = (n: number) => Math.round(n * 100) / 100
const dayKey = (ts: number) => Math.floor(ts / 86_400)

function emptyBreakdown(): PointsBreakdown {
  return { swap: 0, bridge: 0, tipsSent: 0, tipsReceived: 0, activity: 0, bonuses: 0, boost: 0 }
}
function emptyVolume(): VolumeBreakdown {
  return { swap: 0, bridge: 0, tipsSent: 0, tipsReceived: 0, total: 0 }
}
function emptyCounts(): CountBreakdown {
  return { swap: 0, bridge: 0, tipsSent: 0, tipsReceived: 0, total: 0 }
}

const KIND_FIELD = {
  swap: 'swap',
  bridge: 'bridge',
  tip_sent: 'tipsSent',
  tip_received: 'tipsReceived',
} as const

/**
 * Score one wallet's events (any order). Returns the aggregate plus every
 * event annotated with the points it produced. The same code path feeds the
 * leaderboard and the per-wallet activity feed, so they can never disagree.
 */
export function scoreWallet(wallet: string, events: PointsEvent[], handle: string | null): { score: WalletScore; scored: ScoredEvent[] } {
  const sorted = [...events]
    .filter((e) => inSeason(e.ts) && e.usd >= RULES.minEventUsd)
    .sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1))
  const breakdown = emptyBreakdown()
  const volume = emptyVolume()
  const counts = emptyCounts()
  const seenKinds = new Set<PointsEvent['kind']>()
  const perDay = new Map<number, number>()
  const days = new Set<number>()
  const scored: ScoredEvent[] = []

  for (const e of sorted) {
    const field = KIND_FIELD[e.kind]
    const parts: string[] = []

    // 1. volume
    let volumeMult = 1
    if (e.kind === 'bridge' && e.toChainId === 5042) volumeMult = RULES.bridgeToArcMultiplier
    const volumePts = e.usd * RULES.volumePointsPerUsd * volumeMult
    parts.push(volumeMult !== 1 ? `${KIND_LABEL[e.kind]} volume x${volumeMult}` : `${KIND_LABEL[e.kind]} volume`)

    // 2. activity (flat per qualifying tx, capped per UTC day)
    let activityPts = 0
    if (e.usd >= RULES.activityMinUsd) {
      const d = dayKey(e.ts)
      const used = perDay.get(d) ?? 0
      if (used < RULES.activityMaxTxPerDay) {
        activityPts = RULES.activityPointsPerTx
        perDay.set(d, used + 1)
        parts.push('Activity')
      }
    }

    // 3. first-time bonus (only a real transaction unlocks it, so dust cannot farm bonuses)
    let bonusPts = 0
    if (e.usd >= RULES.firstTimeBonusMinUsd && !seenKinds.has(e.kind)) {
      seenKinds.add(e.kind)
      bonusPts = RULES.firstTimeBonus[e.kind]
      parts.push(`First ${KIND_LABEL[e.kind].toLowerCase()} bonus`)
    }

    // 4. boost
    const { multiplier, key } = boostFor(e.ts)
    const raw = volumePts + activityPts + bonusPts
    const total = raw * multiplier
    if (multiplier !== 1) parts.push(`${key === 'genesis' ? 'Genesis' : 'Boost'} x${multiplier}`)

    breakdown[field] += volumePts * multiplier
    breakdown.activity += activityPts * multiplier
    breakdown.bonuses += bonusPts * multiplier
    breakdown.boost += total - raw
    volume[field] += e.usd
    volume.total += e.usd
    counts[field] += 1
    counts.total += 1
    days.add(dayKey(e.ts))
    scored.push({ ...e, points: round2(total), parts })
  }

  const points = breakdown.swap + breakdown.bridge + breakdown.tipsSent + breakdown.tipsReceived + breakdown.activity + breakdown.bonuses
  const score: WalletScore = {
    wallet,
    handle,
    points: round2(points),
    breakdown: {
      swap: round2(breakdown.swap),
      bridge: round2(breakdown.bridge),
      tipsSent: round2(breakdown.tipsSent),
      tipsReceived: round2(breakdown.tipsReceived),
      activity: round2(breakdown.activity),
      bonuses: round2(breakdown.bonuses),
      boost: round2(breakdown.boost),
    },
    volumeUsd: {
      swap: round2(volume.swap),
      bridge: round2(volume.bridge),
      tipsSent: round2(volume.tipsSent),
      tipsReceived: round2(volume.tipsReceived),
      total: round2(volume.total),
    },
    counts,
    firstActiveAt: sorted[0]?.ts ?? null,
    lastActiveAt: sorted[sorted.length - 1]?.ts ?? null,
    activeDays: days.size,
    rank: null,
    tier: tierFor(points).name,
  }
  return { score, scored }
}

/** Group events by wallet (lower-cased). */
export function groupByWallet(events: PointsEvent[]): Map<string, PointsEvent[]> {
  const m = new Map<string, PointsEvent[]>()
  for (const e of events) {
    const w = e.wallet.toLowerCase()
    const arr = m.get(w)
    if (arr) arr.push(e)
    else m.set(w, [e])
  }
  return m
}

export function computeLedger(snapshot: PointsSnapshot): Ledger {
  const grouped = groupByWallet(snapshot.events)
  const entries: WalletScore[] = []
  const totals: LedgerTotals = { wallets: 0, points: 0, volumeUsd: 0, transactions: 0, swaps: 0, bridges: 0, tipsSent: 0, tipsClaimed: 0 }

  for (const [wallet, events] of grouped) {
    const { score } = scoreWallet(wallet, events, snapshot.handles[wallet] ?? null)
    if (score.counts.total === 0) continue
    // Totals include everyone (honest platform stats)...
    totals.volumeUsd += score.volumeUsd.total
    totals.transactions += score.counts.total
    totals.swaps += score.counts.swap
    totals.bridges += score.counts.bridge
    totals.tipsSent += score.counts.tipsSent
    totals.tipsClaimed += score.counts.tipsReceived
    // ...but XyloNet's own wallets earn nothing and are not ranked.
    if (isExcludedWallet(wallet)) continue
    totals.wallets += 1
    totals.points += score.points
    entries.push(score)
  }

  entries.sort((a, b) => b.points - a.points || b.volumeUsd.total - a.volumeUsd.total || (a.firstActiveAt ?? 0) - (b.firstActiveAt ?? 0))
  const byWallet = new Map<string, WalletScore>()
  entries.forEach((e, i) => {
    e.rank = i + 1
    byWallet.set(e.wallet, e)
  })
  totals.points = round2(totals.points)
  totals.volumeUsd = round2(totals.volumeUsd)
  return { entries, byWallet, totals, computedFrom: snapshot.updatedAt }
}
