import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { NAV } from '@/components/shell/nav'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: 'noindex, nofollow',
}

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-[1120px] items-center px-4 py-16 sm:px-5">
      <div className="w-full max-w-lg">
        <div className="type-eyebrow">404</div>
        <h1 className="type-display mt-2 text-[clamp(32px,5vw,48px)]">That page is not here.</h1>
        <p className="mt-3 text-ink-2">The link may be old or mistyped. Everything on XyloNet lives under one of these.</p>
        <div className="seam my-8" aria-hidden />
        <div className="flex flex-wrap gap-2">
          {NAV.filter((n) => n.href !== '/').map((n) => (
            <Button key={n.href} variant="outline" size="lg" render={<Link prefetch={false} href={n.href} />}>
              {n.label}
            </Button>
          ))}
          <Button size="lg" render={<Link prefetch={false} href="/" />}>
            Home
          </Button>
        </div>
      </div>
    </div>
  )
}
