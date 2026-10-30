import { NextResponse } from 'next/server'
import { adminRefusal, getAdminSession } from '@/lib/admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'cache-control': 'no-store' }

/** GET /api/admin/me — who is asking and whether they may see /admin. */
export async function GET() {
  const s = await getAdminSession()
  const refusal = adminRefusal(s)
  const body = { signedIn: s.signedIn, handle: s.handle, name: s.name, allowed: s.allowed, dev: s.dev }
  if (refusal) return NextResponse.json({ ...body, error: refusal.error }, { status: refusal.status, headers: NO_STORE })
  return NextResponse.json(body, { headers: NO_STORE })
}
