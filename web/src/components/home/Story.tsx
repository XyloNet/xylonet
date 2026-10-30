import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LiveCards } from './LiveCards'
import { ExampleReceipt } from './ExampleReceipt'

/** The signed-out home: the headline, three ways in, and one line of trust. Server-rendered. */
export function Story() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 sm:px-5">
      {/* hero */}
      <section className="grid gap-8 pt-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-16">
        <div>
          <h1 className="type-display text-[clamp(40px,7vw,72px)]">
            Move dollars like a <em className="text-signal-deep">message.</em>
          </h1>
          <p className="mt-4 max-w-[40ch] text-[17px] text-ink-2">Pay anyone on X, exchange USDC and EURC, bridge to Arc. Settled in under a second.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="lg" className="h-11 px-5 text-[15px] font-semibold" render={<Link href="/pay" />}>
              Pay someone
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-5 text-[15px]" render={<Link href="/exchange" />}>
              Exchange
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-5 text-[15px]" render={<Link href="/bridge" />}>
              Bridge
            </Button>
          </div>
        </div>
        <div className="md:justify-self-end">
          <ExampleReceipt />
        </div>
      </section>

      <div className="seam my-12" aria-hidden />

      {/* products, live */}
      <section aria-labelledby="products">
        <h2 id="products" className="sr-only">
          Products
        </h2>
        <LiveCards />
      </section>

      {/* trust, one line */}
      <p className="mt-10 text-center text-[14px] text-ink-2">
        XyloNet never holds your funds.{' '}
        <Link href="/trust" className="inline-flex items-center gap-1 font-semibold text-signal-deep underline-offset-4 hover:underline">
          Verify it live <ArrowRight className="size-3.5" />
        </Link>
      </p>
    </div>
  )
}
