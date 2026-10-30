'use client'

import Link from 'next/link'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { ArrowLeftRight, ArrowRight, Download, Send, Sparkles, Waypoints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { Amount } from '@/components/xylo/Amount'
import { Identity } from '@/components/xylo/Identity'
import { StatusPill } from '@/components/xylo/StatusPill'
import { useWallet } from '@/hooks/useWallet'
import { useUsdcBalances } from '@/lib/wallet/useUsdcBalances'
import dynamic from 'next/dynamic'
import { useActivity, eventDetail, eventLabel, eventLink } from '@/lib/activity/useActivity'
import { formatPoints, useWalletPoints } from '@/lib/points/usePoints'
import { chainName } from '@/lib/activity/useActivity'
import { CONTRACTS } from '@/config/constants'
import { ARC_CHAIN_ID } from '@/config/wagmi'
import { formatAmount, timeAgo } from '@/lib/format'

const UnifiedLine = dynamic(() => import('./UnifiedLine').then((m) => m.UnifiedLine), { ssr: false, loading: () => null })

const ICONS = { swap: ArrowLeftRight, bridge: Waypoints, tip_sent: Send, tip_received: Download } as const

/** The dashboard for a connected wallet: one balance, quick actions, what just happened, your points. */
export function Dashboard() {
  const { address, onArc } = useWallet()
  const usdc = useUsdcBalances(address)
  const { data: eurcRaw } = useReadContract({
    address: CONTRACTS.EURC,
    abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 30_000 },
  })
  const eurc = eurcRaw !== undefined ? Number(formatUnits(eurcRaw, 6)) : null
  const activity = useActivity(address)
  const points = useWalletPoints(address)
  const arc = usdc.rows.find((r) => r.chainId === ARC_CHAIN_ID)
  const elsewhere = usdc.rows.filter((r) => r.chainId !== ARC_CHAIN_ID && (r.balance ?? 0) > 0.005)

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-start">
        {/* balance */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="type-eyebrow">Your dollars</div>
            <div className="flex items-center gap-2">
              <Identity address={address!} handle={activity.data?.handle ?? null} size="sm" />
              {onArc ? <StatusPill tone="ok" dot={false}>on Arc</StatusPill> : <StatusPill tone="warn" dot={false}>wallet not on Arc</StatusPill>}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {usdc.anyLoading && usdc.total === 0 ? <Skeleton className="h-16 w-56" /> : <Amount value={usdc.total} size="hero" dollar currency="USDC" />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <ChainLogo chainId={ARC_CHAIN_ID} size={14} /> Arc <span className="font-mono text-foreground" data-numeric>{arc?.balance != null ? formatAmount(arc.balance) : '…'}</span>
            </span>
            {elsewhere.map((r) => (
              <span key={r.chainId} className="inline-flex items-center gap-1.5">
                <ChainLogo chainId={r.chainId} size={14} /> {chainName(r.chainId)} <span className="font-mono text-foreground" data-numeric>{formatAmount(r.balance ?? 0)}</span>
              </span>
            ))}
            <UnifiedLine />
            {eurc != null && eurc > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <TokenLogo symbol="EURC" size={14} /> <span className="font-mono text-foreground" data-numeric>{formatAmount(eurc)}</span> EURC
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" className="h-10 px-4 font-semibold" render={<Link href="/pay" />}>
              <Send data-icon="inline-start" />
              Pay
            </Button>
            <Button size="lg" variant="outline" className="h-10" render={<Link href="/exchange" />}>
              <ArrowLeftRight data-icon="inline-start" />
              Exchange
            </Button>
            <Button size="lg" variant="outline" className="h-10" render={<Link href="/bridge" />}>
              <Waypoints data-icon="inline-start" />
              {elsewhere.length ? 'Bring dollars to Arc' : 'Bridge'}
            </Button>
          </div>
          {elsewhere.length > 0 && (
            <p className="mt-3 text-[12.5px] text-ink-3">
              You hold USDC on {elsewhere.map((r) => chainName(r.chainId)).join(', ')}. Bringing it to Arc takes one bridge and lands instantly.
            </p>
          )}
        </section>

        {/* points */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="type-eyebrow">Points</div>
            <Link href="/points" className="inline-flex items-center gap-1 text-[13px] font-semibold text-signal-deep">
              Leaderboard <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {points.data ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="type-display text-[40px]" data-numeric>
                  {formatPoints(points.data.score.points)}
                </span>
                <span className="text-[13px] text-ink-3">points</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill tone="neutral" dot={false}>{points.data.tier.name}</StatusPill>
                {points.data.score.rank && <StatusPill tone="neutral" dot={false}>rank #{points.data.score.rank}</StatusPill>}
                {points.data.tier.next && (
                  <span className="text-[12.5px] text-ink-3">
                    {formatPoints(points.data.tier.next.remaining)} to {points.data.tier.next.name}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="mt-3 grid gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-ink-3">
            <Sparkles className="mr-1 inline size-3.5 text-signal-deep" />
            One point per dollar you move. Every product counts.
          </p>
        </section>
      </div>

      {/* activity */}
      <section className="mt-6 rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold">Recent</h2>
            {activity.data && <div className="text-[12px] text-ink-3">Updated {timeAgo(activity.data.updatedAt)}</div>}
          </div>
          <Link href="/activity" className="inline-flex items-center gap-1 text-[13px] font-semibold text-signal-deep">
            All activity <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {activity.isLoading ? (
          <div className="grid gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !activity.data || activity.data.events.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-ink-3">Nothing yet. Your first payment, exchange or bridge shows up here the moment it settles.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.data.events.slice(0, 6).map((e) => {
              const Icon = ICONS[e.kind]
              const outgoing = e.kind !== 'tip_received'
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-ink-2">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{eventLabel(e)}</div>
                    <div className="truncate text-[12px] text-ink-3">
                      {eventDetail(e)} · {timeAgo(e.ts * 1000)}
                    </div>
                  </div>
                  <Amount value={outgoing ? -e.usd : e.usd} signed dollar size="md" />
                  <a href={eventLink(e)} target="_blank" rel="noopener noreferrer" className="text-[12px] text-signal-deep hover:underline">
                    tx
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
