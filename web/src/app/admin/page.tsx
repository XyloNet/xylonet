import type { Metadata } from 'next'
import { AdminClient } from './AdminClient'
import { AdminGate } from './AdminGate'
import { getAdminSession } from '@/lib/admin/auth'

export const metadata: Metadata = {
  title: 'Admin',
  robots: 'noindex, nofollow',
}

export const dynamic = 'force-dynamic'

/** Team-only analytics. Not linked anywhere; the session decides what renders. */
export default async function AdminPage() {
  const s = await getAdminSession()
  if (!s.signedIn || !s.allowed) return <AdminGate signedIn={s.signedIn} handle={s.handle} />
  return <AdminClient handle={s.handle ?? ''} dev={s.dev} />
}
