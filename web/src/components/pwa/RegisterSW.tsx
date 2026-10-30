'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/push/client'

/** Registers the service worker after load; nothing on the critical path. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    const id = window.setTimeout(() => void registerServiceWorker(), 2500)
    return () => window.clearTimeout(id)
  }, [])
  return null
}
