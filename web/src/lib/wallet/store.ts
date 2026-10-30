'use client'

import { useSyncExternalStore } from 'react'

/**
 * Tiny registry that lets any page ask for the connect modal without
 * importing RainbowKit. The wallet island (loaded lazily) registers the real
 * opener; until it has loaded, the request is remembered and honoured the
 * moment the island mounts.
 */
type State = { requested: boolean; mounted: boolean; opener: (() => void) | null }

let state: State = { requested: false, mounted: false, opener: null }
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const walletStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  /** Ask for the connect modal. Mounts the island if needed. */
  requestConnect() {
    if (state.opener) {
      state.opener()
      return
    }
    set({ requested: true, mounted: true })
  },
  /** Mount the island without opening anything (idle preload). */
  mount() {
    if (!state.mounted) set({ mounted: true })
  },
  registerOpener(opener: (() => void) | null) {
    set({ opener })
    if (opener && state.requested) {
      set({ requested: false })
      opener()
    }
  },
}

export function useWalletStore() {
  return useSyncExternalStore(walletStore.subscribe, walletStore.get, walletStore.get)
}
