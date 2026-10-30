import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, type SessionData } from '@/lib/session'
import { normalizeHandle } from '@/lib/payx/handle'
import { addSubscription, removeSubscription } from '@/lib/push/store'
import { pushConfigured } from '@/lib/push/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const NO_STORE = { 'cache-control': 'no-store' }

/**
 * Only the browsers' own push services. The dispatcher POSTs to every stored
 * endpoint, so an arbitrary https URL here would turn it into a webhook.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /^android\.googleapis\.com$/]
function isPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 2048) return false
  try {
    const u = new URL(endpoint)
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

async function handleFromSession(): Promise<string | null> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.twitterHandle) return null
  return normalizeHandle(session.twitterHandle) ?? session.twitterHandle.toLowerCase()
}

/** POST: register this browser's push subscription for the signed-in handle. */
export async function POST(request: NextRequest) {
  if (!pushConfigured()) return NextResponse.json({ error: 'Notifications are not configured' }, { status: 503, headers: NO_STORE })
  const handle = await handleFromSession()
  if (!handle) return NextResponse.json({ error: 'Sign in with X first' }, { status: 401, headers: NO_STORE })
  const body = (await request.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null
  if (!body?.endpoint || !isPushEndpoint(body.endpoint) || !body.keys?.p256dh || !body.keys?.auth || body.keys.p256dh.length > 200 || body.keys.auth.length > 100) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400, headers: NO_STORE })
  }
  const count = await addSubscription(handle, { endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } })
  return NextResponse.json({ ok: true, devices: count }, { headers: NO_STORE })
}

/** DELETE: forget this browser's subscription. */
export async function DELETE(request: NextRequest) {
  const handle = await handleFromSession()
  if (!handle) return NextResponse.json({ error: 'Sign in with X first' }, { status: 401, headers: NO_STORE })
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null
  if (!body?.endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400, headers: NO_STORE })
  await removeSubscription(handle, body.endpoint)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
