'use client'

import { useQuery } from '@tanstack/react-query'
import type { ScoredEvent, WalletScore } from './types'

export interface SeasonInfo {
  id: number
  name: string
  startsAt: number
  endsAt: number | null
  rulesVersion: string
}

/** Public leaderboard row: no volume or tx counts for other people's wallets. */
export type LeaderboardRow = Pick<WalletScore, 'rank' | 'wallet' | 'handle' | 'tier' | 'points'>

export interface LeaderboardResponse {
  season: SeasonInfo
  updatedAt: number
  partial: boolean
  stale: boolean
  offset: number
  limit: number
  /** At most 100 rows, ever. */
  entries: LeaderboardRow[]
  me: LeaderboardRow | null
}

export interface WalletPointsResponse {
  season: SeasonInfo
  updatedAt: number
  partial: boolean
  stale: boolean
  excluded: boolean
  score: WalletScore
  tier: { name: string; min: number; color: string; next: { name: string; min: number; remaining: number } | null }
  recent: ScoredEvent[]
}

export interface RulesResponse {
  season: SeasonInfo
  rules: {
    volumePointsPerUsd: number
    bridgeToArcMultiplier: number
    activityPointsPerTx: number
    activityMinUsd: number
    activityMaxTxPerDay: number
    firstTimeBonusMinUsd: number
    firstTimeBonus: Record<'swap' | 'bridge' | 'tip_sent' | 'tip_received', number>
    boosts: Array<{ key: string; name: string; multiplier: number; from: number; to: number }>
    minEventUsd: number
  }
  tiers: Array<{ name: string; min: number; color: string }>
  excludedWallets: string[]
  sources: Array<{ key: string; label: string; covers: string[] }>
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

export function useLeaderboard(limit = 100, wallet?: string | null) {
  const w = wallet ? wallet.toLowerCase() : ''
  return useQuery({
    queryKey: ['points', 'leaderboard', limit, w],
    queryFn: () => getJson<LeaderboardResponse>(`/api/points/leaderboard?limit=${limit}${w ? `&wallet=${w}` : ''}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useWalletPoints(address?: string | null) {
  const a = address ? address.toLowerCase() : ''
  return useQuery({
    queryKey: ['points', 'wallet', a],
    queryFn: () => getJson<WalletPointsResponse>(`/api/points/wallet/${a}`),
    enabled: /^0x[0-9a-f]{40}$/.test(a),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function usePointsRules() {
  return useQuery({
    queryKey: ['points', 'rules'],
    queryFn: () => getJson<RulesResponse>('/api/points/rules'),
    staleTime: 10 * 60_000,
  })
}

/** 12345.6 -> "12,346"; 123.45 -> "123.5"; 4.5 -> "4.5"; 0.0135 -> "0.01". */
export function formatPoints(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (abs >= 100) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** 58283.05 -> "$58.3K"; 12.5 -> "$12.50". */
export function formatUsdCompact(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '$0'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`
  if (abs >= 10_000) return `$${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: abs < 100 ? 2 : 0, maximumFractionDigits: 2 })}`
}

export function formatInt(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
