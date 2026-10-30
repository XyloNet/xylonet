'use client'

import * as m from 'motion/react-m'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format'

/**
 * The settle stamp: lands on a receipt the moment Arc finalises, with the
 * real elapsed time. The one signature motion in the app.
 */
export function SettledStamp({ ms, label = 'Settled', className }: { ms?: number; label?: string; className?: string }) {
  return (
    <m.span
      initial={{ opacity: 0, scale: 1.25, rotate: -6 }}
      animate={{ opacity: 1, scale: 1, rotate: -2 }}
      transition={{ type: 'spring', stiffness: 520, damping: 26, mass: 0.6 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-signal-deep bg-card px-2.5 py-1 text-[12.5px] font-bold uppercase tracking-[0.06em] text-signal-deep',
        className,
      )}
      role="status"
    >
      <Check className="size-3.5" strokeWidth={3} />
      {label}
      {typeof ms === 'number' && <span className="font-mono text-[12px] font-medium normal-case tracking-normal">{formatDuration(ms)}</span>}
    </m.span>
  )
}
