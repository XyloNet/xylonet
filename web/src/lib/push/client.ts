'use client'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!PUBLIC_KEY

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Ask permission, subscribe, and register the subscription for the signed-in handle. */
export async function subscribeToPayments(): Promise<'granted' | 'denied' | 'unsupported' | 'failed'> {
  if (!pushSupported()) return 'unsupported'
  const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await registerServiceWorker())
  if (!reg) return 'failed'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(PUBLIC_KEY) as BufferSource })
  const r = await fetch('/api/push/subscribe', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
  return r.ok ? 'granted' : 'failed'
}

export async function unsubscribeFromPayments(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await fetch('/api/push/subscribe', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}
