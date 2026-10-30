'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { RotateCcw, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TokenLogo } from '@/components/ui/TokenLogos'
import { Amount } from '@/components/xylo/Amount'
import { Address } from '@/components/xylo/Address'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { StatusPill } from '@/components/xylo/StatusPill'
import { SettledStamp } from '@/components/xylo/Stamp'
import { Stepper, type Step } from '@/components/xylo/Stepper'
import { useWallet } from '@/hooks/useWallet'
import { usePayX, type PayStage } from '@/lib/payx/usePayX'
import { parseAssetAmount, utf8Bytes } from '@/lib/payx/format'
import { PAYX_ASSETS, livePayXAssets, type PayXAssetKey } from '@/config/constants'
import { formatAmount, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { OneBalanceFundingLazy } from '@/components/unified/OneBalanceFundingLazy'
import { RecipientInput, type Recipient } from './RecipientInput'

const PRESETS = ['1', '5', '25', '100']
const MAX_MESSAGE_BYTES = 280
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

function stageLabel(stage: PayStage, symbol: string): string {
  switch (stage) {
    case 'switching':
      return 'Switching your wallet to Arc…'
    case 'approving':
      return `Approve ${symbol} in your wallet…`
    case 'approve-wait':
      return 'Approval confirming…'
    case 'signing':
      return 'Confirm in your wallet…'
    case 'confirming':
      return 'Settling on Arc…'
    default:
      return ''
  }
}

export function PayCard({ initialTo = '', initialAmount = '5', initialNote = '', lockedHandle = false }: { initialTo?: string; initialAmount?: string; initialNote?: string; lockedHandle?: boolean }) {
  const { address, isConnected, openConnect, onArc } = useWallet()
  const [to, setTo] = useState(initialTo)
  const [recipient, setRecipient] = useState<Recipient>({ kind: 'empty', raw: '' })
  const [assetKey, setAssetKey] = useState<PayXAssetKey>('USDC')
  const asset = PAYX_ASSETS[assetKey]
  const dec = asset.token.decimals
  const sym = asset.token.symbol
  const isDollar = asset.currencyPrefix === '$'
  const presets = assetKey === 'USDC' ? PRESETS : asset.quickPicks
  const fa = (n: number) => formatAmount(n, asset.fractionDigits)
  const liveAssets = livePayXAssets()
  const [amountInput, setAmountInput] = useState(initialAmount)
  const [preset, setPreset] = useState<string | null>(PRESETS.includes(initialAmount) ? initialAmount : null)
  const [note, setNote] = useState(initialNote)

  const handle = recipient.kind === 'handle' ? recipient.handle : null
  const amount = useMemo(() => {
    return parseAssetAmount(amountInput, assetKey)
  }, [amountInput, assetKey])
  const p = usePayX(handle, amount, assetKey)

  useEffect(() => {
    setTo(initialTo)
  }, [initialTo])

  const balance = p.balance
  const noteBytes = utf8Bytes(note)
  const noteTooLong = noteBytes > MAX_MESSAGE_BYTES
  const amountError = (() => {
    if (amountInput.trim() === '') return null
    if (amount === null) return `Enter an amount with up to ${dec} decimals.`
    if (recipient.kind === 'handle' && amount < p.minTip) return `Minimum is ${formatUnits(p.minTip, dec)} ${sym} for a handle.`
    if (amount === 0n) return 'Enter an amount above zero.'
    if (balance !== undefined && amount > balance) return `You have ${fa(Number(formatUnits(balance, dec)))} ${sym} on Arc.`
    return null
  })()
  // USDC missing on Arc for this payment; Circle Gateway (USDC only) can cover it from the wallet's One balance.
  const shortfall = assetKey === 'USDC' && isConnected && amount !== null && balance !== undefined && amount > balance ? Number(formatUnits(amount - balance, dec)) : 0
  const busy = p.stage !== 'idle' && p.stage !== 'done'
  const ready = p.live && !p.paused && isConnected && amount !== null && !amountError && !noteTooLong && (recipient.kind === 'handle' || recipient.kind === 'address')

  const submit = async () => {
    if (!isConnected) return openConnect()
    if (!ready || amount === null) return
    try {
      if (recipient.kind === 'handle') await p.payHandle(recipient.handle, amount, note.trim())
      else if (recipient.kind === 'address') await p.payAddress(recipient.address, amount)
    } catch {
      /* surfaced through p.error */
    }
  }

  const amountNum = amount !== null ? Number(formatUnits(amount, dec)) : null
  const feeNum = Number(formatUnits(p.fee, dec))
  const netNum = Number(formatUnits(p.net, dec))
  const isHandle = recipient.kind === 'handle' || recipient.kind === 'empty' || recipient.kind === 'invalid'
  const toLabel = recipient.kind === 'handle' ? `@${recipient.handle}` : recipient.kind === 'address' ? (recipient.ens ?? `${recipient.address.slice(0, 6)}…${recipient.address.slice(-4)}`) : 'They'

  const cta = !isConnected
    ? 'Connect wallet'
    : recipient.kind === 'empty'
      ? 'Enter who to pay'
      : recipient.kind === 'invalid' || recipient.kind === 'ens'
        ? 'Check the recipient'
        : amount === null || amountError
          ? 'Enter an amount'
          : p.paused
            ? 'Payments are paused'
            : `Pay ${fa(amountNum!)} ${sym} to ${toLabel}`

  // ── receipt ──────────────────────────────────────────────────────────────
  if (p.stage === 'done' && p.result) {
    const r = p.result
    const receiptUrl = `${APP_URL}/pay/receipt/${r.txHash}`
    const shareText = r.mode === 'handle' ? `Just paid @${r.to} ${fa(Number(formatUnits(r.amount, dec)))} ${sym} on Arc via XyloNet. Settled in ${formatDuration(r.settleMs)}.` : `Just sent ${fa(Number(formatUnits(r.amount, dec)))} ${sym} on Arc via XyloNet. Settled in ${formatDuration(r.settleMs)}.`
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(receiptUrl)}`
    return (
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="type-eyebrow">Receipt</div>
          <SettledStamp ms={r.settleMs} />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <Amount value={Number(formatUnits(r.amount, dec))} size="hero" dollar={isDollar} currency={isDollar ? undefined : sym} format={asset.fractionDigits} />
          <span className="text-[15px] font-medium text-ink-3">to {r.mode === 'handle' ? `@${r.to}` : r.to.slice(0, 6) + '…' + r.to.slice(-4)}</span>
        </div>
        {r.message && <p className="mt-2 text-[15px] italic text-ink-2">“{r.message}”</p>}
        <div className="mt-5">
          <TrustPanel
            rows={
              r.mode === 'handle'
                ? [
                    { label: `@${r.to} receives`, value: `${fa(Number(formatUnits(r.net, dec)))} ${sym}`, strong: true },
                    { label: `XyloNet fee · ${Number(p.feeBps) / 100}%`, value: `${fa(Number(formatUnits(r.fee, dec)))} ${sym}` },
                    { label: 'Signatures', value: r.batched ? '1 (approve + pay batched)' : '2' },
                    { label: 'Transaction', value: <Address value={r.txHash} kind="tx" /> },
                  ]
                : [
                    { label: 'Received', value: `${fa(Number(formatUnits(r.net, dec)))} ${sym}`, strong: true },
                    { label: 'Fee', value: 'none' },
                    { label: 'Transaction', value: <Address value={r.txHash} kind="tx" /> },
                  ]
            }
            note={r.mode === 'handle' ? `Held by the PayX contract until @${r.to} signs in with X and claims. No expiry.` : 'Delivered directly to the address on Arc.'}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" className="h-10" render={<a href={intent} target="_blank" rel="noopener noreferrer" />}>
            <Share2 data-icon="inline-start" />
            Share on X
          </Button>
          <Button size="lg" variant="outline" className="h-10" render={<Link href={`/pay/receipt/${r.txHash}`} />}>
            View receipt
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="h-10"
            onClick={() => {
              p.reset()
              setNote('')
              if (!lockedHandle) setTo('')
            }}
          >
            <RotateCcw data-icon="inline-start" />
            Pay again
          </Button>
        </div>
      </div>
    )
  }

  // ── in flight ────────────────────────────────────────────────────────────
  if (busy) {
    const steps: Step[] =
      p.stage === 'approving' || p.stage === 'approve-wait'
        ? [
            { id: 'approve', label: `Approve ${sym}`, state: p.stage === 'approving' ? 'active' : 'done', meta: p.stage === 'approving' ? 'in your wallet' : 'confirming' },
            { id: 'pay', label: `Pay ${toLabel}`, state: 'pending' },
          ]
        : [
            { id: 'pay', label: isHandle ? `Pay ${toLabel}` : `Send to ${toLabel}`, state: p.stage === 'confirming' ? 'active' : 'active', meta: p.stage === 'confirming' ? 'settling' : p.stage === 'switching' ? 'switching to Arc' : 'in your wallet', txHash: p.txHash ?? undefined },
          ]
    return (
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="type-eyebrow">In progress</div>
            <div className="mt-1 flex items-baseline gap-2">
              <Amount value={amountNum} size="xl" dollar={isDollar} currency={isDollar ? undefined : sym} format={asset.fractionDigits} />
              <span className="text-[14px] text-ink-3">to {toLabel}</span>
            </div>
          </div>
          <StatusPill tone="info" pulse>
            {stageLabel(p.stage, sym)}
          </StatusPill>
        </div>
        <div className="mt-5">
          <Stepper steps={steps} />
        </div>
      </div>
    )
  }

  // ── form ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-5">
      <RecipientInput value={to} onChange={setTo} onResolved={setRecipient} locked={lockedHandle} info={isHandle && p.handleInfo ? { pendingBalance: p.handleInfo.pendingBalance, isRegistered: p.handleInfo.isRegistered, tipCount: p.handleInfo.tipCount } : null} />

      {liveAssets.length > 1 && (
        <div className="mt-3 grid gap-1 rounded-lg bg-secondary p-1" style={{ gridTemplateColumns: `repeat(${liveAssets.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Asset to pay in">
          {liveAssets.map((a) => (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={assetKey === a.key}
              onClick={() => {
                if (a.key === assetKey) return
                setAssetKey(a.key)
                setAmountInput(a.defaultAmount)
                setPreset(a.key === 'USDC' ? (PRESETS.includes(a.defaultAmount) ? a.defaultAmount : null) : a.quickPicks.includes(a.defaultAmount) ? a.defaultAmount : null)
                p.reset()
              }}
              className={cn('inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13.5px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50', assetKey === a.key ? 'bg-card text-foreground shadow-card' : 'text-ink-2 hover:text-foreground')}
            >
              <TokenLogo symbol={a.key} size={16} /> {a.token.symbol}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-xl border border-border bg-background p-4">
        <Label htmlFor="pay-amount" className="text-[13px] text-ink-3">
          Amount
        </Label>
        <div className="mt-2 flex items-center gap-3">
          {asset.currencyPrefix && <span className="type-display text-[36px] text-ink-3">{asset.currencyPrefix}</span>}
          <input
            id="pay-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amountInput}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if ((v.match(/\./g) ?? []).length > 1) return
              setAmountInput(v)
              setPreset(presets.includes(v) ? v : null)
            }}
            aria-invalid={!!amountError || undefined}
            aria-describedby="pay-amount-help"
            className="w-full min-w-0 flex-1 bg-transparent font-mono text-[36px] font-medium tracking-[-0.01em] text-foreground outline-none placeholder:text-ink-3"
          />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[13px] font-semibold">
            <TokenLogo symbol={assetKey} size={16} /> {sym}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick amounts">
          {presets.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={preset === v}
              onClick={() => {
                setAmountInput(v)
                setPreset(v)
              }}
              className={cn(
                'h-8 rounded-md border px-3 font-mono text-[13px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                preset === v ? 'border-foreground bg-secondary text-foreground' : 'border-line-2 bg-card text-ink-2 hover:text-foreground',
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div id="pay-amount-help" className="mt-2 flex items-center justify-between text-[12.5px] text-ink-3">
          <span className={cn(amountError && 'text-bad')}>{amountError ?? (address ? (balance !== undefined ? `Balance ${fa(Number(formatUnits(balance, dec)))} ${sym} on Arc` : 'Loading balance…') : 'Connect to see your balance')}</span>
          {balance !== undefined && balance > 0n && (
            <button type="button" className="font-semibold text-signal-deep hover:underline" onClick={() => setAmountInput(formatUnits(balance, dec))}>
              Max
            </button>
          )}
        </div>
      </div>

      {shortfall > 0 && <OneBalanceFundingLazy shortfall={shortfall} onFunded={() => void p.refetchBalance()} />}

      {recipient.kind !== 'address' && (
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="pay-note" className="text-[13px] text-ink-3">
            Note <span className="font-normal">(optional, public onchain)</span>
          </Label>
          <Textarea id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Thanks for the thread." aria-invalid={noteTooLong || undefined} aria-describedby="pay-note-help" className="resize-none text-[15px]" />
          <div id="pay-note-help" className={cn('text-right text-[12px] text-ink-3', noteTooLong && 'text-bad')}>
            {note.length > 200 || noteTooLong ? `${noteBytes} / ${MAX_MESSAGE_BYTES}` : ''}
          </div>
        </div>
      )}

      <div className="mt-4">
        <TrustPanel
          summary={2}
          rows={
            isHandle
              ? [
                  { label: `${toLabel === 'They' ? 'They receive' : `${toLabel} receives`}`, value: amountNum != null ? `${fa(netNum)} ${sym}` : '—', strong: true },
                  { label: `XyloNet fee · ${Number(p.feeBps) / 100}%`, value: amountNum != null ? `${fa(feeNum)} ${sym}` : '—' },
                  { label: 'You send', value: amountNum != null ? `${fa(amountNum)} ${sym}` : '—' },
                  { label: 'Network', value: 'cents, paid in USDC' },
                  { label: 'Settlement', value: <span className="text-signal-deep">Instant</span> },
                ]
              : [
                  { label: `${toLabel} receives`, value: amountNum != null ? `${fa(amountNum)} ${sym}` : '—', strong: true },
                  { label: 'Fee', value: 'none' },
                  { label: 'You send', value: amountNum != null ? `${fa(amountNum)} ${sym}` : '—' },
                  { label: 'Network', value: 'cents, paid in USDC' },
                  { label: 'Settlement', value: <span className="text-signal-deep">Instant</span> },
                ]
          }
          note={
            recipient.kind !== 'address' ? (
              <>
                Held by the PayX contract (<Address value={p.contract} copy={false} />, owned by a 2-of-3 Safe) until {toLabel === 'They' ? 'they sign' : `${toLabel} signs`} in with X and claims. XyloNet never holds your funds.
              </>
            ) : (
              `A plain ${sym} transfer on Arc. No escrow, no fee.`
            )
          }
        />
      </div>

      {p.paused && (
        <div className="mt-3 rounded-lg border border-warn/30 bg-warn-tint px-4 py-3 text-[14px]" role="status">
          Payments to handles are paused by the guardian. Funds in escrow are safe.
        </div>
      )}
      {p.error && (
        <div className="mt-3 rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-[14px]" role="alert">
          {p.error}
        </div>
      )}

      <Button size="lg" className="mt-4 h-11 w-full text-[15px] font-semibold" disabled={isConnected && !ready} onClick={submit}>
        {cta}
      </Button>
      {isConnected && !onArc && <p className="mt-2 text-center text-[12px] text-ink-3">Your wallet will be asked to switch to Arc when you pay.</p>}
    </div>
  )
}
