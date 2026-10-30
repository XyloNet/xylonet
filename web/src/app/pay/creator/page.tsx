import type { Metadata } from 'next'
import { CreatorClient } from './CreatorClient'

export const metadata: Metadata = {
  title: 'Your tips',
  description: 'Sign in with X to see and claim USDC sent to your handle, review what you have received, and share your pay link.',
  robots: 'noindex, follow',
  alternates: { canonical: '/pay/creator' },
}

export default async function CreatorHubPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const tab = sp.tab === 'history' || sp.tab === 'share' ? sp.tab : 'claim'
  return <CreatorClient tab={tab} authError={sp.error ?? null} authReason={sp.reason ?? null} />
}
