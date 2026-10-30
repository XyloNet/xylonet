'use client'

import dynamic from 'next/dynamic'
import type { WidgetConfig } from '@lifi/widget'
import type { LiFiMode } from '@/lib/lifi/config'
import { Skeleton } from '@/components/ui/skeleton'

/** What the widget looks like before its code arrives: the same shape, quiet. */
export function WidgetPlaceholder({ minHeight = 520 }: { minHeight?: number }) {
  return (
    <div className="grid gap-3 p-4" style={{ minHeight }} aria-busy="true" aria-label="Loading exchange">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-4 w-40" />
    </div>
  )
}

const LiFiWidgetClient = dynamic(() => import('./LiFiWidgetClient').then((m) => m.LiFiWidgetClient), {
  ssr: false,
  loading: () => <WidgetPlaceholder />,
})

/**
 * The LI.FI widget, loaded only on the routes that use it and only in the
 * browser. Keeps MUI, emotion and the non-EVM wallet stacks out of the shell.
 */
export function LiFiWidgetLazy(props: { mode: LiFiMode; overrides?: Partial<WidgetConfig>; className?: string }) {
  return <LiFiWidgetClient {...props} />
}
