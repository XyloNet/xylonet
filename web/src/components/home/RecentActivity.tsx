'use client'

import Link from 'next/link'
import { ArrowLeftRight, ArrowRight, Download, Send, Waypoints } from 'lucide-react'
import { Amount } from '@/components/xylo/Amount'
import { StatusPill } from '@/components/xylo/StatusPill'
import { Skeleton } from '@/components/ui/skeleton'
import { useWallet } from '@/hooks/useWallet'
import { useActivity, eventDetail, eventLabel, eventLink } from '@/lib/activity/useActivity'
import { useRecentTips } from '@/lib/payx/useRecentTips'
import { PAYX_ASSETS } from '@/config/constants'
import { formatDateTime, timeAgo } from '@/lib/format'

const LIMIT = 5
const ICONS = { swap: ArrowLeftRight, bridge: Waypoints, tip_sent: Send, tip_received: Download } as const

/**
 * "Recent activity" on the home: a connected wallet sees its own latest
 * actions (the per-wallet feed behind /activity); a visitor sees the latest
 * payments on Arc (the public feed behind /pay). Each branch mounts only its
 * own hook, so nothing polls that is not on screen.
 */
export function RecentActivity() {
  const { address, isConnected, status } = useWallet()
  // While wagmi restores a previous session, hold the frame without picking a feed.
  if (status === 'reconnecting') {
    return (
      <Frame>
        <SkeletonRows />
      </Frame>
    )
  }
  return isConnected && address ? <WalletActivity address={address} /> : <PublicActivity />
}

function Frame({ viewAllHref, lede, children }: { viewAllHref?: string; lede?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby="recent-activity" className="mx-auto max-w-[1120px] px-4 pb-16 pt-10 sm:px-5 md:pt-12 lg:pt-20 lg:pb-28">
      <div className="max-w-[760px] lg:grid lg:max-w-none lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start lg:gap-x-16">
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-3">
          <h2 id="recent-activity" className="text-[17px] font-semibold text-foreground lg:text-[28px] lg:font-extrabold lg:leading-[1.1] lg:tracking-[-0.025em]">
            Recent activity
          </h2>
          {lede && <p className="hidden text-[15px] leading-[1.5] text-ink-2 lg:block">{lede}</p>}
          {viewAllHref && (
            <Link href={viewAllHref} className="inline-flex items-center gap-1 rounded-md text-[13.5px] font-semibold text-signal-deep outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/80">
              View all <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:mt-0">{children}</div>
      </div>
    </section>
  )
}

function Rows({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border">{children}</ul>
}

function SkeletonRows() {
  return (
    <div className="grid gap-2 p-4" role="status" aria-busy>
      <span className="sr-only">Loading recent activity</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  )
}

function IconWell({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-signal-tint text-signal-deep lg:size-10">
      <Icon className="size-4" />
    </span>
  )
}

/** The connected wallet's latest actions, rendered the way the account page renders them. */
function WalletActivity({ address }: { address: string }) {
  const activity = useActivity(address)
  const events = activity.data?.events.slice(0, LIMIT) ?? []
  return (
    <Frame viewAllHref="/activity" lede="Your exchanges, bridges, payments and claims through XyloNet, newest first.">
      {activity.isLoading ? (
        <SkeletonRows />
      ) : activity.isError ? (
        <p className="px-4 py-5 text-[14px] text-ink-3 sm:px-5">Could not load activity. Try again in a moment.</p>
      ) : events.length === 0 ? (
        <p className="px-4 py-5 text-[14px] text-ink-3 sm:px-5 lg:px-6 lg:py-6">
          No activity yet.<span className="hidden lg:inline"> Your first payment, exchange or bridge shows up here within a minute or so of settling.</span>
        </p>
      ) : (
        <Rows>
          {events.map((e) => {
            const outgoing = e.kind !== 'tip_received'
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5 lg:grid lg:grid-cols-[40px_minmax(0,1fr)_auto_auto] lg:gap-x-5 lg:px-6 lg:py-3.5">
                <IconWell icon={ICONS[e.kind]} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-foreground">{eventLabel(e)}</div>
                  <div className="truncate text-[12.5px] text-ink-3">
                    {eventDetail(e)}<span className="lg:hidden"> · {timeAgo(e.ts * 1000)}</span>
                  </div>
                </div>
                <span className="hidden font-mono text-[12.5px] text-ink-3 lg:block" data-numeric title={formatDateTime(e.ts * 1000)}>
                  {timeAgo(e.ts * 1000)}
                </span>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <Amount value={outgoing ? -e.usd : e.usd} signed dollar size="md" />
                  <a href={eventLink(e)} target="_blank" rel="noopener noreferrer" className="rounded-sm text-[12px] text-signal-deep outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/80">
                    tx
                  </a>
                </div>
              </li>
            )
          })}
        </Rows>
      )}
    </Frame>
  )
}

/** The latest payments to handles on Arc, for visitors. Says so quietly when the feed is empty. */
function PublicActivity() {
  const { tips, loading } = useRecentTips(LIMIT, 30_000)
  return (
    <Frame lede="Payments to X handles, as they settle on Arc. Refreshes every 30 seconds.">
      {loading && tips.length === 0 ? (
        <SkeletonRows />
      ) : tips.length === 0 ? (
        <p className="px-4 py-5 text-[14px] text-ink-3 sm:px-5">No payments yet.</p>
      ) : (
        <Rows>
          {tips.slice(0, LIMIT).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5 lg:grid lg:grid-cols-[40px_minmax(0,1fr)_auto_auto] lg:gap-x-5 lg:px-6 lg:py-3.5">
              <IconWell icon={Send} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-foreground">{t.handle ? `Payment to @${t.handle}` : 'Payment'}</div>
                <div className="truncate text-[12.5px] text-ink-3">
                  {t.symbol} on Arc<span className="lg:hidden"> · {timeAgo(t.timestamp * 1000)}</span>
                </div>
              </div>
              <span className="hidden font-mono text-[12.5px] text-ink-3 lg:block" data-numeric title={formatDateTime(t.timestamp * 1000)}>
                {timeAgo(t.timestamp * 1000)}
              </span>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Amount value={Number(t.amount)} size="md" dollar={t.asset === 'USDC'} currency={t.asset === 'USDC' ? undefined : t.symbol} format={PAYX_ASSETS[t.asset].fractionDigits} />
                <StatusPill tone="ok">Settled</StatusPill>
              </div>
            </li>
          ))}
        </Rows>
      )}
    </Frame>
  )
}
