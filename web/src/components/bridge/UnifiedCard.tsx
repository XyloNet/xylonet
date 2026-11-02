'use client'

import { useEffect, useMemo, useState } from 'react'
import { useBalance } from 'wagmi'
import { formatUnits, isAddress } from 'viem'
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { Amount } from '@/components/xylo/Amount'
import { Address } from '@/components/xylo/Address'
import { Stepper, type Step } from '@/components/xylo/Stepper'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { StatusPill } from '@/components/xylo/StatusPill'
import { SettledStamp } from '@/components/xylo/Stamp'
import { useWallet } from '@/hooks/useWallet'
import { explorerBase, type BridgeChain } from '@/lib/bridge/chains'
import { USDC_BY_CHAIN } from '@/lib/wallet/useUsdcBalances'
import { UNIFIED_CHAINS, useUnifiedBalance, type SpendEstimate } from '@/lib/unified/useUnifiedBalance'
import { formatAmount, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ChainPicker } from './ChainPicker'

type Mode = 'spend' | 'deposit'

const SPEND_LABELS: Record<string, string> = { build: 'Prepare the spend', sign: 'Sign in your wallet', attest: 'Circle attestation', mint: 'Mint on destination' }

function validAmount(s: string): boolean {
  return /^\d+(\.\d{1,6})?$/.test(s.trim()) && Number(s) > 0
}

