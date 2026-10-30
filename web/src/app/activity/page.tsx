import type { Metadata } from 'next'
import { ActivityClient } from './ActivityClient'

export const metadata: Metadata = {
  title: 'Activity',
  description: 'Everything your wallet has done through XyloNet on Arc: exchanges, bridges, payments and claims, with receipts and explorer links.',
  robots: 'noindex, follow',
  alternates: { canonical: '/activity' },
}

export default function ActivityPage() {
  return <ActivityClient />
}
