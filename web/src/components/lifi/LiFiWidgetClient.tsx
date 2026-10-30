'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { LiFiWidget, type WidgetConfig } from '@lifi/widget'
import { WidgetSkeleton } from '@lifi/widget/skeleton'
import { buildLiFiConfig, type LiFiMode } from '@/lib/lifi/config'
import { disableWalletBatching } from '@/lib/lifi/disableWalletBatching'
import { useTheme } from 'next-themes'

interface LiFiWidgetClientProps {
  mode: LiFiMode
  /** Optional overrides merged on top of the mode's base config. */
  overrides?: Partial<WidgetConfig>
  className?: string
}

const subscribeNoop = () => () => {}

/**
 * Hydration guard: renders `WidgetSkeleton` on the server and on the first
 * client pass, then the live widget once the client has taken over.
 * (Pattern from LI.FI's Next.js App Router guidance.)
 */
function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

/**
 * LI.FI widget wrapper. Never renders the real widget on the server — the
 * widget touches `window`, wallet providers and wagmi context (which it picks
 * up automatically from our WagmiProvider in src/components/Providers.tsx).
 */
export function LiFiWidgetClient({ mode, overrides, className }: LiFiWidgetClientProps) {
  const isClient = useIsClient()
  const { resolvedTheme } = useTheme()
  const appearance = resolvedTheme === 'dark' ? 'dark' : 'light'
  const config = useMemo(() => buildLiFiConfig(mode, overrides, appearance), [mode, overrides, appearance])
  // Plain approve-then-swap in every wallet (no EIP-5792 batching / 7702 upgrade prompts).
  useEffect(() => {
    disableWalletBatching()
  }, [])

  return (
    <div className={className}>
      {isClient ? (
        <LiFiWidget integrator={config.integrator} config={config} />
      ) : (
        <WidgetSkeleton config={config} />
      )}
    </div>
  )
}

