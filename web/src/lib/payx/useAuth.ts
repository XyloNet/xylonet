'use client'

import { useCallback, useEffect, useState } from 'react'

export interface XUser {
  handle: string
  name: string
  profileImage?: string
}

/** The X sign-in session for the creator hub. Cookie-backed; the server never exposes tokens. */
export function useAuth() {
  const [user, setUser] = useState<XUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'signed-in'>('loading')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/payx/auth/me', { credentials: 'include', cache: 'no-store' })
      if (r.ok) {
        const u = (await r.json()) as XUser
        setUser(u)
        setStatus('signed-in')
      } else {
        setUser(null)
        setStatus('signed-out')
      }
    } catch {
      setUser(null)
      setStatus('signed-out')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/payx/auth/twitter', { credentials: 'include' })
      const j = (await r.json()) as { authUrl?: string; error?: string }
      if (!r.ok || !j.authUrl) throw new Error(j.error || 'X sign-in is unavailable right now.')
      window.location.href = j.authUrl
    } catch (err) {
      setBusy(false)
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    setBusy(true)
    try {
      await fetch('/api/payx/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      setUser(null)
      setStatus('signed-out')
      setBusy(false)
    }
  }, [])

  return { user, status, busy, signIn, signOut, refresh }
}
