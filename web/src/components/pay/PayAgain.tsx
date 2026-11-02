'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Amount } from '@/components/xylo/Amount'
import { ExplainerBlock } from '@/components/xylo/Explainer'
import { useWallet } from '@/hooks/useWallet'
import { useIsLg } from '@/hooks/useIsLg'
import { useActivity } from '@/lib/activity/useActivity'
import type { PointsEvent } from '@/lib/points/types'
import { timeAgo } from '@/lib/format'

type PaidHandle = PointsEvent & { handle: string }

const isPaidHandle = (e: PointsEvent): e is PaidHandle => e.kind === 'tip_sent' && !!e.handle

/**
 * "Pay again" in the Pay aside: the connected wallet's last five unique handles
 * it has paid, newest first. Renders nothing for visitors, during reconnecting,
 * while loading, on error, or when there is nothing to list (no empty state).
 */
export function PayAgain() {
  const { address, isConnected, status } = useWallet()
  const isLg = useIsLg()
  // The block only renders from lg up, so the query is disabled below it (and for visitors, whose address is empty).
  const activity = useActivity(isConnected && isLg ? address : undefined)
  if (status !== 'connected' || !activity.data) return null
  const seen = new Set<string>()
  const rows: PaidHandle[] = []
  for (const e of activity.data.events) {
    // The API returns newest first.
    if (!isPaidHandle(e) || seen.has(e.handle)) continue
    seen.add(e.handle)
    rows.push(e)
    if (rows.length === 5) break
  }
  if (rows.length === 0) return null
  return (
    <ExplainerBlock eyebrow="Pay again">
      <ul className="mt-3 divide-y divide-border">
        {rows.map((e) => (
          <li key={e.id}>
            <Link
              href={`/pay?to=${encodeURIComponent(e.handle)}`}
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/80"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-foreground">
                  <span className="sr-only">Pay again: </span>@{e.handle}
                </span>
                <span className="block text-[12px] text-ink-3">{timeAgo(e.ts * 1000)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Amount value={e.usd} size="sm" dollar />
                <ArrowRight className="size-3.5 text-ink-3" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </ExplainerBlock>
  )
}
