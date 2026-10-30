import type { Metadata } from 'next'
import { ExchangeClient } from './ExchangeClient'

export const metadata: Metadata = {
  title: 'Exchange',
  description:
    'Exchange USDC and EURC on Arc at the live rate. Routes are quoted and executed by LI.FI, fees are shown in USDC before you sign, and settlement is instant.',
  alternates: { canonical: '/exchange' },
}

export default function ExchangePage() {
  return <ExchangeClient />
}
