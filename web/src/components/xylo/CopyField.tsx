'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** A read-only value with a copy button. */
export function CopyField({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* selectable fallback */
    }
  }
  return (
    <div className={cn('grid gap-1', className)}>
      {label && <span className="text-[12.5px] text-ink-3">{label}</span>}
      <div className="flex items-stretch gap-1.5">
        <input readOnly value={value} aria-label={label ?? 'Value'} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-[13px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
        <Button variant="outline" size="lg" className="h-9" onClick={copy} aria-label={copied ? 'Copied' : 'Copy'}>
          {copied ? <Check className="text-signal-deep" /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
