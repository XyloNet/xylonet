import { cn } from '@/lib/utils'
import { formatAmount, splitDecimals, type AmountFormat } from '@/lib/format'

type Size = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

const SIZES: Record<Size, { wrap: string; cents: string; code: string }> = {
  sm: { wrap: 'font-mono text-[13px]', cents: '', code: 'ml-1 text-[11px]' },
  md: { wrap: 'font-mono text-[15px]', cents: '', code: 'ml-1 text-[12px]' },
  lg: { wrap: 'font-mono text-[22px] font-medium tracking-[-0.01em]', cents: 'text-[0.8em]', code: 'ml-1.5 text-[13px] font-normal' },
  xl: { wrap: 'type-display text-[36px]', cents: 'text-[0.55em] text-ink-3', code: 'ml-2 font-sans text-[13px] text-ink-3' },
  hero: { wrap: 'type-display text-[clamp(44px,8vw,72px)]', cents: 'text-[0.5em] text-ink-3', code: 'ml-2 font-sans text-[15px] font-medium text-ink-3' },
}

export type AmountProps = {
  value: number | bigint | null | undefined
  /** Currency code shown after the number, e.g. USDC, EURC, USD. */
  currency?: string
  /** Prefix a sign and colour positive amounts mint. Negatives stay ink, never red. */
  signed?: boolean
  /** Leading "$" for USD values. */
  dollar?: boolean
  size?: Size
  format?: AmountFormat
  className?: string
}

/**
 * Every amount in the app goes through here: tabular mono, cents demoted at
 * display sizes, currency code secondary. Positive is mint, negative is ink.
 */
export function Amount({ value, currency, signed = false, dollar = false, size = 'md', format, className }: AmountProps) {
  const s = SIZES[size]
  if (value === null || value === undefined) {
    return <span className={cn(s.wrap, 'text-ink-3', className)} data-numeric>—</span>
  }
  const n = typeof value === 'bigint' ? Number(value) : value
  const abs = Math.abs(n)
  const formatted = formatAmount(abs, format)
  const [int, dec] = splitDecimals(formatted)
  const sign = signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : n < 0 ? '−' : ''
  const positive = signed && n > 0
  const demote = size === 'xl' || size === 'hero' || size === 'lg'
  return (
    <span className={cn(s.wrap, positive && 'text-signal-deep', className)} data-numeric>
      {sign}
      {dollar && '$'}
      {int}
      {dec && <span className={cn(demote && s.cents)}>{dec}</span>}
      {currency && <span className={cn(s.code, 'text-ink-3')}>{currency}</span>}
    </span>
  )
}
