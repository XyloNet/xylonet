'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Explainer, ExplainerBlock, ExplainerLinks, ExplainerSteps } from '@/components/xylo/Explainer'
import { PayCard } from '@/components/pay/PayCard'
import { PayAgain } from '@/components/pay/PayAgain'
import { Button } from '@/components/ui/button'

/** Desktop aside copy. No fee percentage or minimum here: PayCard reads them live. */
const HOW_IT_WORKS = [
  'Enter an X handle or a wallet address, and an amount. What they receive and the fee show before you sign.',
  'Confirm in your wallet. Approve and pay are batched into one signature where the wallet allows it, otherwise two.',
  'Handles are paid into escrow in the PayX contract until they sign in with X and claim; addresses are paid directly. Arc confirms in well under a second; the receipt shows the time measured from your signature to confirmation.',
]

export function PayClient({ to, amount, note }: { to: string; amount: string; note: string }) {
  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-6 sm:px-5 md:pt-8 lg:grid lg:max-w-[1120px] lg:grid-cols-[560px_minmax(0,360px)] lg:items-start lg:justify-start lg:gap-x-16 lg:pt-14 lg:pb-28">
      <PageHeader
        className="lg:col-span-2 lg:mb-8"
        title="Pay anyone on X."
        actions={
          <span className="lg:hidden">
            <Button variant="outline" size="lg" className="h-9" render={<Link href="/pay/creator" />}>
              Claim your tips
            </Button>
          </span>
        }
      />
      <section aria-label="Pay" className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:col-start-1 lg:row-start-2 lg:mt-0">
        <PayCard key={to} initialTo={to} initialAmount={amount} initialNote={note} />
      </section>
      <p className="mt-3 text-center text-[13px] text-ink-3 lg:hidden">
        Handles are paid into escrow until they sign in with X; addresses are paid directly.{' '}
        <Link href="/docs/payx" className="text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current">
          How it works
        </Link>
      </p>
      <Explainer label="About paying">
        <ExplainerBlock eyebrow="How it works">
          <ExplainerSteps steps={HOW_IT_WORKS} />
          <ExplainerLinks
            links={[
              { href: '/docs/payx', label: 'How PayX works' },
              { href: '/trust', label: 'Trust page' },
            ]}
          />
        </ExplainerBlock>
        <PayAgain />
        <ExplainerBlock eyebrow="Were you paid?">
          <p className="mt-3 text-[14px] leading-[1.55] text-ink-2">Payments to your handle wait in escrow until you claim them. Sign in with X to see them and send them to any wallet.</p>
          <Button variant="outline" size="lg" className="mt-4 h-9" render={<Link href="/pay/creator" />}>
            Claim your tips
          </Button>
        </ExplainerBlock>
      </Explainer>
    </div>
  )
}
