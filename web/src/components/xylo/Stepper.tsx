'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Address } from './Address'

export type StepState = 'pending' | 'active' | 'done' | 'error'

export type Step = {
  id: string
  label: string
  state: StepState
  /** Right-hand meta: elapsed time, "Instant", an error. */
  meta?: React.ReactNode
  /** Transaction hash for an explorer link. */
  txHash?: string
  explorerBase?: string
}

/** Live transaction steps. Each row has its own state, meta and explorer link. */
export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn('grid gap-2', className)} aria-label="Transaction progress">
      {steps.map((s) => (
        <li
          key={s.id}
          aria-current={s.state === 'active' ? 'step' : undefined}
          className={cn(
            'grid grid-cols-[22px_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2.5 text-[14px]',
            s.state === 'error' ? 'border-bad/30 bg-bad-tint' : 'border-border bg-card',
          )}
        >
          <span
            className={cn(
              'grid size-[18px] place-items-center rounded-full border-2 text-[11px] font-extrabold',
              s.state === 'done' && 'border-signal bg-signal text-signal-foreground',
              s.state === 'active' && 'border-signal-deep shadow-[0_0_0_4px_var(--signal-tint)]',
              s.state === 'pending' && 'border-line-2',
              s.state === 'error' && 'border-bad bg-bad text-card',
            )}
            aria-hidden
          >
            {s.state === 'done' && <Check className="size-3" strokeWidth={3.5} />}
            {s.state === 'error' && <X className="size-3" strokeWidth={3.5} />}
          </span>
          <span className={cn(s.state === 'pending' && 'text-ink-3')}>
            {s.label}
            <span className="sr-only">
              {s.state === 'done' ? ', complete' : s.state === 'active' ? ', in progress' : s.state === 'error' ? ', failed' : ', not started'}
            </span>
          </span>
          <span className="flex items-center gap-2 font-mono text-[12px] text-ink-3">
            {s.txHash && <Address value={s.txHash} kind="tx" explorerBase={s.explorerBase} copy={false} />}
            {s.meta}
          </span>
        </li>
      ))}
    </ol>
  )
}
