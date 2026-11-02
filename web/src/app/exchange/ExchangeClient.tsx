'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExchangeCard } from '@/components/exchange/ExchangeCard'
import { LiFiWidgetLazy } from '@/components/lifi/LiFiWidgetLazy'
import { LIFI_CHAIN_COUNT } from '@/lib/lifi/config'
import { formatPercent } from '@/lib/format'
import { LIFI } from '@/config/constants'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Explainer, ExplainerBlock, ExplainerLinks, ExplainerSteps } from '@/components/xylo/Explainer'
import { cn } from '@/lib/utils'

type Tab = 'pair' | 'any'

/** Desktop aside copy, by tab. */
const PAIR_STEPS = [
  'Enter an amount. LI.FI quotes the route; the rate, the minimum you receive and the fees show before you sign.',
  'Confirm in your wallet. Approve and exchange are batched into one signature where the wallet allows it, otherwise two.',
  "The exchange runs from your wallet through LI.FI's contract on Arc and lands in the same wallet. Settlement on Arc is instant. XyloNet never holds your funds.",
]
const ANY_STEPS = [
  'Pick the tokens, the chains and an amount. LI.FI quotes a route across exchanges and bridges, with fees and expected time, before you sign.',
  'Confirm in your wallet. Same-chain exchanges on Arc settle instantly; cross-chain routes finish when the bridge leg settles.',
  'Tokens land in your wallet. XyloNet never holds your funds.',
]

/** Derived from the constant the widget's calculateFee and the pair quote read; never typed. */
/** The integrator fee the quote and the widget both read, as a percentage; null when no fee is configured. */
const feePct = Number.isFinite(LIFI.fee) && LIFI.fee > 0 ? formatPercent(LIFI.fee) : null

export function ExchangeClient({ initialTab = 'pair' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const overrides = useMemo(() => ({}), [])

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-6 sm:px-5 md:pt-8 lg:grid lg:max-w-[1120px] lg:grid-cols-[560px_minmax(0,360px)] lg:items-start lg:justify-start lg:gap-x-16 lg:pt-14 lg:pb-28">
      <PageHeader title="Exchange" className="lg:col-span-2 lg:mb-8" />
      <section aria-label="Exchange" className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:col-start-1 lg:row-start-2 lg:mt-0">
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
              className={cn('flex-1 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/80', tab === k ? 'bg-secondary' : 'hover:bg-muted')}
            >
              <div className="text-[13.5px] font-semibold">{l}</div>
              <div className="hidden text-[12px] text-ink-3 sm:block">{sub}</div>
            </button>
          ))}
        </div>
        {tab === 'pair' ? <ExchangeCard /> : <LiFiWidgetLazy mode="swap" overrides={overrides} />}
      </section>
      <p className="mt-3 text-center text-[13px] text-ink-3 lg:hidden">
        Quoted by LI.FI, signed in your wallet, settled instantly on Arc.{' '}
        <Link href="/docs/swap" className="text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current">
          How it works
        </Link>
      </p>
      <Explainer label="About exchanging">
        <ExplainerBlock eyebrow="How it works">
          <ExplainerSteps steps={tab === 'pair' ? PAIR_STEPS : ANY_STEPS} />
          <ExplainerLinks links={[{ href: '/docs/swap', label: 'How exchange works' }]} />
        </ExplainerBlock>
        <ExplainerBlock eyebrow="Fees">
          <p className="mt-3 text-[14px] leading-[1.55] text-ink-2">
            Venue fees are set by the route and included in the quote.{feePct ? ` XyloNet adds ${feePct} on routes that start on Arc, shown before you sign.` : ''}
          </p>
        </ExplainerBlock>
      </Explainer>
    </div>
  )
}
