import type { Metadata } from 'next'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Address } from '@/components/xylo/Address'
import { Amount } from '@/components/xylo/Amount'
import { StatusPill } from '@/components/xylo/StatusPill'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { Button } from '@/components/ui/button'
import { readTrust } from '@/lib/trust/status'
import { CONTRACTS } from '@/config/constants'
import { formatDateTime } from '@/lib/format'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Trust',
  description: 'The live facts behind XyloNet on Arc: who owns the contracts, whether the PayX escrow is solvent right now, and whether Arc, LI.FI and Circle CCTP are responding.',
  alternates: { canonical: '/trust' },
}

const ZERO = '0x0000000000000000000000000000000000000000'
const usdc = (v: bigint) => Number(formatUnits(v, 6))

export default async function TrustPage() {
  const t = await readTrust().catch(() => null)
  const p = t?.payx ?? null
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10">
      <PageHeader
        eyebrow="Trust · read live from Arc"
        title={
          <>
            XyloNet never holds your funds. <em className="text-signal-deep">Verify it.</em>
          </>
        }
        description={`Everything on this page is read from the chain and the services XyloNet depends on${t ? `, last at ${formatDateTime(t.fetchedAt)}` : ''}. Nothing here is typed in by us.`}
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* escrow solvency */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="type-eyebrow">PayX escrow, right now</div>
            {p ? p.solvent ? <StatusPill tone="ok">Solvent</StatusPill> : <StatusPill tone="bad">Shortfall</StatusPill> : <StatusPill tone="neutral">Unavailable</StatusPill>}
          </div>
          {p ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <Amount value={usdc(p.balance)} size="hero" dollar currency="USDC" />
                <span className="text-[13px] text-ink-3">held by the contract</span>
              </div>
              <div className="mt-4">
                <TrustPanel
                  rows={[
                    { label: 'Owed to creators (unclaimed)', value: `${usdc(p.escrow).toFixed(2)} USDC`, strong: true },
                    { label: 'Fees not yet withdrawn', value: `${usdc(p.fees).toFixed(2)} USDC` },
                    { label: 'Surplus', value: `${usdc(p.surplus).toFixed(2)} USDC` },
                    { label: 'Payments paused', value: p.paused ? 'yes' : 'no' },
                  ]}
                  note="Solvent means the contract's USDC balance covers every unclaimed payment plus uncollected fees. No admin function can move escrow; the only exits are claims by the handle's owner."
                />
              </div>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-ink-3">The RPC did not answer. Try again in a minute; the contract itself is unaffected.</p>
          )}
        </section>

        {/* ownership */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="type-eyebrow">Who controls what</div>
          <dl className="mt-3 grid gap-2.5 text-[13.5px]">
            <Row label="PayX contract" value={<Address value={CONTRACTS.PAYX} />} />
            <Row label="Owner" value={p ? <span className="inline-flex flex-wrap items-center gap-2"><Address value={p.owner ?? ZERO} />{p.ownerIsAdminSafe ? <StatusPill tone="ok" dot={false}>Admin Safe, 2-of-3</StatusPill> : <StatusPill tone="warn" dot={false}>not the Admin Safe</StatusPill>}</span> : '—'} />
            <Row label="Fee recipient" value={p ? <span className="inline-flex flex-wrap items-center gap-2"><Address value={p.feeRecipient ?? ZERO} />{p.feeRecipientIsTreasury ? <StatusPill tone="ok" dot={false}>Treasury Safe</StatusPill> : <StatusPill tone="warn" dot={false}>unexpected</StatusPill>}</span> : '—'} />
            <Row label="Claim signer (oracle)" value={p ? <Address value={p.oracle ?? ZERO} /> : '—'} />
            <Row label="Guardian (can pause)" value={p ? p.guardian && p.guardian !== ZERO ? <Address value={p.guardian} /> : <span className="text-ink-3">not set</span> : '—'} />
            <Row label="Fee · minimum" value={p ? <span className="font-mono">{p.feeBps / 100}% · {usdc(p.minTip)} USDC</span> : '—'} />
          </dl>
          <p className="mt-4 text-[12.5px] text-ink-3">The owner can rotate the oracle and set parameters within hard caps in the contract. It has no function that moves a creator&apos;s balance.</p>
        </section>
      </div>

      {/* other tipping assets */}
      {t && t.instances.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="type-eyebrow">Other PayX assets, same audited contract</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {t.instances.map((i) => {
              const f = (v: bigint) => Number(formatUnits(v, i.decimals)).toLocaleString('en-US', { maximumFractionDigits: i.decimals })
              return (
                <div key={i.address} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[15px] font-semibold">{i.symbol}</div>
                    {i.solvent ? <StatusPill tone="ok">Solvent</StatusPill> : <StatusPill tone="bad">Shortfall</StatusPill>}
                  </div>
                  <div className="mt-1"><Address value={i.address} /></div>
                  <dl className="mt-3 grid gap-2 text-[13.5px]">
                    <Row label="Owner" value={i.ownerIsAdminSafe ? <StatusPill tone="ok" dot={false}>Admin Safe, 2-of-3</StatusPill> : i.pendingIsAdminSafe ? <StatusPill tone="warn" dot={false}>handover to the Admin Safe pending</StatusPill> : <StatusPill tone="warn" dot={false}>not the Admin Safe</StatusPill>} />
                    <Row label="Fee recipient" value={i.feeRecipientIsTreasury ? <StatusPill tone="ok" dot={false}>Treasury Safe</StatusPill> : <StatusPill tone="warn" dot={false}>unexpected</StatusPill>} />
                    <Row label="Held · owed · fees" value={<span className="font-mono">{f(i.balance)} · {f(i.escrow)} · {f(i.fees)}</span>} />
                    <Row label="Payments paused" value={i.paused ? 'yes' : 'no'} />
                  </dl>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* safes */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {(t?.safes ?? []).map((s, i) => (
          <div key={s.address} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[15px] font-semibold">{s.name}</div>
              {s.threshold != null && <StatusPill tone="ok" dot={false}>{s.threshold} of {s.owners.length} signatures</StatusPill>}
            </div>
            <div className="mt-1"><Address value={s.address} /></div>
            <p className="mt-2 text-[13.5px] text-ink-2">{s.role}</p>
            {s.owners.length > 0 && i === 0 && (
              <div className="mt-3 grid gap-1 text-[12.5px]">
                <div className="type-eyebrow">Signers, shared by both Safes</div>
                {s.owners.map((o) => (
                  <Address key={o} value={o} copy={false} />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* status */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="type-eyebrow">Services, right now</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Service ok={!!t?.rpc.ok} name="Arc RPC" detail={t?.rpc.ok ? `block ${t.rpc.block?.toLocaleString('en-US')}, ${t.rpc.ageSeconds} s old` : 'no answer'} />
          <Service ok={!!t?.lifi.ok} name="LI.FI routing" detail={t?.lifi.ok ? `answered in ${t.lifi.ms} ms` : 'no answer'} />
          <Service ok={!!t?.cctp.ok} name="Circle CCTP attestation" detail={t?.cctp.ok ? `answered in ${t.cctp.ms} ms` : 'no answer'} />
        </div>
      </section>

      {/* infrastructure */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="type-eyebrow">Contracts you interact with</div>
        <dl className="mt-3 grid gap-2.5 text-[13.5px] sm:grid-cols-2">
          <Row label="USDC on Arc (Circle)" value={<Address value={CONTRACTS.USDC} />} />
          <Row label="EURC on Arc (Circle)" value={<Address value={CONTRACTS.EURC} />} />
          <Row label="cirBTC on Arc (Circle)" value={<Address value={CONTRACTS.CIRBTC} />} />
          <Row label="CCTP TokenMessenger v2" value={<Address value={CONTRACTS.TOKEN_MESSENGER_V2} />} />
          <Row label="CCTP MessageTransmitter v2" value={<Address value={CONTRACTS.MESSAGE_TRANSMITTER_V2} />} />
          <Row label="LI.FI Diamond on Arc" value={<Address value={CONTRACTS.LIFI_DIAMOND} />} />
          <Row label="Arc batching (Multicall3From)" value={<Address value="0x522fAf9A91c41c443c66765030741e4AaCe147D0" />} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" variant="outline" className="h-9" render={<Link href="/docs/security" />}>
            Security model
          </Button>
          <Button size="lg" variant="outline" className="h-9" render={<Link href="/docs/contracts" />}>
            Contract reference
          </Button>
          <Button size="lg" variant="outline" className="h-9" render={<a href="https://github.com/XyloNet/xylonet" target="_blank" rel="noopener noreferrer" />}>
            Source code
          </Button>
        </div>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function Service({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${ok ? 'bg-signal' : 'bg-bad'}`} aria-hidden />
      <div>
        <div className="text-[14px] font-semibold">
          {name} <span className="sr-only">{ok ? 'is responding' : 'is not responding'}</span>
        </div>
        <div className="text-[12.5px] text-ink-3">{detail}</div>
      </div>
    </div>
  )
}
