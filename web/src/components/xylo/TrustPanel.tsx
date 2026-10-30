'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TrustRow = {
  label: React.ReactNode
  value: React.ReactNode
  /** Emphasise (the "you receive" line). */
  strong?: boolean
}

/**
 * The cost-and-custody panel on every money flow. The first `summary` rows are
 * always visible (what they receive, the fee); the rest open under "Details".
 * With no `summary`, every row shows.
 */
export function TrustPanel({ rows, note, summary, className }: { rows: TrustRow[]; note?: React.ReactNode; summary?: number; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const collapsible = summary !== undefined && summary < rows.length
  const shown = collapsible && !open ? rows.slice(0, summary) : rows
  const hidden = collapsible ? rows.length - summary : 0

  return (
    <div className={cn('rounded-xl border border-border bg-card', className)}>
      <dl id={id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 py-3 text-[13.5px]">
        {shown.map((r, i) => (
          <div key={i} className="contents">
            <dt className={cn('text-ink-2', r.strong && 'font-semibold text-foreground')}>{r.label}</dt>
            <dd className={cn('text-right font-mono text-foreground', r.strong && 'font-semibold')} data-numeric>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center justify-between border-t border-dashed border-line-2 px-4 py-2 text-[12.5px] text-ink-3 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          <span>{open ? 'Fewer details' : `Details (${hidden} more)`}</span>
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      )}
      {note && (!collapsible || open) && <p className="border-t border-dashed border-line-2 px-4 py-2.5 text-[12.5px] text-ink-3">{note}</p>}
    </div>
  )
}
