import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The desktop aside beside a money card (Pay, Exchange, Bridge): hairline-
 * separated blocks of plain type that answer what this is, what it costs and
 * how long it takes. Hidden below lg; presentational, no hooks.
 */
export function Explainer({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <aside aria-label={label} className={cn('hidden lg:grid lg:col-start-2 lg:row-start-2 lg:content-start lg:gap-10 lg:self-start lg:border-l lg:border-border lg:pl-8', className)}>
      {children}
    </aside>
  )
}

export function ExplainerBlock({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="type-eyebrow">{eyebrow}</h2>
      {children}
    </section>
  )
}

export function ExplainerSteps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol role="list" className="mt-3 grid gap-3 text-[14px] leading-[1.55] text-ink-2">
      {steps.map((s, i) => (
        <li key={i} className="grid grid-cols-[20px_1fr] gap-3">
          <span className="pt-0.5 font-mono text-[12px] text-ink-3" aria-hidden>
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  )
}

export function ExplainerLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-semibold text-signal-deep">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/80">
          {l.label} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ))}
    </div>
  )
}
