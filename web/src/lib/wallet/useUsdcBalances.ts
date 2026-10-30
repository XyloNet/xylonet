'use client'

import { useQueries } from '@tanstack/react-query'
import { createPublicClient, erc20Abi, fallback, formatUnits, http } from 'viem'
import { bridgeChains, CHAIN_FALLBACK_RPCS, CHAIN_RPC_URLS } from '@/config/wagmi'
import { CONTRACTS } from '@/config/constants'

/** Native USDC contract per chain (Circle's addresses; Arc is the predeploy). */
export const USDC_BY_CHAIN: Record<number, `0x${string}`> = {
  5042: CONTRACTS.USDC,
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
  130: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
  480: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',
  146: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  1329: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
}

export const DASHBOARD_CHAINS = [5042, 8453, 1, 42161, 10, 137] as const

export interface ChainBalance {
  chainId: number
  balance: number | null
  loading: boolean
}

/** USDC balance on several chains for one address, read straight from public RPCs. */
export function useUsdcBalances(address: string | undefined, chainIds: readonly number[] = DASHBOARD_CHAINS) {
  const results = useQueries({
    queries: chainIds.map((chainId) => ({
      queryKey: ['usdc-balance', chainId, address?.toLowerCase()],
      enabled: !!address && !!USDC_BY_CHAIN[chainId],
      staleTime: 20_000,
      refetchInterval: 30_000,
      queryFn: async () => {
        const viemChain = bridgeChains.find((c) => c.id === chainId)
        const primary = CHAIN_RPC_URLS[chainId]
        const extras = CHAIN_FALLBACK_RPCS[chainId] ?? []
        const client = createPublicClient({ chain: viemChain, transport: primary ? fallback([http(primary), ...extras.map((u) => http(u))]) : http() })
        const raw = await client.readContract({ address: USDC_BY_CHAIN[chainId], abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] })
        return Number(formatUnits(raw, 6))
      },
    })),
  })
  const rows: ChainBalance[] = chainIds.map((chainId, i) => ({ chainId, balance: results[i]?.data ?? null, loading: !!results[i]?.isLoading }))
  const total = rows.reduce((s, r) => s + (r.balance ?? 0), 0)
  const anyLoading = rows.some((r) => r.loading)
  return { rows, total, anyLoading }
}
