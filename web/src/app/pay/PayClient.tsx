'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/xylo/PageHeader'
import { PayCard } from '@/components/pay/PayCard'
import { Button } from '@/components/ui/button'

export function PayClient({ to, amount, note }: { to: string; amount: string; note: string }) {
  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-6 sm:px-5 md:pt-8">
      <PageHeader
        title="Pay anyone on X."
        actions={
          <Button variant="outline" size="lg" className="h-9" render={<Link href="/pay/creator" />}>
            Claim your tips
          </Button>
        }
      />
      <section aria-label="Pay" className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <PayCard initialTo={to} initialAmount={amount} initialNote={note} />
      </section>
      <p className="mt-3 text-center text-[13px] text-ink-3">
        Handles are paid into escrow until they sign in with X; addresses are paid directly.{' '}
        <Link href="/docs/payx" className="text-signal-deep underline-offset-4 hover:underline">
          How it works
        </Link>
      </p>
    </div>
  )
}
