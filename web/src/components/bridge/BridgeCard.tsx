'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBalance } from 'wagmi'
import { formatUnits } from 'viem'
import { ArrowDownUp, RotateCcw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { Amount } from '@/components/xylo/Amount'
import { Address } from '@/components/xylo/Address'
import { Stepper, type Step } from '@/components/xylo/Stepper'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { StatusPill } from '@/components/xylo/StatusPill'
import { SettledStamp } from '@/components/xylo/Stamp'
import { useWallet } from '@/hooks/useWallet'
import { ARC, COUNTERPARTY_CHAINS, expectedTime, explorerBase, type BridgeChain } from '@/lib/bridge/chains'
import { useBridge, type Estimate, type Speed } from '@/lib/bridge/useBridge'
import { formatAmount, formatDuration, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ChainPicker } from './ChainPicker'

type Direction = 'to-arc' | 'from-arc'

const STEP_LABELS: Record<string, (s: BridgeChain, d: BridgeChain, amt: string) => string> = {
  approve: (s) => `Approve USDC on ${s.name}`,
  burn: (s, _d, amt) => `Burn ${amt || ''} USDC on ${s.name}`.replace('  ', ' '),
  attest: () => 'Circle attestation',
  mint: (_s, d) => `Mint on ${d.name}`,
}

const SPEEDS: readonly { key: Speed; label: string; fee: string }[] = [
  { key: 'FAST', label: 'Fast', fee: 'small CCTP fee' },
  { key: 'SLOW', label: 'Standard', fee: 'no CCTP fee' },
]

/** The token chip is fixed: CCTP moves native USDC only, so there is nothing to choose. */
function UsdcChip() {
  return (
    <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-[14px] font-semibold text-foreground">
      <TokenLogo symbol="USDC" size={18} />
      USDC
    </span>
  )
}

export function BridgeCard() {
  const { address, isConnected, openConnect } = useWallet()
  const b = useBridge()
  const [direction, setDirection] = useState<Direction>('to-arc')
  const [other, setOther] = useState<BridgeChain>(COUNTERPARTY_CHAINS.find((c) => c.chainId === 8453) ?? COUNTERPARTY_CHAINS[0])
  const [amount, setAmount] = useState('')
  const [speed, setSpeed] = useState<Speed>('FAST')
  const [est, setEst] = useState<Estimate | null>(null)
  const [estState, setEstState] = useState<'idle' | 'loading' | 'error'>('idle')
  const estTimer = useRef<number | null>(null)

  const source = direction === 'to-arc' ? other : ARC
  const dest = direction === 'to-arc' ? ARC : other
  const amountNum = Number(amount)
  const validAmount = amount !== '' && Number.isFinite(amountNum) && amountNum > 0
  const standardOnly = !!source.standardOnly
  useEffect(() => {
    if (standardOnly) setSpeed('SLOW')
  }, [standardOnly])

  const { data: bal } = useBalance({
    address: address as `0x${string}` | undefined,
    token: source.def.usdcAddress as `0x${string}`,
    chainId: source.chainId,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const balance = bal ? Number(formatUnits(bal.value, bal.decimals)) : null
  const tooMuch = balance != null && validAmount && amountNum > balance

  // Fee estimate, debounced, only when it can be meaningful.
  useEffect(() => {
    setEst(null)
    if (!isConnected || !validAmount || tooMuch || b.phase !== 'idle') {
      setEstState('idle')
      return
    }
    setEstState('loading')
    if (estTimer.current) window.clearTimeout(estTimer.current)
    estTimer.current = window.setTimeout(() => {
      b.estimate(source, dest, amount, speed)
        .then((e) => {
          setEst(e)
          setEstState('idle')
        })
        .catch(() => setEstState('error'))
    }, 500)
    return () => {
      if (estTimer.current) window.clearTimeout(estTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, validAmount, tooMuch, amount, speed, source.chainId, dest.chainId, b.phase])

  const steps: Step[] = useMemo(
    () =>
      b.steps
        .filter((s) => s.state !== 'skipped')
        .map((s) => {
          const def = s.id === 'mint' ? dest.def : source.def
          const elapsed = s.startedAt ? (s.endedAt ?? Date.now()) - s.startedAt : null
          const meta =
            s.state === 'done' && elapsed != null
              ? formatDuration(elapsed)
              : s.state === 'active'
                ? s.id === 'attest'
                  ? 'waiting for Circle'
                  : 'in your wallet'
                : s.id === 'mint' && dest.chainId === ARC.chainId
                  ? 'Instant'
                  : ''
          return {
            id: s.id,
            label: STEP_LABELS[s.id](source, dest, amount),
            state: s.state === 'skipped' ? 'done' : s.state,
            meta,
            txHash: s.txHash,
            explorerBase: explorerBase(def),
          } satisfies Step
        }),
    [b.steps, source, dest, amount],
  )

  const total = b.startedAt ? (b.endedAt ?? Date.now()) - b.startedAt : 0
  const receive = est ? est.receive : validAmount ? amountNum : null

  const submit = () => {
    if (!isConnected) return openConnect()
    if (!validAmount || tooMuch) return
    void b.bridge(source, dest, amount, speed)
  }

  /** Flip to-arc / from-arc. The counterparty chain stays; the estimate is redone. */
  const flip = () => {
    setDirection((d) => (d === 'to-arc' ? 'from-arc' : 'to-arc'))
    setEst(null)
  }

  const cta = !isConnected
    ? 'Connect wallet'
    : !validAmount
      ? 'Enter an amount'
      : tooMuch
        ? `Only ${formatAmount(balance ?? 0)} USDC on ${source.name}`
        : direction === 'to-arc'
          ? `Bring ${formatAmount(amountNum)} USDC to Arc`
          : `Send ${formatAmount(amountNum)} USDC to ${dest.name}`

  // ── receipt ──────────────────────────────────────────────────────────────
  if (b.phase === 'done') {
    const mint = b.steps.find((s) => s.id === 'mint')
    const burn = b.steps.find((s) => s.id === 'burn')
    return (
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="type-eyebrow">Receipt</div>
          <SettledStamp ms={total} />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <Amount value={receive} size="hero" />
          <span className="text-[15px] font-medium text-ink-3">USDC on {dest.name}</span>
        </div>
        <p className="mt-1 text-[14px] text-ink-2">
          From {source.name} to {dest.name}, {speed === 'FAST' ? 'fast transfer' : 'standard transfer'}.
        </p>
        <div className="mt-5">
          <Stepper steps={steps} />
        </div>
        <div className="mt-4 grid gap-1.5 text-[13px] text-ink-2">
          {burn?.txHash && (
            <div className="flex justify-between">
              <span>Burn on {source.name}</span>
              <Address value={burn.txHash} kind="tx" explorerBase={explorerBase(source.def)} />
            </div>
          )}
          {mint?.txHash && (
            <div className="flex justify-between">
              <span>Mint on {dest.name}</span>
              <Address value={mint.txHash} kind="tx" explorerBase={explorerBase(dest.def)} />
            </div>
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <Button size="lg" className="h-10" onClick={() => { b.reset(); setAmount('') }}>
            <RotateCcw data-icon="inline-start" />
            Bridge again
          </Button>
        </div>
      </div>
    )
  }

  // ── in flight / error ────────────────────────────────────────────────────
  if (b.phase === 'bridging' || b.phase === 'error') {
    return (
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="type-eyebrow">{b.phase === 'bridging' ? 'In progress' : 'Needs attention'}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <Amount value={amountNum} size="xl" />
              <span className="text-[14px] text-ink-3">USDC · {source.name} → {dest.name}</span>
            </div>
          </div>
          {b.phase === 'bridging' && <StatusPill tone="info" pulse>{formatDuration(total)}</StatusPill>}
          {b.phase === 'error' && <StatusPill tone={b.resumable ? 'warn' : 'bad'}>{b.resumable ? 'Paused' : 'Failed'}</StatusPill>}
        </div>
        <div className="mt-5">
          <Stepper steps={steps} />
        </div>
        {b.phase === 'error' && (
          <div className="mt-4 rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-[14px] text-foreground" role="alert">
            {b.error}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {b.phase === 'error' && b.resumable && (
            <Button size="lg" className="h-10" onClick={() => void b.resume()}>
              <Zap data-icon="inline-start" />
              Resume the mint
            </Button>
          )}
          {b.phase === 'error' && (
            <Button size="lg" variant="outline" className="h-10" onClick={() => b.reset()}>
              {b.resumable ? 'Leave it, CCTP will deliver' : 'Start over'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── form ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-5">
      {/* from */}
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-[13px] font-medium text-ink-2">From</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <ChainPicker
            label="Source chain"
            chains={direction === 'to-arc' ? COUNTERPARTY_CHAINS : [ARC]}
            value={source}
            onChange={setOther}
            address={address}
            disabled={direction === 'from-arc'}
          />
          <UsdcChip />
        </div>
        <div
          className={cn(
            'mt-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/80',
            tooMuch && 'border-bad/40',
          )}
        >
          <div className="flex items-center gap-3">
            <input
              id="bridge-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              aria-label="Amount to bridge"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '')
                if ((v.match(/\./g) ?? []).length > 1) return
                const [, dec] = v.split('.')
                if (dec && dec.length > 6) return
                setAmount(v)
              }}
              aria-invalid={tooMuch || undefined}
              aria-describedby="bridge-balance"
              className="w-full min-w-0 flex-1 bg-transparent font-mono text-[32px] font-medium tracking-[-0.01em] text-foreground outline-none placeholder:text-ink-3"
            />
            {balance != null && balance > 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(balance))}
                className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-[12.5px] font-semibold text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/80"
              >
                Max
              </button>
            )}
          </div>
          <div id="bridge-balance" className={cn('mt-1 text-[12.5px] text-ink-3', tooMuch && 'text-bad')}>
            {address ? (balance != null ? `Balance ${formatAmount(balance)} USDC` : 'Loading balance…') : 'Connect to see your balance'}
          </div>
        </div>
      </div>

      {/* swap direction */}
      <div className="relative my-2 flex justify-center">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        <button
          type="button"
          onClick={flip}
          aria-label="Swap direction"
          title="Swap direction"
          className="relative grid size-10 place-items-center rounded-full border border-signal/40 bg-card text-signal outline-none transition-colors hover:bg-signal-tint focus-visible:ring-3 focus-visible:ring-ring/80"
        >
          <ArrowDownUp className="size-4" />
        </button>
      </div>

      {/* to */}
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-[13px] font-medium text-ink-2">To</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <ChainPicker
            label="Destination chain"
            chains={direction === 'from-arc' ? COUNTERPARTY_CHAINS : [ARC]}
            value={dest}
            onChange={setOther}
            address={address}
            disabled={direction === 'to-arc'}
          />
          <UsdcChip />
        </div>
        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2.5" aria-live="polite">
          <div className="text-[12.5px] text-ink-3">You&rsquo;ll receive (estimated)</div>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <Amount value={receive} size="lg" className={cn(estState === 'loading' && 'opacity-60')} />
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <ChainLogo chainId={dest.chainId} size={14} />
              {dest.chainId === ARC.chainId ? <span className="font-semibold text-signal-deep">Instant on arrival</span> : expectedTime(source, dest, speed)}
            </span>
          </div>
        </div>
      </div>

      {/* speed */}
      <div className="mt-3 rounded-xl border border-border bg-background px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span id="bridge-speed-label" className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
            <Zap className="hidden size-4 text-signal sm:block" aria-hidden />
            Bridge speed
          </span>
          <div role="radiogroup" aria-labelledby="bridge-speed-label" className="ml-auto grid grid-cols-2 rounded-lg bg-secondary p-0.5">
            {SPEEDS.map((s) => {
              const disabled = s.key === 'FAST' && standardOnly
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={speed === s.key}
                  disabled={disabled}
                  onClick={() => setSpeed(s.key)}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/80 disabled:opacity-50 sm:h-8 sm:px-3 sm:text-[13px]',
                    speed === s.key ? 'bg-card text-foreground ring-1 ring-border' : 'text-ink-2 hover:text-foreground',
                  )}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          Arrives in {expectedTime(source, dest, speed)} · {SPEEDS.find((s) => s.key === speed)?.fee}
        </p>
        {standardOnly && <p className="mt-0.5 text-[12.5px] text-ink-3">Fast transfer is not offered from {source.name}; Standard is used.</p>}
      </div>

      {/* costs */}
      <div className="mt-3">
        <TrustPanel
          summary={2}
          rows={[
            { label: `Arrives on ${dest.name}`, value: receive != null ? `${formatAmount(receive)} USDC` : '—', strong: true },
            {
              label: `Circle CCTP fee${speed === 'SLOW' ? ' (Standard)' : ''}`,
              value: est ? (est.providerFee > 0 ? `${formatAmount(est.providerFee, { min: 2, max: 6 })} USDC` : '0 USDC') : estState === 'loading' ? 'quoting…' : speed === 'SLOW' ? '0 USDC' : 'quoted at signing',
            },
            { label: 'You send', value: validAmount ? `${formatAmount(amountNum)} USDC` : '—' },
            ...(est && est.forwarderFee > 0 ? [{ label: 'Forwarding fee', value: `${formatAmount(est.forwarderFee, { min: 2, max: 6 })} USDC` }] : []),
            {
              label: `Gas on ${source.name}`,
              value: est?.sourceGas != null ? (source.chainId === ARC.chainId ? formatUsd(est.sourceGas) : `${est.sourceGas.toFixed(6)} ${source.gasSymbol}`) : 'in your wallet',
            },
            ...(dest.chainId !== ARC.chainId
              ? [{ label: `Gas on ${dest.name} to mint`, value: est?.destGas != null ? `${est.destGas.toFixed(6)} ${dest.gasSymbol}` : `needs a little ${dest.gasSymbol}` }]
              : [{ label: 'Gas on Arc to mint', value: 'cents, paid in USDC' }]),
          ]}
          note={
            estState === 'error'
              ? 'The fee quote failed; the exact fee is still shown in your wallet before you sign.'
              : 'Native USDC, burned on the source chain and minted on the destination by Circle. No wrapped tokens. XyloNet never holds your funds.'
          }
        />
      </div>

      <Button size="lg" className="mt-4 h-11 w-full text-[15px] font-semibold" disabled={isConnected && (!validAmount || tooMuch)} onClick={submit}>
        {cta}
      </Button>
      <p className="mt-2 text-center text-[12px] text-ink-3">
        {dest.chainId !== ARC.chainId ? `Powered by Circle CCTP. Mints on ${dest.name}; you need a little ${dest.gasSymbol} there.` : 'Powered by Circle CCTP.'}
      </p>
    </div>
  )
}
