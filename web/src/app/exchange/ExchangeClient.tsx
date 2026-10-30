'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExchangeCard } from '@/components/exchange/ExchangeCard'
import { LiFiWidgetLazy } from '@/components/lifi/LiFiWidgetLazy'
import { LIFI_CHAIN_COUNT } from '@/lib/lifi/config'
import { PageHeader } from '@/components/xylo/PageHeader'
import { cn } from '@/lib/utils'

type Tab = 'pair' | 'any'

export function ExchangeClient({ initialTab = 'pair' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const overrides = useMemo(() => ({}), [])

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-6 sm:px-5 md:pt-8">
      <PageHeader title="Exchange" />
      <section aria-label="Exchange" className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex gap-1 border-b border-border p-2" role="tablist" aria-label="What to exchange">
          {(
            [
              ['pair', 'USDC and EURC', 'on Arc, one signature'],
              ['any', 'Any token', `${LIFI_CHAIN_COUNT} chains via LI.FI`],
            ] as const
          ).map(([k, l, sub]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              type="button"
              onClick={() => setTab(k)}
              className={cn('flex-1 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50', tab === k ? 'bg-secondary' : 'hover:bg-muted')}
            >
              <div className="text-[13.5px] font-semibold">{l}</div>
              <div className="hidden text-[12px] text-ink-3 sm:block">{sub}</div>
            </button>
          ))}
        </div>
        {tab === 'pair' ? <ExchangeCard /> : <LiFiWidgetLazy mode="swap" overrides={overrides} />}
      </section>
      <p className="mt-3 text-center text-[13px] text-ink-3">
        Quoted by LI.FI, signed in your wallet, settled instantly on Arc.{' '}
        <Link href="/docs/swap" className="text-signal-deep underline-offset-4 hover:underline">
          How it works
        </Link>
      </p>
    </div>
  )
}
