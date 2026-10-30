'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useWalletStore, walletStore } from '@/lib/wallet/store'

const WalletIsland = dynamic(() => import('./WalletIsland'), { ssr: false })

/**
 * Mounts the RainbowKit island off the critical path: on the first user
 * interaction, when a page asks to connect, when a session is being restored,
 * or after the page has been idle for a while. The shell paints and becomes
 * interactive before any wallet code runs.
 */
export function WalletMount() {
  const { mounted } = useWalletStore()

  useEffect(() => {
    if (mounted) return
    // A stored session under a lazily registered connector (WalletConnect,
    // Coinbase, ...) needs the island before it can reconnect. Injected
    // sessions reconnect through wagmi alone, so no island is needed for them.
    try {
      const recent = window.localStorage.getItem('wagmi.recentConnectorId')
      if (recent && !/injected|^"io\.|^"com\.|^"app\./.test(recent)) {
        walletStore.mount()
        return
      }
    } catch {
      /* storage unavailable */
    }
    const mount = () => walletStore.mount()
    const opts = { once: true, passive: true } as const
    window.addEventListener('pointerdown', mount, opts)
    window.addEventListener('keydown', mount, opts)
    window.addEventListener('touchstart', mount, opts)
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    const idle = w.requestIdleCallback ? w.requestIdleCallback(mount, { timeout: 6000 }) : window.setTimeout(mount, 4000)
    return () => {
      window.removeEventListener('pointerdown', mount)
      window.removeEventListener('keydown', mount)
      window.removeEventListener('touchstart', mount)
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
    }
  }, [mounted])

  return mounted ? <WalletIsland /> : null
}
