'use client'

import Link from 'next/link'
import { useRecentTips } from '@/lib/payx/useRecentTips'
import { Identity } from '@/components/xylo/Identity'
import { Amount } from '@/components/xylo/Amount'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/format'
import { ARC_EXPLORER_URL } from '@/config/wagmi'
import { PAYX_ASSETS } from '@/config/constants'

/** The last few payments to handles, read from TipSent events on Arc. */
export function RecentPayments() {
  const { tips, loading, partial } = useRecentTips(6, 20_000)
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="type-eyebrow">Recent, on Arc</div>
        {partial && <span className="text-[12px] text-ink-3">catching up…</span>}
      </div>
      <ul className="mt-3 grid gap-2.5">
        {loading && tips.length === 0 &&
          Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        {tips.slice(0, 6).map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3">
            <a href={`${ARC_EXPLORER_URL}/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer" className="min-w-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/80">
              <Identity address={t.tipper} handle={t.handle} size="sm" />
            </a>
            <span className="flex shrink-0 items-baseline gap-2">
              <Amount value={Number(t.amount)} size="sm" dollar={t.asset === 'USDC'} currency={t.asset === 'USDC' ? undefined : t.symbol} format={PAYX_ASSETS[t.asset].fractionDigits} />
              <span className="text-[11.5px] text-ink-3">{timeAgo(t.timestamp * 1000)}</span>
            </span>
          </li>
        ))}
        {!loading && tips.length === 0 && (
          <li className="text-[13.5px] text-ink-3">
            Nothing in the last few hours. <Link href="/pay" className="text-signal-deep">Be first.</Link>
          </li>
        )}
      </ul>
    </div>
  )
}
