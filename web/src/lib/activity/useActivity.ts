'use client'

import { useQuery } from '@tanstack/react-query'
import type { PointsEvent } from '@/lib/points/types'

export interface ActivityResponse {
  updatedAt: number
  partial: boolean
  stale: boolean
  handle: string | null
  events: PointsEvent[]
}

export function useActivity(address?: string | null) {
  const a = address ? address.toLowerCase() : ''
  return useQuery<ActivityResponse>({
    queryKey: ['activity', a],
    queryFn: async () => {
      const r = await fetch(`/api/activity/${a}`, { cache: 'no-store' })
      if (!r.ok) throw new Error('activity')
      return r.json()
    },
    enabled: /^0x[0-9a-f]{40}$/.test(a),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 5042: 'Arc', 8453: 'Base', 42161: 'Arbitrum', 10: 'OP Mainnet', 137: 'Polygon', 43114: 'Avalanche', 59144: 'Linea', 130: 'Unichain', 480: 'World Chain', 146: 'Sonic', 1329: 'Sei', 50: 'XDC', 57073: 'Ink', 98866: 'Plume', 143: 'Monad', 2818: 'Morph', 81224: 'Codex',
}
export const chainName = (id?: number) => (id ? (CHAIN_NAMES[id] ?? `chain ${id}`) : '')

export function eventLabel(e: PointsEvent): string {
  switch (e.kind) {
    case 'swap':
      return 'Exchange'
    case 'bridge':
      return e.toChainId === 5042 ? 'Bridged to Arc' : `Bridged to ${chainName(e.toChainId)}`
    case 'tip_sent':
      return e.handle ? `Paid @${e.handle}` : 'Payment'
    case 'tip_received':
      return e.handle ? `Claimed as @${e.handle}` : 'Claim'
  }
}

export function eventDetail(e: PointsEvent): string {
  switch (e.kind) {
    case 'swap':
      return [e.fromSymbol, e.toSymbol].filter(Boolean).join(' → ') + (e.tool ? ` · ${e.tool}` : '')
    case 'bridge':
      return `${e.fromSymbol ?? 'USDC'} · ${chainName(e.chainId)} → ${chainName(e.toChainId)}`
    case 'tip_sent':
      return 'USDC on Arc via PayX'
    case 'tip_received':
      return 'USDC on Arc via PayX'
  }
}

export function eventLink(e: PointsEvent): string {
  return e.kind === 'swap' || e.kind === 'bridge' ? `https://scan.li.fi/tx/${e.txHash}` : `https://explorer.arc.io/tx/${e.txHash}`
}
