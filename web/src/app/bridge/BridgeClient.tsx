'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/xylo/PageHeader'
import { BridgeCardLazy, UnifiedCardLazy } from '@/components/bridge/BridgeLazy'
import { LiFiWidgetLazy } from '@/components/lifi/LiFiWidgetLazy'
import { LIFI_CHAIN_COUNT } from '@/lib/lifi/config'
import { ChainLogo } from '@/components/ui/TokenLogos'
import { cn } from '@/lib/utils'

type Tab = 'usdc' | 'unified' | 'any'

const CHAIN_IDS = [1, 8453, 42161, 10, 137, 43114, 59144, 130, 480, 146, 1329, 50, 57073, 98866, 143, 2818, 81224]

export default function BridgeClient({ initialTab = 'usdc' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const overrides = useMemo(() => ({}), [])

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-6 sm:px-5 md:pt-8">
      <PageHeader title="Bridge" />
      <section aria-label="Bridge" className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex gap-1 border-b border-border p-2" role="tablist" aria-label="What to bridge">
          {(
            [
              ['usdc', 'USDC', 'Circle CCTP'],
              ['unified', 'One balance', 'Circle Gateway'],
              ['any', 'Any token', 'via LI.FI'],
            ] as const
          ).map(([k, l, sub]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                tab === k ? 'bg-secondary' : 'hover:bg-muted',
              )}
            >
              <div className="text-[13.5px] font-semibold">{l}</div>
              <div className="hidden text-[12px] text-ink-3 sm:block">{sub}</div>
            </button>
          ))}
        </div>
        {tab === 'usdc' ? <BridgeCardLazy /> : tab === 'unified' ? <UnifiedCardLazy /> : <LiFiWidgetLazy mode="bridge" overrides={overrides} />}
      </section>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1" aria-label="Chains">
        {CHAIN_IDS.map((id) => (
          <span key={id} className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-card">
            <ChainLogo chainId={id} size={14} />
          </span>
        ))}
      </div>
      <p className="mt-3 text-center text-[13px] text-ink-3">
        Native USDC from {CHAIN_IDS.length} chains, burned and minted by Circle; any other token from {LIFI_CHAIN_COUNT} chains lands as USDC.{' '}
        <Link href="/docs/bridge" className="text-signal-deep underline-offset-4 hover:underline">
          How it works
        </Link>
      </p>
    </div>
  )
}
