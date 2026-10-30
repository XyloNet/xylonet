'use client'

import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import { createPublicClient, fallback, http, type Chain } from 'viem'
import type { Connector } from 'wagmi'
import { bridgeChains, CHAIN_FALLBACK_RPCS, CHAIN_RPC_URLS } from '@/config/wagmi'

/** Loose shape of any App Kit event; listeners narrow what they need. */
export type KitEvent = {
  values?: { name?: string; state?: string; txHash?: string; explorerUrl?: string }
  protocol?: string
  tags?: { type?: string; operation?: string; step?: string }
  data?: unknown
}

export type KitAdapter = Awaited<ReturnType<typeof createViemAdapterFromProvider>>

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

const viemChainMap = new Map<number, Chain>(bridgeChains.map((c) => [c.id, c]))

let kitSingleton: AppKit | null = null
const listeners = new Set<(e: KitEvent) => void>()

/** One App Kit for the app. Events fan out to whoever is listening. */
export function getKit(): AppKit {
  if (!kitSingleton) {
    kitSingleton = new AppKit()
    ;(kitSingleton as unknown as { on: (a: string, h: (p: KitEvent) => void) => void }).on('*', (p) => listeners.forEach((l) => l(p)))
  }
  return kitSingleton
}

export function onKitEvent(handler: (e: KitEvent) => void): () => void {
  listeners.add(handler)
  return () => {
    listeners.delete(handler)
  }
}

/** An App Kit adapter bound to the connected wallet, reading through our own RPCs. */
export async function createKitAdapter(connector: Connector): Promise<KitAdapter> {
  const provider = (await connector.getProvider()) as Eip1193
  return createViemAdapterFromProvider({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: provider as any,
    getPublicClient: ({ chain }: { chain: Chain }) => {
      const viemChain = viemChainMap.get(chain.id) ?? chain
      const primary = CHAIN_RPC_URLS[chain.id]
      const extras = CHAIN_FALLBACK_RPCS[chain.id] ?? []
      const transport = primary ? fallback([http(primary), ...extras.map((u) => http(u))]) : http()
      const withFees = { ...viemChain, fees: { ...(viemChain as { fees?: object }).fees, baseFeeMultiplier: 1.5 } } as Chain
      return createPublicClient({ chain: withFees, transport })
    },
  })
}

/** Turn any wallet or kit error into one sentence a person can act on. */
export function friendlyKitError(err: unknown, fallbackMsg: string): string {
  const m = String((err as { shortMessage?: string })?.shortMessage ?? (err as { message?: string })?.message ?? '')
  if (/rejected|denied|cancel/i.test(m)) return 'You cancelled in your wallet. Nothing was moved.'
  if (/insufficient funds/i.test(m)) return 'Not enough gas on that chain to send the transaction.'
  if (/insufficient.*balance|exceeds/i.test(m)) return 'That is more than the available balance.'
  if (!m) return fallbackMsg
  return m.length > 160 ? m.slice(0, 157) + '…' : m
}
