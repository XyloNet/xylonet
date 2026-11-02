import { useId } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Wordmark } from './Wordmark'

/**
 * The XyloNet mark (two crossing bands, the "X"), traced from the official
 * brand SVG. `fill="brand"` paints it with the brand gradient (Deep Ocean Blue
 * → teal → Neo Mint, as in the brand book); otherwise it takes currentColor.
 */
export function Mark({
  className,
  title = 'XyloNet',
  fill = 'current',
}: {
  className?: string
  title?: string
  fill?: 'current' | 'brand'
}) {
  // One gradient definition per instance, so several marks on a page never share an id.
  const gradientId = `xylo-brand-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      viewBox="0 0 4017.56 2690.46"
      className={cn('block h-5 w-auto', className)}
      role="img"
      aria-label={title}
      focusable="false"
    >
      {fill === 'brand' && (
        <defs>
          {/* token-exempt: the brand gradient stops from the brand book (#132D46 → #0A786A → #01C38E) */}
          <linearGradient id={gradientId} x1="0" y1="0.6" x2="1" y2="0.4">
            <stop offset="0" stopColor="#132D46" />
            <stop offset="0.62" stopColor="#0A786A" />
            <stop offset="1" stopColor="#01C38E" />
          </linearGradient>
        </defs>
      )}
      <path
        fill={fill === 'brand' ? `url(#${gradientId})` : 'currentColor'}
        d="M2538.1 1055.9l1479.46 -715.71 -166.6 -340.19 -1126.78 552.82c-235.86,115.75 -492.16,192.18 -701.88,191 -164.65,-0.96 -295.98,-51.56 -323.95,-170.56l-116.03 -493.5 -556.29 282.66 112.2 666 1399.86 27.47zm-1773.36 1151.56l963.73 482.99 1300.68 -612.25 -284 -878.16 -1447.28 -40.03 -1297.87 638.84 19.28 378.55 1054.63 -511.97c230.79,-112.04 482.89,-182.62 694.24,-171.7 173.79,8.98 319.39,74.98 356,221.52l84.82 339.56 -499.09 245.66 -534.44 -292.38 -410.7 199.38z"
      />
    </svg>
  )
}

/** Gradient mark + the Power Grotesk wordmark, as a link home. */
export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <Link
      prefetch={false}
      href="/"
      className={cn(
        'inline-flex items-center gap-2 rounded-md text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/80',
        className,
      )}
      aria-label="XyloNet home"
    >
      <Mark className="h-5 lg:h-6" fill="brand" />
      {wordmark && <Wordmark decorative className="h-[15px] w-auto text-foreground lg:h-[17px]" />}
    </Link>
  )
}
