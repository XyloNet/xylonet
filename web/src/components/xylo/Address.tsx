'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { shortAddress } from '@/lib/format'
import { ARC_EXPLORER_URL } from '@/config/wagmi'

export type AddressProps = {
  value: string
  /** 'address' | 'tx' decides the explorer path. */
  kind?: 'address' | 'tx'
  /** Explorer base for chains other than Arc. */
  explorerBase?: string
  label?: string
  copy?: boolean
  link?: boolean
  className?: string
}

/** Truncated hash or address with the full value on hover, copy and explorer. */
export function Address({ value, kind = 'address', explorerBase = ARC_EXPLORER_URL, label, copy = true, link = true, className }: AddressProps) {
  const [copied, setCopied] = useState(false)
  const short = kind === 'tx' ? shortAddress(value, 8, 6) : shortAddress(value)
  const href = `${explorerBase}/${kind}/${value}`
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard refused; the full value is still selectable */
    }
  }
  return (
    <span className={cn('inline-flex items-center gap-1 align-middle', className)}>
      {label && <span className="text-ink-3">{label}</span>}
      <Tooltip>
        <TooltipTrigger render={<span className="font-mono text-[0.95em] text-foreground select-all" />}>{short}</TooltipTrigger>
        <TooltipContent className="font-mono">{value}</TooltipContent>
      </Tooltip>
      {copy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? 'Copied' : `Copy ${kind === 'tx' ? 'transaction hash' : 'address'}`}
          className="inline-flex size-6 items-center justify-center rounded-sm text-ink-3 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {copied ? <Check className="size-3.5 text-signal-deep" /> : <Copy className="size-3.5" />}
        </button>
      )}
      {link && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in explorer"
          className="inline-flex size-6 items-center justify-center rounded-sm text-ink-3 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </span>
  )
}
