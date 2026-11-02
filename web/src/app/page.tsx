import type { Metadata } from 'next'
import { Hero } from '@/components/home/Hero'
import { RecentActivity } from '@/components/home/RecentActivity'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/** Home: the welcome and the three tiles paint with the HTML; recent activity fills in on the client. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <RecentActivity />
    </>
  )
}
