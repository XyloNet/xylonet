import 'server-only'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, isSessionConfigured, type SessionData } from '@/lib/session'

/**
 * Admin access = the existing X sign-in session plus an allowlist of handles.
 * ADMIN_X_HANDLES: comma-separated, case-insensitive, with or without "@".
 * ADMIN_DEV_HANDLE: development only (never read in production): treats
 * every request as that handle so the page can be built without X OAuth.
 */
const DEFAULT_HANDLES = ['panchu2605', 'carbzxbt', 'bloomstarbms']

export interface AdminSession {
  signedIn: boolean
  handle: string | null
  name: string | null
  allowed: boolean
  /** true when ADMIN_DEV_HANDLE stood in for a real sign-in. */
  dev: boolean
}

function norm(h: string): string {
  return h.trim().replace(/^@/, '').toLowerCase()
}

export function adminHandles(): string[] {
  const raw = process.env.ADMIN_X_HANDLES
  const list = raw ? raw.split(',').map(norm).filter(Boolean) : DEFAULT_HANDLES
  return list.length ? list : DEFAULT_HANDLES
}

export function isAdminHandle(handle: string | null | undefined): boolean {
  return !!handle && adminHandles().includes(norm(handle))
}

export async function getAdminSession(): Promise<AdminSession> {
  const devHandle = process.env.NODE_ENV !== 'production' ? process.env.ADMIN_DEV_HANDLE : undefined
  if (devHandle) {
    const h = norm(devHandle)
    return { signedIn: true, handle: h, name: `${h} (dev)`, allowed: isAdminHandle(h), dev: true }
  }
  if (!isSessionConfigured()) return { signedIn: false, handle: null, name: null, allowed: false, dev: false }
  try {
    const cookieStore = await cookies()
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
    if (!session.isLoggedIn || !session.twitterHandle) return { signedIn: false, handle: null, name: null, allowed: false, dev: false }
    return { signedIn: true, handle: session.twitterHandle, name: session.twitterName ?? null, allowed: isAdminHandle(session.twitterHandle), dev: false }
  } catch {
    return { signedIn: false, handle: null, name: null, allowed: false, dev: false }
  }
}

/** 401 when signed out, 403 when signed in but not on the list, null when allowed. */
export function adminRefusal(s: AdminSession): { status: 401 | 403; error: string } | null {
  if (!s.signedIn) return { status: 401, error: 'Sign in with X to continue.' }
  if (!s.allowed) return { status: 403, error: 'This page is for the XyloNet team.' }
  return null
}
