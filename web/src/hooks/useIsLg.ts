'use client'

import { useSyncExternalStore } from 'react'

/** Tailwind's `lg` breakpoint, the point where the desktop layouts switch on. */
const QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const getSnapshot = () => window.matchMedia(QUERY).matches
const getServerSnapshot = () => false

/**
 * True from the lg breakpoint up. False on the server and during hydration, so
 * markup that depends on it renders the same on both sides and only data work
 * (polling for a block that is display:none below lg) is gated by it.
 */
export function useIsLg() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
