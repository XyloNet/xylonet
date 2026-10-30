import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DesignClient } from './DesignClient'

export const metadata: Metadata = {
  title: 'Design system',
  robots: 'noindex, nofollow',
}

/** Internal living style guide: every token and component in every state. Development only. */
export default function DesignPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <DesignClient />
}
