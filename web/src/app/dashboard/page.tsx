import type { Metadata } from 'next'
import { DashboardGate } from './DashboardGate'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Your dollars across Arc and other chains, quick actions, points and recent activity.',
  robots: { index: false, follow: false },
}

export default function DashboardPage() {
  return <DashboardGate />
}
