import type { Metadata } from 'next'
import BridgeClient from './BridgeClient'

export const metadata: Metadata = {
  title: 'Bridge',
  description:
    'Move native USDC between Arc and 17 chains with Circle CCTP v2, or keep one balance with Circle Gateway and spend it on Arc with a signature. Any other token routes through LI.FI.',
  alternates: { canonical: '/bridge' },
}

export default async function BridgePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const initialTab = tab === 'unified' || tab === 'any' ? tab : 'usdc'
  return <BridgeClient initialTab={initialTab} />
}
