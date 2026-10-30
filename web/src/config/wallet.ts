'use client'

import { config } from './wagmi'

/** The browser-side wagmi config. Wallet connectors beyond injected are
 *  registered lazily by the wallet island; see WalletIsland.tsx. */
export const walletConfig = config

export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
