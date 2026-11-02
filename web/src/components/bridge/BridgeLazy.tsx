'use client'

import dynamic from 'next/dynamic'
import { WidgetPlaceholder } from '@/components/lifi/LiFiWidgetLazy'

/** The CCTP bridge card, loaded only on the bridge route and only in the browser. */
export const BridgeCardLazy = dynamic(() => import('./BridgeCard').then((m) => m.BridgeCard), {
  ssr: false,
  loading: () => <WidgetPlaceholder minHeight={620} label="Loading bridge" />,
})

/** The unified balance card (Circle Gateway), also browser-only. */
export const UnifiedCardLazy = dynamic(() => import('./UnifiedCard').then((m) => m.UnifiedCard), {
  ssr: false,
  loading: () => <WidgetPlaceholder minHeight={560} label="Loading unified balance" />,
})
