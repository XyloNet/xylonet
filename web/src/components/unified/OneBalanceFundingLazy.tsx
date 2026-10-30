'use client'

import dynamic from 'next/dynamic'

/** Circle Gateway top-up prompt; App Kit loads only when a wallet is actually short on Arc. */
export const OneBalanceFundingLazy = dynamic(() => import('./OneBalanceFunding').then((m) => m.OneBalanceFunding), { ssr: false, loading: () => null })
