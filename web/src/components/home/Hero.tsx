import { Mark } from '@/components/shell/Logo'
import { ActionTiles } from './ActionTiles'

/**
 * The home hero: the welcome, one line on what the app does, the three tiles.
 * A faint brand mark sits top-right as a watermark, clipped to the section so
 * it never widens the page. Static, so it paints with the HTML.
 */
export function Hero() {
  return (
    <section className="relative" aria-labelledby="home-title">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        <Mark fill="brand" className="absolute -right-10 -top-6 h-auto w-[300px] opacity-[0.06] sm:w-[440px] md:-right-16 md:-top-10 md:w-[600px] lg:-right-28 lg:-top-20 lg:w-[760px]" />
      </div>
      <div className="relative mx-auto max-w-[1120px] px-4 pt-10 sm:px-5 md:pt-16 lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-8 lg:pt-24">
        <h1 id="home-title" className="type-display text-[clamp(32px,6vw,56px)] text-foreground lg:col-span-7 lg:max-w-[11ch] lg:text-[72px] lg:leading-[1] lg:tracking-[-0.03em]">
          <span className="lg:whitespace-nowrap">Welcome to</span> XyloNet
        </h1>
        <p className="mt-3 max-w-[44ch] text-[16px] text-ink-2 md:text-[17px] lg:col-span-5 lg:mt-0 lg:max-w-[38ch] lg:justify-self-end lg:self-end lg:pb-0.5 lg:text-[19px] lg:leading-[1.45]">
          Pay, exchange USDC and EURC, or bridge dollars. Settled instantly on Arc.
        </p>
        <ActionTiles className="mt-8 md:mt-10 lg:col-span-12 lg:mt-16" />
      </div>
    </section>
  )
}
