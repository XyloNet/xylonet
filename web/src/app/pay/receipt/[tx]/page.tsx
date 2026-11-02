import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatUnits, isHex } from 'viem'
import { Amount } from '@/components/xylo/Amount'
import { Address } from '@/components/xylo/Address'
import { Identity } from '@/components/xylo/Identity'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { Button } from '@/components/ui/button'
import { readTipReceipt } from '@/lib/payx/server'
import { formatAmount, formatDateTime } from '@/lib/format'
import { PAYX_ASSETS } from '@/config/constants'
import { CheckIcon } from './CheckIcon'

export const revalidate = 3600

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

function valid(tx: string): tx is `0x${string}` {
  return isHex(tx) && tx.length === 66
}

export async function generateMetadata({ params }: { params: Promise<{ tx: string }> }): Promise<Metadata> {
  const { tx } = await params
  if (!valid(tx)) return { title: 'Receipt' }
  const r = await readTipReceipt(tx).catch(() => null)
  const title = r ? `${formatAmount(Number(formatUnits(r.amount, r.decimals)), PAYX_ASSETS[r.asset].fractionDigits)} ${r.symbol} to @${r.handle}` : 'Receipt'
  return {
    title,
    description: r ? `Paid on Arc via XyloNet, settled instantly.` : 'A payment receipt on XyloNet.',
    robots: 'noindex, follow',
    openGraph: { title, url: `${APP_URL}/pay/receipt/${tx}` },
    twitter: { card: 'summary_large_image', title },
  }
}

/** Public, shareable receipt for a payment to a handle. Read from the chain, so it cannot be forged. */
export default async function ReceiptPage({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params
  if (!valid(tx)) notFound()
  const r = await readTipReceipt(tx).catch(() => null)
  if (!r) notFound()
  const amount = Number(formatUnits(r.amount, r.decimals))
  const asset = PAYX_ASSETS[r.asset]
  const isDollar = asset.currencyPrefix === '$'
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-16 pt-10 sm:px-5">
      <h1 className="sr-only">
        Receipt: {formatAmount(amount, asset.fractionDigits)} {r.symbol} to @{r.handle}
      </h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="type-eyebrow">Receipt · Arc</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-signal-deep px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] text-signal-deep">
            <CheckIcon />
            Settled
          </span>
        </div>
        <div className="px-6 py-6">
          <Amount value={amount} size="hero" dollar={isDollar} currency={r.symbol} format={asset.fractionDigits} />
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <div className="text-[12px] text-ink-3">From</div>
              <Identity address={r.tipper} />
            </div>
            <div>
              <div className="text-[12px] text-ink-3">To</div>
              <Link href={`/to/${r.handle}`} className="font-medium text-foreground hover:text-signal-deep">
                @{r.handle}
              </Link>
            </div>
            <div>
              <div className="text-[12px] text-ink-3">When</div>
              <div className="text-[14px]">{formatDateTime(r.timestamp * 1000)}</div>
            </div>
          </div>
          {r.message && <p className="mt-5 border-l-2 border-signal pl-3 text-[16px] text-ink-2">“{r.message}”</p>}
          <div className="mt-6">
            <TrustPanel
              rows={[
                { label: `@${r.handle} receives`, value: `${formatAmount(Number(formatUnits(r.net, r.decimals)), asset.fractionDigits)} ${r.symbol}`, strong: true },
                { label: 'XyloNet fee, 1%', value: `${formatAmount(Number(formatUnits(r.fee, r.decimals)), asset.fractionDigits)} ${r.symbol}` },
                { label: 'Transaction', value: <Address value={r.txHash} kind="tx" /> },
                { label: 'Block', value: r.blockNumber.toString() },
              ]}
              note="Held by the PayX contract on Arc until the handle signs in with X and claims. Read from the chain; nothing here can be edited."
            />
          </div>
        </div>
        <div className="seam" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <span className="text-[13px] text-ink-2">
            Are you @{r.handle}?{' '}
            <Link href="/pay/creator" className="font-semibold text-signal-deep underline underline-offset-4">
              Sign in with X to claim
            </Link>
          </span>
          <Button size="lg" variant="outline" className="h-9" render={<Link href={`/to/${r.handle}`} />}>
            Pay @{r.handle} too
          </Button>
        </div>
      </div>
    </div>
  )
}
