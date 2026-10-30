'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowRight, Send, Waypoints } from 'lucide-react'
import { useRecentTips } from '@/lib/payx/useRecentTips'
import { Identity } from '@/components/xylo/Identity'
import { Amount } from '@/components/xylo/Amount'
import { StatusPill } from '@/components/xylo/StatusPill'
import { TokenLogo } from '@/components/ui/TokenLogos'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/format'

type Rates = { usdcToEurc: { rate: number; tool: string | null } | null; updatedAt: number }

const TOOL_NAMES: Record<string, string> = { kyberswap: 'KyberSwap', fly: 'Fly', '1inch': '1inch', uniswap: 'Uniswap', '0x': '0x', openocean: 'OpenOcean' }

function useRates() {
  return useQuery<Rates>({
    queryKey: ['rates'],
    queryFn: async () => {
      const r = await fetch('/api/rates', { cache: 'no-store' })
      if (!r.ok) throw new Error('rates')
      return r.json()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

function Card({ href, icon: Icon, title, children, cta }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; cta: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card outline-none transition-colors hover:border-line-2 focus-visible:ring-3 focus-visible:ring-ring/50">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-secondary text-ink-2">
          <Icon className="size-4" />
        </span>
        <span className="text-[16px] font-semibold">{title}</span>
      </div>
      <div className="mt-4 flex-1">{children}</div>
      <span className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-semibold text-signal-deep">
        {cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

/** The three products as live previews: real rate, real payments, real chain count. */
export function LiveCards() {
  const rates = useRates()
  const { tips, loading } = useRecentTips(3, 30_000)
  const q = rates.data?.usdcToEurc
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card href="/pay" icon={Send} title="Pay" cta="Pay someone">
        <div className="text-[13px] text-ink-3">{tips.length > 0 ? 'Latest, on Arc' : 'To an X handle or any address'}</div>
        <ul className="mt-2 grid gap-2">
          {loading && tips.length === 0 && [0, 1, 2].map((i) => <li key={i}><Skeleton className="h-6" /></li>)}
          {tips.slice(0, 3).map((t) => (
            <li key={t.txHash} className="flex items-center justify-between gap-2">
              <Identity address={t.tipper} handle={t.handle} size="sm" />
              <span className="flex items-baseline gap-1.5">
                <Amount value={Number(t.amount)} size="sm" dollar />
                <span className="text-[11px] text-ink-3">{timeAgo(t.timestamp * 1000)}</span>
              </span>
            </li>
          ))}
          {!loading && tips.length === 0 && <li className="text-[14px] text-ink-2">They claim by signing in with X. No wallet needed on their side.</li>}
        </ul>
      </Card>
      <Card href="/exchange" icon={ArrowLeftRight} title="Exchange" cta="Exchange at this rate">
        <div className="text-[13px] text-ink-3">Live rate</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="inline-flex items-center gap-1.5 text-[14px] text-ink-2">
            <TokenLogo symbol="USDC" size={16} /> 1 USDC
          </span>
          <span className="text-ink-3">=</span>
          <Amount value={q ? q.rate : null} size="lg" format={{ min: 4, max: 4 }} />
          <span className="inline-flex items-center gap-1 text-[13px] text-ink-3">
            <TokenLogo symbol="EURC" size={14} /> EURC
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <StatusPill tone="signal" dot={false}>Instant</StatusPill>
          {q?.tool && <StatusPill tone="neutral" dot={false}>via {TOOL_NAMES[q.tool] ?? q.tool}</StatusPill>}
        </div>
      </Card>
      <Card href="/bridge" icon={Waypoints} title="Bridge" cta="Bring dollars to Arc">
        <div className="text-[13px] text-ink-3">Native USDC, burned and minted by Circle</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="type-display text-[34px]" data-numeric>17</span>
          <span className="text-[14px] text-ink-2">chains in and out</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <StatusPill tone="signal" dot={false}>Instant on arrival</StatusPill>
          <StatusPill tone="neutral" dot={false}>no wrapping</StatusPill>
        </div>
      </Card>
    </div>
  )
}
