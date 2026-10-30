/**
 * XyloNet Points — Season 1 rules.
 *
 * This is the ONE file to edit when tuning the programme. Points are fully
 * derived, so changing a number here re-scores every wallet retroactively on
 * the next request (no migration needed). Bump `rulesVersion` when you do.
 *
 * Design follows what users already know from Jumper XP / LI.FI, Hyperliquid,
 * Linea LXP and similar programmes:
 *   - volume points      : 1 point per $1 moved through XyloNet
 *   - activity points    : a flat amount per qualifying transaction, capped per day
 *   - first-time bonuses : one-off rewards for trying each product
 *   - boosts             : time-boxed multipliers (Genesis window for launch)
 *   - tiers              : named levels by lifetime points
 */

import { CONTRACTS } from '@/config/constants'
import type { PointsEventKind } from './types'

export const SEASON = {
  id: 1,
  name: 'Season 1 · Genesis',
  /** Mainnet go-live: PayX v2 deployed 2026-09-15 (public launch 2026-09-16). Unix seconds, UTC. */
  startsAt: Math.floor(Date.UTC(2026, 8, 15, 0, 0, 0) / 1000),
  /** null = open-ended. */
  endsAt: null as number | null,
  rulesVersion: '1.0.0',
} as const

export const RULES = {
  /** Points per $1 of volume, all products. */
  volumePointsPerUsd: 1,
  /** Bridges whose destination is Arc earn this multiple on volume points (bring liquidity to Arc). */
  bridgeToArcMultiplier: 1.5,
  /** Flat points per qualifying transaction. */
  activityPointsPerTx: 5,
  /** "Qualifying" = at least this much USD (keeps dust/spam from farming activity points). */
  activityMinUsd: 1,
  /** At most this many transactions per UTC day earn activity points. */
  activityMaxTxPerDay: 20,
  /** One-off bonus the first time a wallet does each action (only transactions of at least firstTimeBonusMinUsd qualify). */
  firstTimeBonusMinUsd: 1,
  firstTimeBonus: {
    swap: 25,
    bridge: 50,
    tip_sent: 25,
    tip_received: 25,
  } satisfies Record<PointsEventKind, number>,
  /** Time-boxed multipliers applied to everything earned in the window. */
  boosts: [
    {
      key: 'genesis',
      name: 'Genesis boost',
      multiplier: 1.5,
      from: SEASON.startsAt,
      /** Through 2026-10-15 23:59:59 UTC. */
      to: Math.floor(Date.UTC(2026, 9, 16, 0, 0, 0) / 1000) - 1,
    },
  ],
  /** Events below this USD value are ignored entirely (sub-cent dust, test routes). */
  minEventUsd: 0.01,
} as const

export interface Tier {
  name: string
  min: number
  /** Colour token shared by the API and the UI. */
  color: string
}

export const TIERS: readonly Tier[] = [
  { name: 'Bronze', min: 0, color: '#b87333' },
  { name: 'Silver', min: 100, color: '#c0c7d1' },
  { name: 'Gold', min: 1_000, color: '#f5c451' },
  { name: 'Platinum', min: 10_000, color: '#8fd3f4' },
  { name: 'Diamond', min: 100_000, color: '#7EE8CF' },
] as const

export function tierFor(points: number): Tier {
  let t: Tier = TIERS[0]
  for (const tier of TIERS) if (points >= tier.min) t = tier
  return t
}

export function nextTierFor(points: number): Tier | null {
  return TIERS.find((t) => t.min > points) ?? null
}

/**
 * XyloNet's own operational wallets never appear on the leaderboard.
 * (Their activity is still indexed so platform totals stay honest.)
 */
export const EXCLUDED_WALLETS: ReadonlySet<string> = new Set(
  [
    '0xCb4d137f4057cD522093aF706fe2f771F74DFC00', // XYLO-DEPLOYER-01
    '0x9e6D408256A3bDd0326C00df82136E843B7aDd97', // XYLO-ORACLE-01
    CONTRACTS.ADMIN_SAFE,
    CONTRACTS.TREASURY_SAFE,
    CONTRACTS.LIFI_DIAMOND,
    CONTRACTS.LIFI_FEE_FORWARDER,
  ].map((a) => a.toLowerCase())
)

export function isExcludedWallet(wallet: string): boolean {
  return EXCLUDED_WALLETS.has(wallet.toLowerCase())
}

export function boostFor(ts: number): { multiplier: number; key: string | null } {
  for (const b of RULES.boosts) {
    if (ts >= b.from && ts <= b.to) return { multiplier: b.multiplier, key: b.key }
  }
  return { multiplier: 1, key: null }
}

export function inSeason(ts: number): boolean {
  if (ts < SEASON.startsAt) return false
  if (SEASON.endsAt !== null && ts > SEASON.endsAt) return false
  return true
}

/** Public, serialisable description of the rules (served by /api/points/rules). */
export function describeRules() {
  return {
    season: SEASON,
    rules: RULES,
    tiers: TIERS,
    excludedWallets: [...EXCLUDED_WALLETS],
    sources: [
      { key: 'lifi', label: 'LI.FI transfers (integrator: xylonet)', covers: ['swap', 'bridge'] },
      { key: 'payx', label: 'PayX contract events on Arc', covers: ['tip_sent', 'tip_received'] },
    ],
  }
}
