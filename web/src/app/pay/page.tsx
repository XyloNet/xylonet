import type { Metadata } from 'next'
import { PayClient } from './PayClient'

export const metadata: Metadata = {
  title: 'Pay',
  description: 'Pay anyone on X in USDC, or send USDC to any address, settled instantly on Arc. One signature, fees in cents, receipts you can share.',
  alternates: { canonical: '/pay' },
}

export default async function PayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const amount = sp.amount && /^\d+(\.\d+)?$/.test(sp.amount) ? sp.amount : '5'
  return <PayClient to={sp.to ?? ''} amount={amount} note={(sp.note ?? '').slice(0, 280)} />
}
