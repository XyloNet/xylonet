'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { ArrowDownUp, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TokenLogo } from '@/components/ui/TokenLogos'
import { Amount } from '@/components/xylo/Amount'
import { Address } from '@/components/xylo/Address'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { StatusPill } from '@/components/xylo/StatusPill'
import { SettledStamp } from '@/components/xylo/Stamp'
import { Stepper, type Step } from '@/components/xylo/Stepper'
import { useWallet } from '@/hooks/useWallet'
import { useExchange, type Side } from '@/lib/exchange/useExchange'
import { formatAmount, formatPercent, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { OneBalanceFundingLazy } from '@/components/unified/OneBalanceFundingLazy'

const TOOL_NAMES: Record<string, string> = { kyberswap: 'KyberSwap', '1inch': '1inch', uniswap: 'Uniswap', '0x': '0x', openocean: 'OpenOcean' }

export function ExchangeCard() {
  const { address, isConnected, openConnect, onArc } = useWallet()
  const [from, setFrom] = useState<Side>('USDC')
  const [to, setTo] = useState<Side>('EURC')
  const [input, setInput] = useState('')
  const x = useExchange(from, to, input)
  const balIn = x.balanceIn !== undefined ? Number(formatUnits(x.balanceIn, 6)) : null
  const amountNum = x.amount ? Number(formatUnits(x.amount, 6)) : null
  const tooMuch = balIn != null && amountNum != null && amountNum > balIn
  // USDC missing on Arc for this exchange; Circle Gateway can cover it from the wallet's One balance.
  const shortfall = isConnected && from === 'USDC' && tooMuch && balIn != null && amountNum != null ? amountNum - balIn : 0
  const busy = x.stage !== 'idle' && x.stage !== 'done'
  const ready = isConnected && !!x.quote && !tooMuch && !busy

  const flip = () => {
    setFrom(to)
    setTo(from)
  }

  const cta = !isConnected ? 'Connect wallet' : !x.amount ? 'Enter an amount' : tooMuch ? `Only ${formatAmount(balIn ?? 0)} ${from} on Arc` : x.quoteState === 'loading' ? 'Getting a quote…' : x.quoteState === 'none' ? 'No route right now' : x.quoteState === 'error' ? 'Quote failed, retrying' : `Exchange ${formatAmount(amountNum!)} ${from} for ${to}`

  if (x.stage === 'done' && x.result) {
    const r = x.result
    return (
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="type-eyebrow">Receipt</div>
          <SettledStamp ms={r.settleMs} />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <Amount value={Number(formatUnits(r.amountOut, 6))} size="hero" currency={r.to} />
        </div>
        <p className="mt-1 text-[14px] text-ink-2">
          for {formatAmount(Number(formatUnits(r.amountIn, 6)))} {r.from}, via {TOOL_NAMES[r.tool] ?? r.tool}.
        </p>
        <div className="mt-5">
          <TrustPanel rows={[{ label: 'Rate', value: `1 ${r.from} = ${(Number(formatUnits(r.amountOut, 6)) / Number(formatUnits(r.amountIn, 6))).toFixed(4)} ${r.to}` }, { label: 'Signatures', value: r.batched ? '1 (approve + exchange batched)' : x.txHash ? '1' : '2' }, { label: 'Transaction', value: <Address value={r.txHash} kind="tx" /> }]} />
        </div>
        <div className="mt-5">
          <Button size="lg" className="h-10" onClick={() => { x.reset(); setInput('') }}>
            <RotateCcw data-icon="inline-start" />
            Exchange again
          </Button>
        </div>
      </div>
    )
  }

  if (busy) {
    const steps: Step[] =
      x.stage === 'approving' || x.stage === 'approve-wait'
        ? [
            { id: 'approve', label: `Approve ${from}`, state: x.stage === 'approving' ? 'active' : 'done', meta: x.stage === 'approving' ? 'in your wallet' : 'confirming' },
            { id: 'swap', label: `Exchange to ${to}`, state: 'pending' },
          ]
        : [{ id: 'swap', label: `Exchange ${from} to ${to}`, state: 'active', meta: x.stage === 'confirming' ? 'settling' : x.stage === 'switching' ? 'switching to Arc' : 'in your wallet', txHash: x.txHash ?? undefined }]
    return (
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="type-eyebrow">In progress</div>
            <div className="mt-1 flex items-baseline gap-2">
              <Amount value={amountNum} size="xl" currency={from} />
              <span className="text-[14px] text-ink-3">→ {to}</span>
            </div>
          </div>
          <StatusPill tone="info" pulse>
            {x.stage === 'confirming' ? 'settling' : 'working'}
          </StatusPill>
        </div>
        <div className="mt-5">
          <Stepper steps={steps} />
        </div>
      </div>
    )
  }

  const q = x.quote
  const routeFee = q?.feeCosts.reduce((s, f) => s + f.percentage, 0) ?? 0

  return (
    <div className="p-4 sm:p-5">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="ex-amount" className="text-[13px] text-ink-3">
            You pay
          </Label>
          <span className="text-[12.5px] text-ink-3">{address ? (balIn != null ? `Balance ${formatAmount(balIn)} ${from}` : 'Loading…') : 'Connect to see your balance'}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="ex-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if ((v.match(/\./g) ?? []).length > 1) return
              setInput(v)
            }}
            aria-invalid={tooMuch || undefined}
            className="w-full min-w-0 flex-1 bg-transparent font-mono text-[32px] font-medium tracking-[-0.01em] text-foreground outline-none placeholder:text-ink-3"
          />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[13px] font-semibold">
            <TokenLogo symbol={from} size={16} /> {from}
          </span>
        </div>
        {balIn != null && balIn > 0 && (
          <div className="mt-1 text-right">
            <button type="button" className="text-[12.5px] font-semibold text-signal-deep hover:underline" onClick={() => setInput(formatUnits(x.balanceIn ?? 0n, 6))}>
              Max
            </button>
          </div>
        )}
      </div>

      {shortfall > 0 && <OneBalanceFundingLazy shortfall={shortfall} onFunded={() => void x.refetchBalanceIn()} />}

      <div className="relative my-2 flex justify-center">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        <button type="button" onClick={flip} aria-label="Swap direction" className="relative grid size-9 place-items-center rounded-full border border-border bg-card text-ink-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/80">
          <ArrowDownUp className="size-4" />
        </button>
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-ink-3">You receive</span>
          <span className="text-[12.5px] text-ink-3">{x.balanceOut !== undefined ? `Balance ${formatAmount(Number(formatUnits(x.balanceOut, 6)))} ${to}` : ''}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Amount value={q ? Number(formatUnits(q.toAmount, 6)) : null} size="lg" className={cn(x.quoteState === 'loading' && 'opacity-60')} />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[13px] font-semibold">
            <TokenLogo symbol={to} size={16} /> {to}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <TrustPanel
          summary={2}
          rows={[
            { label: 'Rate', value: q ? `1 ${from} = ${q.rate.toFixed(4)} ${to}` : '—', strong: true },
            { label: 'Route and XyloNet fees', value: q ? formatPercent(routeFee, 2) : '—' },
            { label: `Minimum received (${formatPercent(x.slippage, 1)} slippage)`, value: q ? `${formatAmount(Number(formatUnits(q.toAmountMin, 6)), { min: 2, max: 4 })} ${to}` : '—' },
            { label: 'Route', value: q ? `${TOOL_NAMES[q.tool] ?? q.tool} via LI.FI` : '—' },
            { label: 'Network', value: q?.gasUsd != null ? formatUsd(q.gasUsd) : 'cents, paid in USDC' },
            { label: 'Settlement', value: <span className="text-signal-deep">Instant</span> },
          ]}
          note="Runs from your wallet through LI.FI's contract on Arc. XyloNet never holds your funds."
        />
      </div>

      {x.error && (
        <div className="mt-3 rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-[14px]" role="alert">
          {x.error}
        </div>
      )}

      <Button size="lg" className="mt-4 h-11 w-full text-[15px] font-semibold" disabled={isConnected && !ready} onClick={() => (isConnected ? x.exchange().catch(() => {}) : openConnect())}>
        {cta}
      </Button>
      {isConnected && !onArc && <p className="mt-2 text-center text-[12px] text-ink-3">Your wallet will be asked to switch to Arc.</p>}
    </div>
  )
}