/** One USDC balance across chains, funded from anywhere and spent on Arc with a signature. */
export function UnifiedCard() {
  const { openConnect } = useWallet()
  const u = useUnifiedBalance()
  const [mode, setMode] = useState<Mode>('spend')
  const [amount, setAmount] = useState('')
  const [dest, setDest] = useState<BridgeChain>(u.arc)
  const [source, setSource] = useState<BridgeChain>(() => UNIFIED_CHAINS.find((c) => c.chainId === 8453) ?? UNIFIED_CHAINS[0])
  const [recipient, setRecipient] = useState('')
  const [est, setEst] = useState<SpendEstimate | null>(null)
  const [estState, setEstState] = useState<'idle' | 'loading' | 'error'>('idle')

  const to = recipient.trim() || u.address || ''
  const toValid = isAddress(to)
  const total = u.balances.data?.total ?? 0
  const pending = u.balances.data?.pending ?? 0
  const ok = validAmount(amount)
  const amt = ok ? Number(amount) : 0
  const busy = u.phase === 'depositing' || u.phase === 'spending'

  const { data: sourceBal } = useBalance({ address: u.address, token: USDC_BY_CHAIN[source.chainId], chainId: source.chainId, query: { enabled: !!u.address && mode === 'deposit', refetchInterval: 30_000 } })
  const sourceUsdc = sourceBal ? Number(formatUnits(sourceBal.value, sourceBal.decimals)) : null

  // Spend estimate, debounced.
  useEffect(() => {
    setEst(null)
    if (mode !== 'spend' || !ok || !toValid || !u.isConnected || amt > total) {
      setEstState('idle')
      return
    }
    setEstState('loading')
    let live = true
    const t = window.setTimeout(() => {
      u.estimateSpend(dest, amount, to)
        .then((e) => {
          if (!live) return
          setEst(e)
          setEstState('idle')
        })
        .catch(() => live && setEstState('error'))
    }, 500)
    return () => {
      live = false
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, amount, dest.chainId, to, u.isConnected, total])

  const tooMuch = mode === 'spend' ? amt > total : sourceUsdc != null && amt > sourceUsdc
  const cta = !u.isConnected
    ? 'Connect wallet'
    : !ok
      ? 'Enter an amount'
      : tooMuch
        ? mode === 'spend'
          ? `Only ${formatAmount(total)} USDC in your balance`
          : `Only ${formatAmount(sourceUsdc ?? 0)} USDC on ${source.name}`
        : mode === 'spend'
          ? !toValid
            ? 'Enter a valid address'
            : estState === 'loading'
              ? 'Estimating…'
              : `Spend ${formatAmount(amt)} USDC on ${dest.name}`
          : `Deposit ${formatAmount(amt)} USDC from ${source.name}`
  const ready = u.isConnected && ok && !tooMuch && !busy && (mode === 'deposit' || (toValid && estState !== 'loading'))

  const steps = useMemo<Step[]>(() => {
    if (u.phase === 'depositing') return [{ id: 'deposit', label: `Deposit ${formatAmount(amt)} USDC from ${source.name}`, state: 'active', meta: 'in your wallet' }]
    return u.steps.map((s) => ({ id: s.id, label: SPEND_LABELS[s.id], state: s.state, meta: s.id === 'mint' && dest.chainId === u.arc.chainId ? 'Instant' : undefined }))
  }, [u.phase, u.steps, amt, source.name, dest.chainId, u.arc.chainId])

  const submit = () => {
    if (!u.isConnected) return openConnect()
    const run = mode === 'spend' ? u.spend(dest, amount, to) : u.deposit(source, amount)
    run.catch(() => {})
  }

  // Receipt
  if (u.phase === 'done' && u.receipt) {
    const r = u.receipt
    return (
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="type-eyebrow">{r.kind === 'spend' ? 'Spent' : 'Deposited'}</div>
          <SettledStamp ms={r.settleMs} />
        </div>
        <div className="mt-3">
          <Amount value={r.amount} size="hero" currency="USDC" />
        </div>
        <p className="mt-1 text-[14px] text-ink-2">
          {r.kind === 'spend' ? `Minted on ${r.chain?.name ?? 'the destination'} from your unified balance.` : `Now in your unified balance, ready to spend on Arc.`}
        </p>
        <div className="mt-5">
          <TrustPanel
            rows={[
              ...(r.fees != null && r.fees > 0 ? [{ label: 'Fees taken', value: `${formatAmount(r.fees, { min: 2, max: 6 })} USDC` }] : []),
              { label: 'Time', value: formatDuration(r.settleMs) },
              { label: 'Transaction', value: r.chain ? <Address value={r.txHash} kind="tx" explorerBase={explorerBase(r.chain.def)} /> : <span className="font-mono">{r.txHash.slice(0, 10)}…</span> },
            ]}
          />
        </div>
        <div className="mt-5">
          <Button size="lg" className="h-10" onClick={() => { u.reset(); setAmount('') }}>
            <RotateCcw data-icon="inline-start" />
            Done
          </Button>
        </div>
      </div>
    )
  }

  if (busy) {
    return (
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="type-eyebrow">{mode === 'spend' ? 'Spending' : 'Depositing'}</div>
            <div className="mt-1">
              <Amount value={amt} size="xl" currency="USDC" />
            </div>
          </div>
          <StatusPill tone="info" pulse>working</StatusPill>
        </div>
        <div className="mt-5">
          <Stepper steps={steps} />
        </div>
        <p className="mt-4 text-[12.5px] text-ink-3">{mode === 'spend' ? 'Spending is a signature, not a transaction. Circle burns from your balance and mints on the destination.' : 'One signature when your wallet supports permit. Otherwise an approval first.'}</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-5">
      {/* balance header */}
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink-3">Unified balance</span>
          {pending > 0 && <StatusPill tone="info" dot={false}>{formatAmount(pending)} pending</StatusPill>}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          {!u.isConnected ? (
            <span className="font-mono text-[28px] text-ink-3">—</span>
          ) : u.balances.isLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <Amount value={total} size="xl" currency="USDC" />
          )}
        </div>
        {u.balances.data && u.balances.data.rows.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
            {u.balances.data.rows.map((r) => (
              <span key={r.key} className="inline-flex items-center gap-1.5">
                {r.chain ? <ChainLogo chainId={r.chain.chainId} size={14} /> : null}
                {r.chain?.name ?? r.key} <span className="font-mono text-foreground" data-numeric>{formatAmount(r.confirmed)}</span>
              </span>
            ))}
          </div>
        )}
        {u.isConnected && u.balances.data && total === 0 && pending === 0 && <p className="mt-2 text-[12.5px] text-ink-3">Nothing deposited yet. Deposit USDC from any chain below.</p>}
        {u.balances.isError && <p className="mt-2 text-[12.5px] text-ink-3">Could not read your unified balance right now.</p>}
      </div>

      {/* mode */}
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="Deposit or spend">
        {(
          [
            ['spend', 'Spend', ArrowUpFromLine],
            ['deposit', 'Deposit', ArrowDownToLine],
          ] as const
        ).map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={mode === k} type="button" onClick={() => setMode(k)} className={cn('inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13.5px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/80', mode === k ? 'bg-card text-foreground shadow-card' : 'text-ink-2 hover:text-foreground')}>
            <Icon className="size-3.5" /> {l}
          </button>
        ))}
      </div>

      {mode === 'deposit' && (
        <div className="mt-3">
          <ChainPicker label="From" chains={UNIFIED_CHAINS} value={source} onChange={setSource} address={u.address} />
        </div>
      )}

      <div className="mt-3 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="ub-amount" className="text-[13px] text-ink-3">
            Amount
          </Label>
          <span className="text-[12.5px] text-ink-3">{mode === 'spend' ? `Available ${formatAmount(total)} USDC` : sourceUsdc != null ? `On ${source.name}: ${formatAmount(sourceUsdc)} USDC` : ''}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="ub-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if ((v.match(/\./g) ?? []).length > 1) return
              setAmount(v)
            }}
            aria-invalid={tooMuch || undefined}
            className="w-full min-w-0 flex-1 bg-transparent font-mono text-[32px] font-medium tracking-[-0.01em] text-foreground outline-none placeholder:text-ink-3"
          />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[13px] font-semibold">
            <TokenLogo symbol="USDC" size={16} /> USDC
          </span>
        </div>
        {((mode === 'spend' && total > 0) || (mode === 'deposit' && (sourceUsdc ?? 0) > 0)) && (
          <div className="mt-1 text-right">
            <button type="button" className="text-[12.5px] font-semibold text-signal-deep hover:underline" onClick={() => setAmount(String(mode === 'spend' ? total : sourceUsdc ?? 0))}>
              Max
            </button>
          </div>
        )}
      </div>

      {mode === 'spend' && (
        <>
          <div className="mt-3">
            <ChainPicker label="Mint on" chains={UNIFIED_CHAINS} value={dest} onChange={setDest} address={u.address} />
          </div>
          <div className="mt-3">
            <Label htmlFor="ub-to" className="text-[13px] text-ink-3">
              Recipient
            </Label>
            <input
              id="ub-to"
              spellCheck={false}
              autoComplete="off"
              placeholder={u.address ?? '0x…'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              aria-invalid={recipient.trim() !== '' && !toValid ? true : undefined}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-[13px] outline-none placeholder:text-ink-3 focus-visible:ring-3 focus-visible:ring-ring/80"
            />
            <p className="mt-1 text-[12px] text-ink-3">Leave empty to mint to your own wallet.</p>
          </div>
          <div className="mt-4">
            <TrustPanel
              rows={[
                { label: 'Circle fee and source gas', value: est ? `${formatAmount(est.providerFee, { min: 2, max: 6 })} USDC` : estState === 'loading' ? '…' : '—' },
                ...(est && est.forwarderFee > 0 ? [{ label: 'Forwarding (Circle mints for you)', value: `${formatAmount(est.forwarderFee, { min: 2, max: 6 })} USDC` }] : []),
                { label: `Arrives on ${dest.name}`, value: est ? `${formatAmount(est.receive, { min: 2, max: 6 })} USDC` : '—', strong: true },
                { label: 'Time', value: <span className={dest.chainId === u.arc.chainId ? 'text-signal-deep' : undefined}>{dest.chainId === u.arc.chainId ? 'Instant once minted' : 'under a minute'}</span> },
              ]}
              note="You sign burn intents. Circle attests and mints on the destination. Your USDC never sits with XyloNet."
            />
          </div>
        </>
      )}

      {mode === 'deposit' && (
        <div className="mt-4">
          <TrustPanel
            rows={[
              { label: 'Goes to', value: 'Circle Gateway wallet, in your name' },
              { label: 'Spendable', value: 'after source finality' },
              { label: 'Get it back', value: 'spend anywhere, or trustless withdrawal' },
            ]}
            note="Deposits sit in Circle's Gateway contract under your address. Spend onto any Gateway chain, Arc included, with a signature."
          />
        </div>
      )}

      {u.error && (
        <div className="mt-3 rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-[14px]" role="alert">
          {u.error}
        </div>
      )}

      <Button size="lg" className="mt-4 h-11 w-full text-[15px] font-semibold" disabled={u.isConnected && !ready} onClick={submit}>
        {cta}
      </Button>
    </div>
  )
}
