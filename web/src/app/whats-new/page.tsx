import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: "What's new",
  description: 'XyloNet, rebuilt as the money app on Arc: one-signature payments, an exchange with every fee shown first, native USDC bridging with live steps, one balance across chains, points, receipts, notifications and a new identity.',
  alternates: { canonical: '/whats-new' },
}

const SECTIONS: { title: string; lead: string; items: { h: string; p: string; href?: string; cta?: string }[] }[] = [
  {
    title: 'Money moves in one signature',
    lead: 'Approvals were the tax on every action. On Arc they are gone.',
    items: [
      { h: 'Pay anyone on X in one tap', p: 'Approve and pay are batched through Arc’s batching contract, so a payment to an X handle is one signature and settles in under a second. The person you pay needs no wallet; they sign in with X and claim to any address.', href: '/pay', cta: 'Pay someone' },
      { h: 'Exchange with every fee shown first', p: 'USDC and EURC exchange on a card built for the pair: rate, minimum received, route and network cost before you sign, then approve and swap in one transaction. Any other token on 18 chains from the second tab.', href: '/exchange', cta: 'Open the exchange' },
      { h: 'Receipts that stand on their own', p: 'Every payment gets a page backed by the chain, a settled stamp with the real elapsed time and a share image. Send the link instead of a screenshot.' },
    ],
  },
  {
    title: 'One balance, many chains',
    lead: 'Native USDC in, native USDC out. Nothing wrapped, nothing pooled.',
    items: [
      { h: 'Bridge with live steps', p: 'Circle CCTP v2 in and out of Arc from 17 chains. The fee and the arrival amount are quoted before you sign, every step shows as it happens, and a stopped transfer resumes from the page.', href: '/bridge', cta: 'Bridge USDC' },
      { h: 'One balance via Circle Gateway', p: 'Deposit USDC once from any Gateway chain and spend it on Arc with a signature instead of a bridge. Circle attests and mints; XyloNet never holds it.', href: '/bridge?tab=unified', cta: 'Try one balance' },
      { h: 'A dashboard that adds it up', p: 'Connect and the home page becomes yours: one dollar figure across Arc and five other chains, EURC, your unified balance, points and what just happened.' },
    ],
  },
  {
    title: 'Built to be trusted',
    lead: 'Everything you would want to verify is on a page, live.',
    items: [
      { h: 'Trust page', p: 'The PayX contract’s owner, fee, escrow and solvency, both 2-of-3 Safes, RPC health and partner status, read from the chain every minute.', href: '/trust', cta: 'See the trust page' },
      { h: 'Points and activity', p: 'One point per dollar you move, computed from public data with no sign-up. A top-100 leaderboard, your breakdown, and a per-wallet activity feed.', href: '/points', cta: 'Check your points' },
      { h: 'Notifications and install', p: 'Creators can get a push notification when a payment lands. XyloNet installs as an app on your phone and keeps working offline for what it can.' },
    ],
  },
  {
    title: 'A new face',
    lead: 'Paper, ink and one signal colour for anything that moves money.',
    items: [
      { h: 'One shell for everything', p: 'Pay, Exchange, Bridge and Points in one header, with your account, the docs and the trust page one tap away. A bottom bar on phones, light and dark.' },
      { h: 'Docs in one place', p: 'Product docs and the PayX developer docs share one shell with a table of contents that follows you.', href: '/docs', cta: 'Read the docs' },
      { h: 'Accessible by default', p: 'Every page passes automated accessibility checks in both themes. Contrast, focus rings, keyboard paths and reduced motion are part of the design system, not an afterthought.' },
    ],
  },
]

export default function WhatsNewPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-20 pt-8 sm:px-5 md:pt-10">
      <PageHeader
        eyebrow="What's new · October 2026"
        title={
          <>
            XyloNet, rebuilt as the <em className="text-signal-deep">money app</em> on Arc.
          </>
        }
        description="Every page is new. Here is what changed, and where to try it."
      />
      <div className="mt-10 grid gap-12">
        {SECTIONS.map((s) => (
          <section key={s.title} className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr] md:gap-10">
            <div>
              <h2 className="type-display text-[30px] md:text-[34px]">{s.title}</h2>
              <p className="mt-2 text-[15px] text-ink-2">{s.lead}</p>
            </div>
            <div className="grid gap-3">
              {s.items.map((it) => (
                <article key={it.h} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-[16px] font-semibold">{it.h}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{it.p}</p>
                  {it.href && (
                    <Link href={it.href} className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold text-signal-deep">
                      {it.cta} <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-14 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-plate p-6 text-plate-foreground">
        <div className="min-w-0 flex-1">
          <div className="type-eyebrow text-plate-foreground/70">Start here</div>
          <p className="mt-1 text-[17px]">Pay someone on X. It is the fastest way to feel the difference.</p>
        </div>
        <Button size="lg" variant="secondary" className="h-10 px-4 font-semibold" render={<Link href="/pay" />}>
          Pay someone
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}
