import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DesignClient } from './DesignClient'

export const metadata: Metadata = {
  title: 'Design system',
  robots: 'noindex, nofollow',
}

// Decided per request, not at build time: a statically prerendered page keeps
// its build-time answer, and the build always runs with NODE_ENV=production.
export const dynamic = 'force-dynamic'

/** Internal living style guide: every token and component in every state. Development only. */
export default function DesignPage() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') notFound()
  return <DesignClient />
}
