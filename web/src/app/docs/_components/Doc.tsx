import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Docs primitives. Server-safe (no hooks) so every docs page can stay a server
 * component and export metadata. Sections render an h2 with a stable id; the
 * docs layout builds the "On this page" rail from those h2s.
 */

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function DocTitle({ eyebrow, title, lede }: { eyebrow?: React.ReactNode; title: React.ReactNode; lede?: React.ReactNode }) {
  return (
    <header className="mb-10">
      {eyebrow && <div className="type-eyebrow mb-2">{eyebrow}</div>}
      <h1 className="type-display text-[clamp(30px,4.5vw,40px)] text-foreground">{title}</h1>
      {lede && <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">{lede}</p>}
    </header>
  )
}

export function Section({ id, title, children, className }: { id?: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id ?? slugify(title)} className={cn('mt-10 scroll-mt-20', className)}>
      <h2 className="mb-3 text-[22px] font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function H3({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-[16px] font-semibold text-foreground', className)}>{children}</h3>
}

export function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[15px] leading-relaxed text-ink-2', className)}>{children}</p>
}

export function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('mt-3 text-[13px] text-ink-3', className)}>{children}</p>
}

export function Code({ children, className }: { children: string; className?: string }) {
  return (
    <pre className={cn('overflow-x-auto rounded-lg border border-border bg-surface-2 p-4 font-mono text-[13px] leading-relaxed text-foreground', className)}>
      <code>{children}</code>
    </pre>
  )
}

export function InlineCode({ children, className }: { children: React.ReactNode; className?: string }) {
  return <code className={cn('rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[0.92em] text-foreground', className)}>{children}</code>
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-border bg-card p-5', className)}>{children}</div>
}

const CALLOUT_TONES = {
  info: 'border-info/30 bg-info-tint text-foreground',
  warn: 'border-warn/30 bg-warn-tint text-foreground',
  bad: 'border-bad/30 bg-bad-tint text-foreground',
  signal: 'border-signal-deep/30 bg-signal-tint text-foreground',
  neutral: 'border-border bg-card text-foreground',
} as const

export function Callout({ tone = 'neutral', title, children, className }: { tone?: keyof typeof CALLOUT_TONES; title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border p-4 text-[14px] leading-relaxed', CALLOUT_TONES[tone], className)}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="text-ink-2">{children}</div>
    </div>
  )
}

/** Numbered steps. */
export function Steps({ items, className }: { items: Array<{ title: React.ReactNode; body?: React.ReactNode; note?: React.ReactNode }>; className?: string }) {
  return (
    <ol className={cn('grid gap-3', className)}>
      {items.map((s, i) => (
        <li key={i} className="flex gap-4 rounded-xl border border-border bg-card p-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal-tint font-mono text-[13px] font-semibold text-signal-deep" aria-hidden>
            {i + 1}
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-foreground">{s.title}</div>
            {s.body && <div className="mt-0.5 text-[14px] leading-relaxed text-ink-2">{s.body}</div>}
            {s.note && <div className="mt-2 text-[13px] text-ink-3">{s.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Bullets({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn('list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-2 marker:text-ink-3', className)}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

export function Numbered({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ol className={cn('list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink-2 marker:font-mono marker:text-ink-3', className)}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  )
}

export function DocTable({ head, rows, className }: { head: React.ReactNode[]; rows: React.ReactNode[][]; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border', className)}>
      <table className="w-full text-left text-[14px]">
        <thead className="bg-surface-2">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={cn('px-4 py-3 text-ink-2', j === 0 && 'font-medium text-foreground')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AddressLink({ address, href, className }: { address: string; href: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('break-all font-mono text-[13px] text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current', className)}>
      {address}
    </a>
  )
}

export function A({ href, children, className, external }: { href: string; children: React.ReactNode; className?: string; external?: boolean }) {
  const cls = cn('text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current', className)
  const isExternal = external ?? /^https?:\/\//.test(href)
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  )
}

export function LinkCard({ href, title, description, icon }: { href: string; title: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode }) {
  const isExternal = /^https?:\/\//.test(href)
  const inner = (
    <>
      {icon && <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-signal-tint text-signal-deep [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
          {title}
          {isExternal ? <ExternalLink className="size-3.5 text-ink-3" aria-hidden /> : <ArrowRight className="size-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />}
        </span>
        {description && <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{description}</span>}
      </span>
    </>
  )
  const cls = 'group flex gap-3 rounded-xl border border-border bg-card p-4 outline-none transition-colors hover:border-line-2 focus-visible:ring-3 focus-visible:ring-ring/80'
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  )
}

export function Stat({ value, label }: { value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="font-mono text-[22px] font-semibold text-foreground" data-numeric>
        {value}
      </div>
      <div className="mt-0.5 text-[13px] text-ink-3">{label}</div>
    </div>
  )
}

export function FaqList({ items }: { items: Array<{ q: string; a: React.ReactNode }> }) {
  return (
    <div className="grid gap-2">
      {items.map((f) => (
        <details key={f.q} className="group rounded-xl border border-border bg-card open:border-line-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-[15px] font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/80 [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="shrink-0 font-mono text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <div className="border-t border-border px-4 py-3.5 text-[14px] leading-relaxed text-ink-2">{f.a}</div>
        </details>
      ))}
    </div>
  )
}

/** End-of-page call to action. */
export function Cta({ title, description, primary, secondary }: { title: React.ReactNode; description?: React.ReactNode; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  const ext = (h: string) => /^https?:\/\//.test(h)
  return (
    <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
      <div className="min-w-0">
        <div className="text-[16px] font-semibold text-foreground">{title}</div>
        {description && <div className="mt-1 text-[14px] text-ink-2">{description}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {secondary && (
          <Button variant="outline" size="lg" render={ext(secondary.href) ? <a href={secondary.href} target="_blank" rel="noopener noreferrer" /> : <Link href={secondary.href} />}>
            {secondary.label}
          </Button>
        )}
        <Button size="lg" render={ext(primary.href) ? <a href={primary.href} target="_blank" rel="noopener noreferrer" /> : <Link href={primary.href} />}>
          {primary.label}
        </Button>
      </div>
    </div>
  )
}
