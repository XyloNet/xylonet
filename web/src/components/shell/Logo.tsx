import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The XyloNet mark (two crossing bands, the "X"), traced from the official
 * brand SVG and normalised to a 0 0 60 40 box. Fills with currentColor by
 * default; the shell renders it in the signal colour.
 */
export function Mark({
  className,
  title = 'XyloNet',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 4017.56 2690.46"
      className={cn('block h-5 w-auto', className)}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2538.1 1055.9l1479.46 -715.71 -166.6 -340.19 -1126.78 552.82c-235.86,115.75 -492.16,192.18 -701.88,191 -164.65,-0.96 -295.98,-51.56 -323.95,-170.56l-116.03 -493.5 -556.29 282.66 112.2 666 1399.86 27.47zm-1773.36 1151.56l963.73 482.99 1300.68 -612.25 -284 -878.16 -1447.28 -40.03 -1297.87 638.84 19.28 378.55 1054.63 -511.97c230.79,-112.04 482.89,-182.62 694.24,-171.7 173.79,8.98 319.39,74.98 356,221.52l84.82 339.56 -499.09 245.66 -534.44 -292.38 -410.7 199.38z"
      />
    </svg>
  )
}

/** Mark + lowercase wordmark, as a link home. */
export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <Link
      prefetch={false}
      href="/"
      className={cn(
        'inline-flex items-center gap-2 rounded-md text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
      aria-label="XyloNet home"
    >
      <Mark className="h-[18px] text-signal" />
      {wordmark && (
        <span className="text-[17px] font-semibold tracking-[-0.02em] leading-none">xylonet</span>
      )}
    </Link>
  )
}
