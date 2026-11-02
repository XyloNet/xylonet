'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Explainer, ExplainerBlock, ExplainerLinks, ExplainerSteps } from '@/components/xylo/Explainer'
import { BridgeCardLazy, UnifiedCardLazy } from '@/components/bridge/BridgeLazy'
import { LiFiWidgetLazy } from '@/components/lifi/LiFiWidgetLazy'
import { LIFI_CHAIN_COUNT } from '@/lib/lifi/config'
import { CHAIN_LOGOS, ChainLogo } from '@/components/ui/TokenLogos'
import { cn } from '@/lib/utils'

type Tab = 'usdc' | 'unified' | 'any'

const TABS: readonly { key: Tab; label: string; sub: string }[] = [
  { key: 'usdc', label: 'USDC', sub: 'Circle CCTP' },
  { key: 'unified', label: 'One balance', sub: 'Circle Gateway' },
  { key: 'any', label: 'Any token', sub: 'via LI.FI' },
]

const CHAIN_IDS = [1, 8453, 42161, 10, 137, 43114, 59144, 130, 480, 146, 1329, 50, 57073, 98866, 143, 2818, 81224]

/** Desktop aside copy, by tab. Timings match expectedTime() in lib/bridge/chains.ts. */
const STEPS: Record<Tab, string[]> = {
  usdc: [
    'Choose the chain and the amount. The Circle CCTP fee and the amount that arrives are quoted before you sign.',
    'Your USDC is burned on the source chain and minted on the destination by Circle. Nothing is wrapped or pooled.',
    'Into Arc: under a minute on Fast, about 15 minutes on Standard. Out of Arc: seconds on Fast, about a minute on Standard. A transfer that stops can be resumed from this page.',
  ],
  unified: [
    'Deposit USDC from any Gateway chain into one balance held under your address.',
    'Spending is a signature, not a bridge: Circle attests the burn intent and mints on the destination. Deposits are spendable after the source chain reaches finality.',
    "Your USDC sits in Circle's Gateway contract, never with XyloNet.",
  ],
  any: [
    `Any token from ${LIFI_CHAIN_COUNT} chains, routed by LI.FI across bridges and exchanges.`,
    'It lands as USDC on Arc. Fees and the expected time are in the quote before you sign.',
    'Cross-chain routes finish when the bridge leg settles; the card shows each step.',
  ],
}
const USDC_CHAINS_SENTENCE = `Native USDC from ${CHAIN_IDS.length} chains, burned and minted by Circle. Where Fast is not offered, the card uses Standard.`
const ANY_CHAINS_SENTENCE = `Any token from ${LIFI_CHAIN_COUNT} chains, Arc included, lands on Arc as USDC.`

export default function BridgeClient({ initialTab = 'usdc' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const overrides = useMemo(() => ({}), [])

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-6 sm:px-5 md:pt-8 lg:grid lg:max-w-[1120px] lg:grid-cols-[560px_minmax(0,360px)] lg:items-start lg:justify-start lg:gap-x-16 lg:pt-14 lg:pb-28">
      <PageHeader title="Bridge" description="Move dollars between Arc and other chains." className="lg:col-span-2 lg:mb-8" />

      <div className="lg:col-start-1 lg:row-start-2">
        {/* what to bridge: a compact segmented control, one line on a phone */}
        <div role="tablist" aria-label="What to bridge" className="mt-5 grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary p-1 lg:mt-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              id={`bridge-tab-${t.key}`}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              aria-controls="bridge-panel"
              onClick={() => setTab(t.key)}
              className={cn(
                'min-w-0 rounded-lg px-2 py-1.5 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/80',
                tab === t.key ? 'bg-card text-foreground ring-1 ring-border' : 'text-ink-2 hover:text-foreground',
              )}
            >
              <span className="block truncate text-[13px] font-semibold leading-5">{t.label}</span>
              <span className="hidden truncate text-[11px] leading-4 text-ink-3 sm:block">{t.sub}</span>
            </button>
          ))}
        </div>

        <section id="bridge-panel" role="tabpanel" aria-labelledby={`bridge-tab-${tab}`} className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {tab === 'usdc' ? <BridgeCardLazy /> : tab === 'unified' ? <UnifiedCardLazy /> : <LiFiWidgetLazy mode="bridge" overrides={overrides} />}
        </section>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1 lg:hidden" aria-label="Chains">
          {CHAIN_IDS.map((id) => (
            <span key={id} className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-card">
              <ChainLogo chainId={id} size={14} />
            </span>
          ))}
        </div>
        <p className="mt-3 text-center text-[13px] text-ink-3 lg:hidden">
          Native USDC from {CHAIN_IDS.length} chains, burned and minted by Circle; any other token from {LIFI_CHAIN_COUNT} chains lands as USDC.{' '}
          <Link href="/docs/bridge" className="text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current">
            How it works
          </Link>
        </p>
      </div>

      <Explainer label="About bridging">
        <ExplainerBlock eyebrow="How it works">
          <ExplainerSteps steps={STEPS[tab]} />
          <ExplainerLinks links={[{ href: '/docs/bridge', label: 'How bridging works' }]} />
        </ExplainerBlock>
        {tab !== 'unified' && (
          <ExplainerBlock eyebrow="Chains">
            <div className="mt-3 flex flex-wrap gap-1" aria-label="Chains">
              {CHAIN_IDS.map((id) => (
                <span key={id} title={CHAIN_LOGOS[id]?.name} className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-card">
                  <ChainLogo chainId={id} size={14} />
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-ink-3">{tab === 'usdc' ? USDC_CHAINS_SENTENCE : ANY_CHAINS_SENTENCE}</p>
          </ExplainerBlock>
        )}
      </Explainer>
    </div>
  )
}
