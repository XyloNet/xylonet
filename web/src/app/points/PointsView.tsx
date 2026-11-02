'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { isAddress } from 'viem'
import { ArrowLeftRight, Download, Search, Send, Share2, Waypoints } from 'lucide-react'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Identity } from '@/components/xylo/Identity'
import { StatusPill } from '@/components/xylo/StatusPill'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { useWallet } from '@/hooks/useWallet'
import { formatInt, formatPoints, formatUsdCompact, useLeaderboard, usePointsRules, useWalletPoints } from '@/lib/points/usePoints'
import { eventDetail, eventLabel, eventLink } from '@/lib/activity/useActivity'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')
const ICONS = { swap: ArrowLeftRight, bridge: Waypoints, tip_sent: Send, tip_received: Download } as const

/** Tier chip. Colour comes from the rules API so the token file stays the only source in code. */
function TierBadge({ name, color, size = 'sm' }: { name: string; color?: string; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-sm border font-semibold', size === 'lg' ? 'h-8 px-3 text-[14px]' : 'h-6 px-2 text-[12px]')}
      style={color ? { borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` } : undefined}
    >
      <span className="size-1.5 rounded-full bg-current" style={color ? { background: color } : undefined} aria-hidden />
      {name}
    </span>
  )
}

function Ring({ fraction, color }: { fraction: number; color?: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fraction))
  return (
    <svg viewBox="0 0 80 80" className="size-20" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line-2)" strokeWidth="6" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color ?? 'var(--signal)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform="rotate(-90 40 40)" />
    </svg>
  )
}

const noSubscribe = () => () => {}
/** Current time in seconds, stable within a minute so boosts render without an impure read. */
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60

export function PointsView() {
  const { address } = useWallet()
  const [lookup, setLookup] = useState('')
  const [looked, setLooked] = useState<string | null>(null)
  const rules = usePointsRules()
  const target = looked ?? address ?? null
  const boosts = rules.data?.rules.boosts ?? []
  const now = useSyncExternalStore(noSubscribe, minuteNow, () => 0)
  const liveBoost = boosts.find((b) => b.from <= now && now <= b.to)

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-6 sm:px-5 md:pt-8">
      <PageHeader
        title="Points"
        actions={
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (isAddress(lookup.trim())) setLooked(lookup.trim().toLowerCase())
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Look up any wallet" aria-label="Look up any wallet" className="h-9 w-56 pl-8 font-mono text-[13px] sm:w-72" />
            </div>
            <Button size="lg" className="h-9" variant="outline" disabled={!isAddress(lookup.trim())} type="submit">
              Check
            </Button>
            {looked && (
              <Button size="lg" className="h-9" variant="ghost" type="button" onClick={() => { setLooked(null); setLookup('') }}>
                Mine
              </Button>
            )}
          </form>
        }
      />

      <p className="mt-2 text-[14px] text-ink-2">
        One point for every dollar you move on Arc, computed from public data.{' '}
        <Link href="/docs/points" className="text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current">
          How points work
        </Link>
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        {target ? (
          <WalletCard address={target} isYou={!!address && target === address.toLowerCase()} liveBoost={liveBoost} />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="type-eyebrow">Your points</div>
            <p className="mt-2 text-[15px] text-ink-2">Connect to see your points, rank and tier. Everything since launch is already counted.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ConnectButton />
              {liveBoost && <StatusPill tone="signal">{liveBoost.name} ×{liveBoost.multiplier} live</StatusPill>}
            </div>
          </div>
        )}
        <Leaderboard me={address ?? null} />
      </div>
    </div>
  )
}

function WalletCard({ address, isYou, liveBoost }: { address: string; isYou: boolean; liveBoost?: { name: string; multiplier: number } }) {
  const { data, isLoading, isError } = useWalletPoints(address)
  const share = useMemo(() => {
    if (!data) return null
    const text = `${formatPoints(data.score.points)} XyloNet points on Arc, ${data.tier.name} tier${data.score.rank ? `, rank #${data.score.rank}` : ''}. Every dollar you move counts.`
    return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${APP_URL}/points`)}`
  }, [data])

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        {isError ? <p className="text-[14px] text-bad">Could not load points for this wallet.</p> : <><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-14 w-48" /><Skeleton className="mt-4 h-24 w-full" /></>}
      </div>
    )
  }
  const s = data.score
  const nextMin = data.tier.next?.min ?? null
  const frac = nextMin ? (s.points - data.tier.min) / (nextMin - data.tier.min) : 1
  const rows: Array<[string, number, string]> = [
    ['Exchanges', s.breakdown.swap, `${formatUsdCompact(s.volumeUsd.swap)} · ${formatInt(s.counts.swap)} tx`],
    ['Bridges', s.breakdown.bridge, `${formatUsdCompact(s.volumeUsd.bridge)} · ${formatInt(s.counts.bridge)} tx`],
    ['Payments sent', s.breakdown.tipsSent, `${formatUsdCompact(s.volumeUsd.tipsSent)} · ${formatInt(s.counts.tipsSent)} tx`],
    ['Claims', s.breakdown.tipsReceived, `${formatUsdCompact(s.volumeUsd.tipsReceived)} · ${formatInt(s.counts.tipsReceived)} tx`],
    ['Activity', s.breakdown.activity, 'per transaction'],
    ['Bonuses', s.breakdown.bonuses, 'first-time'],
  ]
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="type-eyebrow">{isYou ? 'Your points' : 'Wallet points'}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="type-display text-[clamp(40px,6vw,56px)]" data-numeric>
              {formatPoints(s.points)}
            </span>
            <span className="text-[14px] text-ink-3">points</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Identity address={address} handle={s.handle} size="sm" />
            {isYou && <StatusPill tone="neutral" dot={false}>you</StatusPill>}
            {s.rank && <StatusPill tone="neutral" dot={false}>rank #{s.rank}</StatusPill>}
            {liveBoost && <StatusPill tone="signal">{liveBoost.name} ×{liveBoost.multiplier}</StatusPill>}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative">
            <Ring fraction={frac} color={data.tier.color} />
            <div className="absolute inset-0 grid place-items-center text-center">
              <span className="text-[11px] font-semibold text-foreground">{data.tier.name}</span>
            </div>
          </div>
          <span className="text-[11.5px] text-ink-3">{data.tier.next ? `${formatPoints(data.tier.next.remaining)} to ${data.tier.next.name}` : 'top tier'}</span>
        </div>
      </div>

      {data.excluded && <p className="mt-3 rounded-md border border-warn/30 bg-warn-tint px-3 py-2 text-[13px]">This is a XyloNet operational wallet: indexed, but not ranked and earns no points.</p>}

      <div className="mt-5 grid gap-2">
        {rows.map(([label, pts, sub]) => (
          <div key={label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13px]">
            <span className="text-ink-2">{label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-signal" style={{ width: `${(pts / max) * 100}%` }} />
            </span>
            <span className="text-right">
              <span className="font-mono" data-numeric>{formatPoints(pts)}</span>
              <span className="ml-2 text-[11.5px] text-ink-3">{sub}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-3">
        <span>
          {formatUsdCompact(s.volumeUsd.total)} moved · {formatInt(s.counts.total)} transactions · {formatInt(s.activeDays)} active days
        </span>
        {share && isYou && (
          <Button size="sm" variant="outline" render={<a href={share} target="_blank" rel="noopener noreferrer" />}>
            <Share2 data-icon="inline-start" />
            Share
          </Button>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="type-eyebrow">Recent</div>
        {data.recent.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-ink-3">
            No point-earning activity yet. <Link href="/pay" className="text-signal-deep">Pay</Link>, <Link href="/exchange" className="text-signal-deep">exchange</Link> or <Link href="/bridge" className="text-signal-deep">bridge</Link> to start.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {data.recent.slice(0, 8).map((e) => {
              const Icon = ICONS[e.kind]
              return (
                <li key={e.id} className="flex items-center gap-2.5 text-[13px]">
                  <Icon className="size-3.5 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{eventLabel(e)}</span> <span className="text-ink-3">· {eventDetail(e)} · {timeAgo(e.ts * 1000)}</span>
                  </span>
                  <span className="font-mono text-signal-deep" data-numeric>+{formatPoints(e.points)}</span>
                  <a href={eventLink(e)} target="_blank" rel="noopener noreferrer" className="text-[12px] text-signal-deep hover:underline">tx</a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Leaderboard({ me }: { me: string | null }) {
  const { data, isLoading, isError } = useLeaderboard(100, me)
  const meRow = data?.me
  const meInTop = !!meRow && data!.entries.some((e) => e.wallet === meRow.wallet)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold">Leaderboard</h2>
          <div className="text-[12px] text-ink-3">Top 100 by points{data ? ` · updated ${timeAgo(data.updatedAt)}` : ''}{data?.partial ? ' · catching up' : ''}</div>
        </div>
        {meRow && <span className="text-[12.5px] text-ink-2">You are #{meRow.rank} with <span className="font-mono">{formatPoints(meRow.points)}</span></span>}
      </div>
      {isLoading ? (
        <div className="grid gap-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="p-5 text-[14px] text-bad">Could not load the leaderboard.</p>
      ) : (
        <div className="max-h-[640px] overflow-auto" tabIndex={0} aria-label="Leaderboard, scrollable">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead className="hidden sm:table-cell">Tier</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meRow && !meInTop && <Row row={meRow} isYou pinned />}
              {data.entries.map((r) => (
                <Row key={r.wallet} row={r} isYou={!!meRow && r.wallet === meRow.wallet} />
              ))}
              {data.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-ink-3">No ranked wallets yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Row({ row, isYou, pinned }: { row: { rank: number | null; wallet: string; handle: string | null; tier: string; points: number }; isYou?: boolean; pinned?: boolean }) {
  const medal = row.rank === 1 ? 'text-warn' : row.rank === 2 ? 'text-ink-2' : row.rank === 3 ? 'text-signal-deep' : 'text-ink-3'
  return (
    <TableRow className={cn(isYou && 'bg-signal-tint/60', pinned && 'border-b-2 border-signal/40')}>
      <TableCell className={cn('font-mono', medal)} data-numeric>{row.rank ?? '—'}</TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <Identity address={row.wallet} handle={row.handle} size="sm" />
          {isYou && <StatusPill tone="neutral" dot={false}>you</StatusPill>}
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell"><TierBadge name={row.tier} /></TableCell>
      <TableCell className="text-right font-mono" data-numeric>{formatPoints(row.points)}</TableCell>
    </TableRow>
  )
}
