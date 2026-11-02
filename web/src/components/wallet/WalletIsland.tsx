'use client'

import { useEffect, useState } from 'react'
import { RainbowKitProvider, connectorsForWallets, lightTheme, useConnectModal, type Theme } from '@rainbow-me/rainbowkit'
import { reconnect } from 'wagmi/actions'
import '@rainbow-me/rainbowkit/styles.css'
import { arcMainnet, config } from '@/config/wagmi'
import { WC_PROJECT_ID } from '@/config/wallet'
import { walletStore } from '@/lib/wallet/store'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

// RainbowKit reads these as CSS custom properties, so pointing them at our
// tokens makes the modal follow the light/dark theme and use our type/radii.
const base = lightTheme()
const walletTheme: Theme = {
  ...base,
  blurs: { modalOverlay: 'blur(6px)' },
  fonts: { body: 'var(--font-sans-app), ui-sans-serif, system-ui, sans-serif' },
  radii: { actionButton: '10px', connectButton: '10px', menuButton: '10px', modal: '20px', modalMobile: '20px' },
  shadows: {
    ...base.shadows,
    dialog: 'var(--shadow-float)',
    connectButton: 'none',
    profileDetailsAction: 'none',
    selectedOption: 'none',
    selectedWallet: 'none',
    walletLogo: 'none',
  },
  colors: {
    ...base.colors,
    accentColor: 'var(--primary)',
    accentColorForeground: 'var(--primary-foreground)',
    actionButtonBorder: 'var(--border)',
    actionButtonBorderMobile: 'var(--border)',
    actionButtonSecondaryBackground: 'var(--secondary)',
    closeButton: 'var(--ink-2)',
    closeButtonBackground: 'var(--secondary)',
    connectButtonBackground: 'var(--card)',
    connectButtonBackgroundError: 'var(--bad-tint)',
    connectButtonInnerBackground: 'var(--secondary)',
    connectButtonText: 'var(--foreground)',
    connectButtonTextError: 'var(--bad)',
    connectionIndicator: 'var(--signal)',
    downloadBottomCardBackground: 'var(--card)',
    downloadTopCardBackground: 'var(--secondary)',
    error: 'var(--bad)',
    generalBorder: 'var(--border)',
    generalBorderDim: 'var(--border)',
    menuItemBackground: 'var(--secondary)',
    modalBackdrop: 'rgba(25, 30, 41, 0.64)', // token-exempt: overlay scrim, Midnight Navy
    modalBackground: 'var(--card)',
    modalBorder: 'var(--border)',
    modalText: 'var(--foreground)',
    modalTextDim: 'var(--ink-3)',
    modalTextSecondary: 'var(--ink-2)',
    profileAction: 'var(--secondary)',
    profileActionHover: 'var(--accent)',
    profileForeground: 'var(--card)',
    selectedOptionBorder: 'var(--signal)',
    standby: 'var(--warn)',
  },
}

let registered = false

/**
 * Registers the full wallet list (WalletConnect, Coinbase, Safe, mobile
 * wallets) into the running wagmi config. Runs once, only after the island
 * has loaded, so none of those SDKs are part of the shell.
 */
async function registerWallets() {
  if (registered) return
  registered = true
  const w = await import('@rainbow-me/rainbowkit/wallets')
  const groups = [
    { groupName: 'Popular', wallets: [w.injectedWallet, w.metaMaskWallet, w.coinbaseWallet, w.rainbowWallet, w.walletConnectWallet] },
    { groupName: 'More', wallets: [w.rabbyWallet, w.phantomWallet, w.trustWallet, w.okxWallet, w.safeWallet] },
  ]
  // WalletConnect-backed wallets need a project id; without one, keep the rest.
  const list = WC_PROJECT_ID ? groups : groups.map((g) => ({ ...g, wallets: g.wallets.filter((x) => x !== w.walletConnectWallet && x !== w.rainbowWallet && x !== w.trustWallet && x !== w.okxWallet) }))
  const fns = connectorsForWallets(list, {
    appName: 'XyloNet',
    appDescription: 'The money app on Arc',
    appUrl: APP_URL,
    appIcon: `${APP_URL}/icon-512.png`,
    projectId: WC_PROJECT_ID || 'missing',
  })
  // Several wallets share one wagmi connector id ("walletConnect" for every
  // WalletConnect-backed wallet, "injected" for browser wallets), so identity
  // is the RainbowKit wallet id, not the connector id. The plain injected
  // connector from startup stays; RainbowKit's own injected entry is skipped.
  const registry = config._internal.connectors
  registry.setState((prev) => {
    const seen = new Set(prev.map((c) => (c as { rkDetails?: { id?: string } }).rkDetails?.id ?? c.id))
    const next = [...prev]
    for (const fn of fns) {
      const c = registry.setup(fn)
      const key = (c as { rkDetails?: { id?: string; isWalletConnectModalConnector?: boolean } }).rkDetails
      const id = key?.id ? `${key.id}${key.isWalletConnectModalConnector ? ':modal' : ''}` : c.id
      if (seen.has(id)) continue
      seen.add(id)
      next.push(c)
    }
    return next
  })
  // A session stored under one of the new connectors (WalletConnect, Coinbase)
  // could not reconnect at startup; try again now that it exists.
  void reconnect(config).catch(() => {})
}

function OpenerBridge() {
  const { openConnectModal } = useConnectModal()
  useEffect(() => {
    walletStore.registerOpener(openConnectModal ? () => openConnectModal() : null)
    return () => walletStore.registerOpener(null)
  }, [openConnectModal])
  return null
}

/**
 * The RainbowKit layer, loaded on demand. It carries the connect modal and
 * the wallet list; pages talk to it through the wallet store.
 */
export default function WalletIsland() {
  const [ready, setReady] = useState(registered)
  useEffect(() => {
    let alive = true
    registerWallets()
      .catch(() => {})
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  if (!ready) return null
  return (
    <RainbowKitProvider theme={walletTheme} modalSize="compact" initialChain={arcMainnet} appInfo={{ appName: 'XyloNet' }}>
      <OpenerBridge />
    </RainbowKitProvider>
  )
}
