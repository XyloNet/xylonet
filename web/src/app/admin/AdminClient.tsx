'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusPill } from '@/components/xylo/StatusPill'
import { formatInt, formatUsdCompact } from '@/lib/points/usePoints'
import { formatDateTime, shortAddress, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdminAnalytics, Bucket, DailyRow, KeyedBucket, RangeTotals } from '@/lib/admin/analytics'

type Preset = 'today' | '7d' | '30d' | 'all' | 'custom'
const SEASON_START = Math.floor(Date.UTC(2026, 8, 15) / 1000)

function presetRange(p: Preset, custom: { from: string; to: string }): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000)
  if (p === 'today') return { from: Math.floor(now / 86_400) * 86_400, to: now }
  if (p === '7d') return { from: now - 7 * 86_400, to: now }
  if (p === '30d') return { from: now - 30 * 86_400, to: now }
  if (p === 'custom' && custom.from) {
    const from = Math.floor(Date.parse(`${custom.from}T00:00:00Z`) / 1000)
    const to = custom.to ? Math.floor(Date.parse(`${custom.to}T23:59:59Z`) / 1000) : now
    if (Number.isFinite(from) && Number.isFinite(to) && from <= to) return { from, to: Math.min(to, now) }
  }
  return { from: SEASON_START, to: now }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', credentials: 'include', ...init })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body
}

