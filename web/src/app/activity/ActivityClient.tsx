'use client'

import Link from 'next/link'
import { ArrowLeftRight, Download, Inbox, Send, Waypoints } from 'lucide-react'
import { PageHeader } from '@/components/xylo/PageHeader'
import { EmptyState } from '@/components/xylo/EmptyState'
import { Amount } from '@/components/xylo/Amount'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { useWallet } from '@/hooks/useWallet'
import { useActivity, eventDetail, eventLabel, eventLink } from '@/lib/activity/useActivity'
import type { PointsEvent } from '@/lib/points/types'
import { formatDateTime, timeAgo } from '@/lib/format'

const ICONS = { swap: ArrowLeftRight, bridge: Waypoints, tip_sent: Send, tip_received: Download } as const

function dayKey(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function ActivityClient() {
  const { address, isConnected } = useWallet()
  const q = useActivity(address)

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10">
      <PageHeader eyebrow="Activity · Arc" title="Everything you moved." description="Exchanges, bridges, payments and claims made through XyloNet, newest first, rebuilt from public chain and routing data for the wallet you connect." />

      <div className="mt-8 max-w-[760px]">
        {!isConnected ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="text-[15px] text-ink-2">Connect a wallet to see its activity. Nothing is stored on our side; the list is rebuilt from public chain and routing data each time.</p>
            <div className="mt-4">
              <ConnectButton />
            </div>
          </div>
        ) : q.isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : q.isError ? (
          <div className="rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-[14px]" role="alert">
            Could not load activity. Try again in a moment.
          </div>
        ) : q.data && q.data.events.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No activity yet"
            description="Your exchanges, bridges and payments will appear here the moment they settle."
            action={
              <div className="flex gap-2">
                <Button size="sm" render={<Link href="/pay" />}>
                  <Send data-icon="inline-start" />
                  Pay
                </Button>
                <Button size="sm" variant="outline" render={<Link href="/exchange" />}>
                  <ArrowLeftRight data-icon="inline-start" />
                  Exchange
                </Button>
              </div>
            }
          />
        ) : (
          q.data && <ActivityList events={q.data.events} partial={q.data.partial} updatedAt={q.data.updatedAt} />
        )}
      </div>
    </div>
  )
}

function ActivityList({ events, partial, updatedAt }: { events: PointsEvent[]; partial: boolean; updatedAt: number }) {
  const groups = new Map<string, PointsEvent[]>()
  for (const e of events) {
    const k = dayKey(e.ts)
    groups.set(k, [...(groups.get(k) ?? []), e])
  }
  return (
    <div className="grid gap-6">
      <p className="text-[12.5px] text-ink-3">
        Updated {timeAgo(updatedAt)}{partial ? ' · still catching up with recent blocks' : ''}. Bridges made with the USDC card go straight through Circle and are not attributed to XyloNet, so they are not listed.
      </p>
      {[...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <h2 className="type-eyebrow mb-2">{day}</h2>
          <ul className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            {items.map((e) => {
              const Icon = ICONS[e.kind]
              const outgoing = e.kind === 'swap' || e.kind === 'bridge' || e.kind === 'tip_sent'
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-ink-2">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-medium">{eventLabel(e)}</div>
                    <div className="truncate text-[12.5px] text-ink-3">
                      {eventDetail(e)} · <span title={formatDateTime(e.ts * 1000)}>{timeAgo(e.ts * 1000)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Amount value={outgoing ? -e.usd : e.usd} signed dollar size="md" />
                    <a href={eventLink(e)} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-signal-deep hover:underline">
                      receipt
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
