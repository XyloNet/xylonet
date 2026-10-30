import type { Metadata } from 'next'
import { Story } from '@/components/home/Story'
import { ConnectedStrip } from '@/components/home/ConnectedStrip'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/** Home is the landing for everyone; a connected wallet gets a strip into its dashboard. */
export default function HomePage() {
  return (
    <>
      <ConnectedStrip />
      <Story />
    </>
  )
}
