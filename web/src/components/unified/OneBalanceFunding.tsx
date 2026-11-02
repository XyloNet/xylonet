'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Stepper, type Step } from '@/components/xylo/Stepper'
import { useUnifiedBalance } from '@/lib/unified/useUnifiedBalance'
import { formatAmount } from '@/lib/format'

const STEP_LABELS: Record<string, string> = { build: 'Prepare the spend', sign: 'Sign in your wallet', attest: 'Circle attestation', mint: 'Mint on Arc' }

/** Round up to cents so the amount that lands always covers the shortfall. */
function ceilCents(n: number): number {
  return Math.ceil(n * 100 - 1e-9) / 100
}

/**
 * Shown when a payment or exchange needs more USDC than the wallet holds on
 * Arc. If the wallet has a Circle Gateway balance that covers the gap, one
 * signature moves exactly the gap onto Arc; otherwise it points at the two
 * ways to bring USDC over.
 */
export function OneBalanceFunding({ shortfall, onFunded }: { shortfall: number; onFunded: () => void }) {
  const u = useUnifiedBalance()
  const total = u.balances.data?.total ?? 0
  const gap = ceilCents(shortfall)

  // Circle's fees for landing `gap` on Arc; the forwarding fee comes out of the amount, the rest out of the balance.
  const estimate = useQuery({
    queryKey: ['unified-topup-estimate', u.address?.toLowerCase(), gap],
    enabled: !!u.address && total > 0 && gap > 0 && u.phase === 'idle',
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const e = await u.estimateSpend(u.arc, gap.toFixed(2), u.address!)
      const amount = ceilCents(gap + e.forwarderFee)
      return { amount, arrives: amount - e.forwarderFee, fees: e.providerFee + e.forwarderFee, needs: amount + e.providerFee }
    },
  })

  if (!u.address || u.balances.isLoading) return null

  if (u.phase === 'spending' || u.phase === 'done') {
    const steps: Step[] = u.steps.map((s) => ({ id: s.id, label: STEP_LABELS[s.id], state: u.phase === 'done' ? 'done' : s.state }))
    return (
      <div className="mt-3 rounded-xl border border-border bg-background p-4" role="status">
        <div className="text-[13px] font-semibold">{u.phase === 'done' ? 'Arrived on Arc. Updating your balance…' : 'Moving USDC from your One balance to Arc'}</div>
        <Stepper steps={steps} className="mt-3" />
      </div>
    )
  }

  const e = estimate.data
  const covered = !!e && total >= e.needs

  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-4">
      {covered ? (
        <>
          <div className="text-[13.5px] text-ink-2">
            You have <span className="font-mono font-semibold text-foreground" data-numeric>{formatAmount(total)}</span> USDC in your One balance on Circle Gateway.
          </div>
          <Button
            size="lg"
            variant="outline"
            className="mt-3 h-10 w-full font-semibold"
            onClick={() => {
              u.spend(u.arc, e.amount.toFixed(2), u.address!)
                .then(() => onFunded())
                .catch(() => {})
            }}
          >
            Move {formatAmount(e.amount)} USDC to Arc
          </Button>
          <p className="mt-2 text-[12.5px] text-ink-3">
            One signature, no bridge wait. {formatAmount(e.arrives, { min: 2, max: 6 })} USDC arrives on Arc; Circle&apos;s fees are {formatAmount(e.fees, { min: 2, max: 6 })} USDC.
          </p>
        </>
      ) : (
        <p className="text-[13.5px] text-ink-2">
          {total > 0 ? (
            <>
              Your One balance holds <span className="font-mono text-foreground" data-numeric>{formatAmount(total)}</span> USDC{estimate.isError ? '' : ', not enough to cover this'}.{' '}
            </>
          ) : (
            <>Short on Arc? </>
          )}
          Bring USDC from another chain:{' '}
          <Link href="/bridge?tab=unified" className="font-semibold text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current">
            One balance
          </Link>{' '}
          or{' '}
          <Link href="/bridge" className="font-semibold text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current">
            bridge with CCTP
          </Link>
          .
        </p>
      )}
      {u.error && (
        <p className="mt-2 text-[13px] text-bad" role="alert">
          {u.error}
        </p>
      )}
    </div>
  )
}