/** Client-side CSV: every table on the page can be taken away. */
function downloadCsv(name: string, rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const usd = (n: number | null | undefined, digits = 2) => (n === null || n === undefined ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`)
const tok = (n: number | null | undefined, sym: string, max = 6) => (n === null || n === undefined ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: max })} ${sym}`)

export function AdminClient({ handle, dev }: { handle: string; dev: boolean }) {
  const qc = useQueryClient()
  const [preset, setPreset] = useState<Preset>('all')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const range = useMemo(() => presetRange(preset, custom), [preset, custom])
  const q = useQuery({
    queryKey: ['admin', 'analytics', range.from, range.to],
    queryFn: () => getJson<AdminAnalytics>(`/api/admin/analytics?from=${range.from}&to=${range.to}`),
    staleTime: 30_000,
    refetchInterval: 120_000,
  })
  const [syncing, setSyncing] = useState<'request' | 'full' | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const runSync = async (mode: 'request' | 'full') => {
    if (mode === 'full' && !window.confirm('Full resync re-reads every LI.FI transfer and PayX event since launch. It takes a few minutes. Continue?')) return
    setSyncing(mode)
    setSyncMsg(null)
    try {
      const r = await getJson<{ report: { ms: number; events: number; lifi: { ok: boolean; added: number; error?: string }; payx: { ok: boolean; added: number; complete: boolean; error?: string } } }>(`/api/admin/sync?mode=${mode}`, { method: 'POST' })
      const p = r.report
      setSyncMsg(`Synced in ${(p.ms / 1000).toFixed(1)} s: ${p.events.toLocaleString('en-US')} events (${p.lifi.added} new LI.FI, ${p.payx.added} new PayX${p.payx.complete ? '' : ', PayX scan still catching up'})${p.lifi.error ? `. LI.FI: ${p.lifi.error}` : ''}${p.payx.error ? `. PayX: ${p.payx.error}` : ''}`)
      await qc.invalidateQueries({ queryKey: ['admin'] })
    } catch (e) {
      setSyncMsg((e as Error).message)
    } finally {
      setSyncing(null)
    }
  }

  const d = q.data

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-6 sm:px-5 md:pt-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="type-eyebrow">Admin · since Sep 16 2026</div>
          <h1 className="type-display mt-1 text-[clamp(26px,4vw,36px)]">Everything on XyloNet, in one place.</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            Signed in as @{handle}
            {dev && ' (development stand-in)'}
            {d && <> · data {timeAgo(d.generatedAt)}</>}
            {d?.health.partial && <> · <span className="text-warn">PayX scan still catching up</span></>}
            {d?.health.stale && <> · <span className="text-warn">a source has not refreshed in 15+ minutes</span></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="lg" className="h-9" disabled={!!syncing} onClick={() => runSync('request')}>
            <RefreshCw data-icon="inline-start" className={cn(syncing === 'request' && 'animate-spin')} />
            {syncing === 'request' ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="ghost" size="lg" className="h-9" disabled={!!syncing} onClick={() => runSync('full')}>
            {syncing === 'full' ? 'Resyncing…' : 'Full resync'}
          </Button>
        </div>
      </header>
      {syncMsg && <p className="mt-3 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] text-ink-2">{syncMsg}</p>}

      {/* range */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(
          [
            ['today', 'Today'],
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['all', 'Since launch'],
            ['custom', 'Custom'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setPreset(k)} aria-pressed={preset === k} className={cn('h-8 rounded-md border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50', preset === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-ink-2 hover:text-foreground')}>
            {l}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
            <input type="date" value={custom.from} min="2026-09-15" onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 rounded-md border border-border bg-card px-2 font-mono text-[12.5px] text-foreground" aria-label="From" />
            to
            <input type="date" value={custom.to} min="2026-09-15" onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 rounded-md border border-border bg-card px-2 font-mono text-[12.5px] text-foreground" aria-label="To" />
          </span>
        )}
        {d && <span className="ml-auto text-[12.5px] text-ink-3">{formatDateTime(d.range.from * 1000)} to {formatDateTime(d.range.to * 1000)} UTC</span>}
      </div>

      {q.isError && <p className="mt-6 rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-[14px]">{(q.error as Error).message}</p>}
      {!d && !q.isError && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {d && (
        <>
          {/* tiles for the selected range */}
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals for the selected range">
            <Tile label="Volume" value={formatUsdCompact(d.ranges.selected.volumeUsd)} sub={`${formatInt(d.ranges.selected.transactions)} transactions`} />
            <Tile label="Wallets" value={formatInt(d.ranges.selected.wallets)} sub={`${formatInt(d.users.newInRange)} new in range`} />
            <Tile label="Fee revenue" value={usd(d.ranges.selected.feeUsd)} sub="LI.FI legs to the Treasury + PayX 1%" />
            <Tile label="Payments" value={formatUsdCompact(d.ranges.selected.flows.tipSent.usd)} sub={`${formatInt(d.ranges.selected.flows.tipSent.count)} tips · ${formatInt(d.ranges.selected.flows.tipReceived.count)} claims`} />
          </section>

          {/* at a glance */}
          <Section title="At a glance" csv={() => downloadCsv('xylonet-glance', (['today', 'd7', 'd30', 'all'] as const).map((k) => glanceRow(k, d.ranges[k])))}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Wallets</TableHead>
                  <TableHead className="text-right">Exchange</TableHead>
                  <TableHead className="text-right">Bridge in</TableHead>
                  <TableHead className="text-right">Bridge out</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ['today', 'Today (UTC)'],
                    ['d7', 'Last 7 days'],
                    ['d30', 'Last 30 days'],
                    ['all', 'Since launch'],
                  ] as const
                ).map(([k, l]) => {
                  const r = d.ranges[k]
                  return (
                    <TableRow key={k}>
                      <TableCell className="font-medium">{l}</TableCell>
                      <Num>{usd(r.volumeUsd, 0)}</Num>
                      <Num>{formatInt(r.transactions)}</Num>
                      <Num>{formatInt(r.wallets)}</Num>
                      <Num>{usd(r.flows.swap.usd, 0)}</Num>
                      <Num>{usd(r.flows.bridgeIn.usd, 0)}</Num>
                      <Num>{usd(r.flows.bridgeOut.usd + r.flows.bridgeOther.usd, 0)}</Num>
                      <Num>{usd(r.flows.tipSent.usd, 0)}</Num>
                      <Num>{usd(r.feeUsd)}</Num>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Section>

          {/* daily chart */}
          <Section title="Volume by day" csv={() => downloadCsv('xylonet-daily', d.daily.map((r) => ({ ...r })))}>
            <DailyChart rows={d.daily} />
          </Section>

          {/* exchange */}
          <Section title="Exchange" csv={() => downloadCsv('xylonet-exchange-tools', d.exchange.byTool.map((b) => ({ tool: b.label, swaps: b.count, volumeUsd: b.usd, feeUsd: b.feeUsd })))}>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label="Swaps on Arc" value={formatInt(d.exchange.swaps.count)} sub={`${usd(d.exchange.swaps.usd, 0)} volume`} />
              <Stat label="Fee earned on swaps" value={usd(d.exchange.swaps.feeUsd)} sub="0.1% of each Arc-origin route" />
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="type-eyebrow">Fee by token (all LI.FI routes)</div>
                <ul className="mt-2 grid gap-1 text-[13.5px]">
                  {d.exchange.feeByToken.length === 0 && <li className="text-ink-3">No fee legs in this range.</li>}
                  {d.exchange.feeByToken.map((t) => (
                    <li key={t.symbol} className="flex justify-between font-mono">
                      <span>{tok(t.amount, t.symbol)}</span>
                      <span className="text-ink-2">{usd(t.usd)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <BucketTable title="By route tool (swaps)" rows={d.exchange.byTool} countLabel="Swaps" />
              <BucketTable title="By source chain (all LI.FI routes)" rows={d.exchange.bySourceChain} countLabel="Transfers" />
            </div>
          </Section>

          {/* bridge */}
          <Section title="Bridge" csv={() => downloadCsv('xylonet-bridge-log', d.bridge.log.recent.map((e) => ({ when: new Date(e.ts * 1000).toISOString(), kind: e.kind, wallet: e.wallet, amountUsd: e.amountUsd, fromChainId: e.fromChainId, toChainId: e.toChainId, txHash: e.txHash ?? '' })))}>
            <div className="grid gap-4 md:grid-cols-2">
              <BucketTable title="Into Arc via LI.FI, by source chain" rows={d.bridge.lifiIn} countLabel="Transfers" />
              <BucketTable title="Out of Arc via LI.FI, by destination" rows={d.bridge.lifiOut} countLabel="Transfers" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="CCTP bridges started here" value={formatInt(d.bridge.log.cctp.count)} sub={`${usd(d.bridge.log.cctp.usd, 0)} · logged since ${formatDateTime(d.bridge.log.since).split(',')[0]}`} />
              <Stat label="Gateway deposits" value={formatInt(d.bridge.log.gatewayDeposits.count)} sub={usd(d.bridge.log.gatewayDeposits.usd, 0)} />
              <Stat label="Gateway spends" value={formatInt(d.bridge.log.gatewaySpends.count)} sub={usd(d.bridge.log.gatewaySpends.usd, 0)} />
            </div>
            {d.bridge.log.cctp.byRoute.length > 0 && <div className="mt-4"><BucketTable title="CCTP routes" rows={d.bridge.log.cctp.byRoute} countLabel="Bridges" noFee /></div>}
            <p className="mt-3 text-[12.5px] text-ink-3">CCTP and Gateway go straight to Circle&apos;s contracts, so they are counted from the moment a user starts one on this site; nothing earlier can be recovered. Store: {d.bridge.log.store}.</p>
          </Section>

          {/* payx */}
          <Section title="PayX" csv={() => downloadCsv('xylonet-payx-handles', d.payx.topHandles.map((h) => ({ handle: h.handle, tips: h.tips, grossUsd: h.grossUsd, linked: h.linked, lastAt: new Date(h.lastAt * 1000).toISOString() })))}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Tips</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Fee (1%)</TableHead>
                    <TableHead className="text-right">Claims</TableHead>
                    <TableHead className="text-right">Claimed</TableHead>
                    <TableHead className="text-right">Unclaimed escrow</TableHead>
                    <TableHead className="text-right">Fees waiting</TableHead>
                    <TableHead className="text-right">Fees withdrawn</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.payx.assets.map((a) => (
                    <TableRow key={a.symbol}>
                      <TableCell className="font-medium">
                        {a.symbol}
                        {a.contract && <div className="font-mono text-[11px] text-ink-3">{shortAddress(a.contract)}</div>}
                      </TableCell>
                      <Num>{formatInt(a.tips)}</Num>
                      <Num>{usd(a.grossUsd)}</Num>
                      <Num>{tok(a.feeAccrued, a.symbol)}</Num>
                      <Num>{formatInt(a.claims)}</Num>
                      <Num>{usd(a.claimedUsd)}</Num>
                      <Num>{tok(a.escrow, a.symbol)}</Num>
                      <Num>{tok(a.feesWaiting, a.symbol)}</Num>
                      <Num>{tok(a.feesWithdrawn, a.symbol)}</Num>
                      <TableCell>
                        {a.solvent === null ? <StatusPill tone="neutral" dot={false}>no read</StatusPill> : a.solvent ? <StatusPill tone="ok" dot={false}>solvent</StatusPill> : <StatusPill tone="bad" dot={false}>shortfall</StatusPill>}
                        {a.paused && <StatusPill tone="warn" dot={false} className="ml-1">paused</StatusPill>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-[12.5px] text-ink-3">
              Tips, gross, claims and fee accrued are from events in the selected range. Escrow and fees waiting are live contract reads; fees withdrawn is everything accrued since launch minus what still waits. Fee {d.payx.feeBps !== null ? `${d.payx.feeBps / 100}%` : '—'}, minimum tip {d.payx.minTip ?? '—'} USDC. {formatInt(d.payx.handlesLinked)} handles have linked a wallet.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Top handles by amount received</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Handle</TableHead>
                    <TableHead className="text-right">Tips</TableHead>
                    <TableHead className="text-right">Received (gross)</TableHead>
                    <TableHead>Claimed before</TableHead>
                    <TableHead className="text-right">Last tip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.payx.topHandles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-ink-3">No payments in this range.</TableCell>
                    </TableRow>
                  )}
                  {d.payx.topHandles.map((h) => (
                    <TableRow key={h.handle}>
                      <TableCell className="font-medium">@{h.handle}</TableCell>
                      <Num>{formatInt(h.tips)}</Num>
                      <Num>{usd(h.grossUsd)}</Num>
                      <TableCell>{h.linked ? <StatusPill tone="ok" dot={false}>yes</StatusPill> : <span className="text-ink-3">not yet</span>}</TableCell>
                      <TableCell className="text-right text-ink-2">{timeAgo(h.lastAt * 1000)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Section>

          {/* treasury + users */}
          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Treasury Safe" csv={() => downloadCsv('xylonet-treasury', [{ address: d.treasury.address, usdc: d.treasury.usdc, eurc: d.treasury.eurc, ...Object.fromEntries(d.treasury.feesWaiting.map((f) => [`payxFeesWaiting_${f.symbol}`, f.amount])) }])}>
              <div className="font-mono text-[12px] text-ink-3">{d.treasury.address}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Stat label="USDC held" value={tok(d.treasury.usdc, 'USDC', 2)} sub="LI.FI fees arrive here directly" />
                <Stat label="EURC held" value={tok(d.treasury.eurc, 'EURC', 2)} sub="from EURC-side routes" />
              </div>
              <div className="mt-3 text-[13px] text-ink-2">
                Waiting in PayX, withdrawable by the Treasury or the Admin Safe:{' '}
                {d.treasury.feesWaiting.length ? d.treasury.feesWaiting.map((f) => <span key={f.symbol} className="font-mono text-foreground">{tok(f.amount, f.symbol)}{' '}</span>) : '—'}
              </div>
            </Section>
            <Section title="Users" csv={() => downloadCsv('xylonet-users-daily', d.daily.map((r) => ({ day: r.day, wallets: r.wallets, newWallets: r.newWallets, returningWallets: r.returningWallets, tx: r.tx })))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="Wallets ever" value={formatInt(d.users.total)} sub={`${formatInt(d.users.withHandle)} with an X handle linked`} />
                <Stat label="Active, 7 and 30 days" value={`${formatInt(d.users.active7)} · ${formatInt(d.users.active30)}`} sub="wallets with at least one action" />
              </div>
              <NewReturning rows={d.daily} />
            </Section>
          </div>

          {/* health */}
          <Section title="Health">
            <dl className="grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
              <Row label="Ledger" value={`${formatInt(d.health.events)} events · store ${d.health.store}`} />
              <Row label="LI.FI source" value={d.health.sync.lifi.error ? <span className="text-bad">{d.health.sync.lifi.error}</span> : `refreshed ${timeAgo(d.health.sync.lifi.updatedAt)}`} />
              <Row label="PayX source" value={d.health.sync.payx.error ? <span className="text-bad">{d.health.sync.payx.error}</span> : `${d.health.sync.payx.complete ? 'at chain head' : 'catching up'} · refreshed ${timeAgo(d.health.sync.payx.updatedAt)} · block ${formatInt(d.health.sync.cursors.payxSyncedBlock)}`} />
              <Row label="Arc RPC" value={d.health.rpc.ok ? `block ${formatInt(d.health.rpc.block ?? 0)}, ${d.health.rpc.ageSeconds ?? '?'} s old` : <span className="text-bad">not responding</span>} />
              <Row label="LI.FI API" value={d.health.lifi.ok ? `responding in ${d.health.lifi.ms} ms` : <span className="text-bad">not responding</span>} />
              <Row label="Circle CCTP" value={d.health.cctp.ok ? `responding in ${d.health.cctp.ms} ms` : <span className="text-bad">not responding</span>} />
              <Row label="Points cron" value={d.health.cron.pointsSync} />
              <Row label="Push cron" value={d.health.cron.pushDispatch} />
              <Row label="Store errors" value={d.health.storeDiagnostics.lastLoadError || d.health.storeDiagnostics.lastSaveError ? <span className="text-bad">{d.health.storeDiagnostics.lastLoadError ?? d.health.storeDiagnostics.lastSaveError}</span> : `none (${d.health.storeDiagnostics.loads} loads, ${d.health.storeDiagnostics.saves} saves this instance)`} />
            </dl>
          </Section>

          <ul className="mt-6 grid gap-1 text-[12.5px] text-ink-3">
            {d.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function glanceRow(period: string, r: RangeTotals) {
  return { period, volumeUsd: r.volumeUsd, transactions: r.transactions, wallets: r.wallets, exchangeUsd: r.flows.swap.usd, bridgeInUsd: r.flows.bridgeIn.usd, bridgeOutUsd: r.flows.bridgeOut.usd + r.flows.bridgeOther.usd, paymentsUsd: r.flows.tipSent.usd, claimsUsd: r.flows.tipReceived.usd, feeUsd: r.feeUsd }
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="type-eyebrow">{label}</div>
      <div className="type-display mt-1 text-[32px]" data-numeric>
        {value}
      </div>
      {sub && <div className="mt-1 text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="type-eyebrow">{label}</div>
      <div className="mt-1 font-mono text-[20px] font-medium" data-numeric>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  )
}

function Section({ title, csv, children }: { title: string; csv?: () => void; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {csv && (
          <Button variant="ghost" size="sm" onClick={csv}>
            <Download data-icon="inline-start" />
            CSV
          </Button>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-line-2 py-1.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right font-mono text-foreground">{value}</dd>
    </div>
  )
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <TableCell className="text-right font-mono" data-numeric>
      {children}
    </TableCell>
  )
}

function BucketTable({ title, rows, countLabel, noFee }: { title: string; rows: KeyedBucket[]; countLabel: string; noFee?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">{countLabel}</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            {!noFee && <TableHead className="text-right">Fee</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={noFee ? 3 : 4} className="py-5 text-center text-ink-3">Nothing in this range.</TableCell>
            </TableRow>
          )}
          {rows.map((b: Bucket & { key: string; label: string }) => (
            <TableRow key={b.key}>
              <TableCell>{b.label}</TableCell>
              <Num>{formatInt(b.count)}</Num>
              <Num>{usd(b.usd, 0)}</Num>
              {!noFee && <Num>{usd(b.feeUsd)}</Num>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

const SERIES: Array<{ key: keyof Pick<DailyRow, 'swap' | 'bridgeIn' | 'bridgeOut' | 'pay'>; label: string; color: string }> = [
  { key: 'swap', label: 'Exchange on Arc', color: 'var(--chart-1)' },
  { key: 'bridgeIn', label: 'Bridged in', color: 'var(--chart-2)' },
  { key: 'bridgeOut', label: 'Bridged out', color: 'var(--chart-4)' },
  { key: 'pay', label: 'Payments', color: 'var(--chart-5)' },
]

/** Stacked daily volume, drawn by hand so the page carries no chart library. */
function DailyChart({ rows }: { rows: DailyRow[] }) {
  const W = 760
  const H = 260
  const left = 52
  const top = 16
  const bottom = 34
  const plotH = H - top - bottom
  const plotW = W - left - 12
  const peak = Math.max(1, ...rows.map((r) => r.swap + r.bridgeIn + r.bridgeOut + r.pay))
  const band = plotW / Math.max(1, rows.length)
  const y = (v: number) => top + plotH - (v / peak) * plotH
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => f * peak)
  const labelEvery = rows.length > 40 ? 7 : rows.length > 14 ? 3 : 1
  const total = rows.reduce((s, r) => s + r.swap + r.bridgeIn + r.bridgeOut + r.pay, 0)
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <span>{usd(total, 0)} across {rows.length} day{rows.length === 1 ? '' : 's'}</span>
        <span className="flex flex-wrap gap-3">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Volume by day, stacked by product" fontSize="11">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" fill="var(--ink-3)">
              {t >= 1000 ? `$${(t / 1000).toFixed(1)}K` : `$${Math.round(t)}`}
            </text>
          </g>
        ))}
        <line x1={left} x2={left + plotW} y1={top + plotH} y2={top + plotH} stroke="var(--line-2)" />
        {rows.map((r, i) => {
          let acc = 0
          const x = left + i * band + band * 0.12
          const w = Math.max(1, band * 0.76)
          const sum = r.swap + r.bridgeIn + r.bridgeOut + r.pay
          return (
            <g key={r.day}>
              {SERIES.map((s) => {
                const v = r[s.key]
                const y1 = y(acc + v)
                const h = y(acc) - y1
                acc += v
                return v > 0 ? <rect key={s.key} x={x} y={y1} width={w} height={h} fill={s.color} /> : null
              })}
              <rect x={left + i * band} y={top} width={band} height={plotH} fill="transparent">
                <title>{`${r.day}: ${usd(sum, 0)} in ${r.tx} transactions, ${r.wallets} wallets (${r.newWallets} new) · fees ${usd(r.feeUsd)}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={left + i * band + band / 2} y={H - 14} textAnchor="middle" fill="var(--ink-3)">
                  {r.day.slice(5)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function NewReturning({ rows }: { rows: DailyRow[] }) {
  const last = rows.slice(-14)
  const peak = Math.max(1, ...last.map((r) => r.wallets))
  return (
    <div className="mt-4">
      <div className="text-[12.5px] text-ink-3">Wallets per day, last {last.length} days of the range: new (signal) and returning (grey)</div>
      <svg viewBox="0 0 760 120" className="mt-2 w-full" role="img" aria-label="New and returning wallets per day" fontSize="11">
        {last.map((r, i) => {
          const band = 760 / Math.max(1, last.length)
          const x = i * band + band * 0.15
          const w = band * 0.7
          const hn = (r.newWallets / peak) * 90
          const hr = (r.returningWallets / peak) * 90
          return (
            <g key={r.day}>
              <rect x={x} y={100 - hr} width={w} height={hr} fill="var(--chart-5)" />
              <rect x={x} y={100 - hr - hn} width={w} height={hn} fill="var(--chart-1)" />
              <rect x={i * band} y={0} width={band} height={100} fill="transparent">
                <title>{`${r.day}: ${r.newWallets} new, ${r.returningWallets} returning`}</title>
              </rect>
              <text x={i * band + band / 2} y={114} textAnchor="middle" fill="var(--ink-3)">
                {r.day.slice(5)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
