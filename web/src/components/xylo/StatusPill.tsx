import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'signal'

const TONES: Record<Tone, string> = {
  neutral: 'border-border bg-card text-ink-2',
  ok: 'border-ok/30 bg-ok/10 text-ok',
  signal: 'border-signal-deep/30 bg-signal-tint text-signal-deep',
  warn: 'border-warn/30 bg-warn-tint text-warn',
  bad: 'border-bad/30 bg-bad-tint text-bad',
  info: 'border-info/30 bg-info-tint text-info',
}

/** Small state chip with a dot. Colour carries meaning; the label carries it too. */
export function StatusPill({
  tone = 'neutral',
  children,
  dot = true,
  pulse = false,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  dot?: boolean
  /** Only for states that are genuinely in progress (attesting, pending). */
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-[12px] font-semibold', TONES[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full bg-current', pulse && 'motion-safe:animate-pulse')} aria-hidden />}
      {children}
    </span>
  )
}
