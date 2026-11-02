import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, ArrowRight, Send, Waypoints } from 'lucide-react'
import { cn } from '@/lib/utils'

const TILES: { href: string; label: string; line: string; icon: LucideIcon }[] = [
  { href: '/pay', label: 'Pay', line: 'Any X handle or wallet address.', icon: Send },
  { href: '/exchange', label: 'Exchange', line: 'USDC and EURC on Arc, or any token.', icon: ArrowLeftRight },
  { href: '/bridge', label: 'Bridge', line: 'Native USDC to and from Arc.', icon: Waypoints },
]

/**
 * The three ways in, as equal square tiles in one row on every width. Mint
 * fill with navy icon and label (never white on mint). Server-rendered.
 */
export function ActionTiles({ className }: { className?: string }) {
  return (
    <nav aria-label="Products" className={cn('grid max-w-[580px] grid-cols-3 gap-3 sm:gap-4 lg:max-w-none lg:gap-5', className)}>
      {TILES.map(({ href, label, line, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground shadow-card outline-none transition-[background-color,transform] hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px sm:gap-3 lg:relative lg:aspect-auto lg:min-h-[176px] lg:items-start lg:justify-start lg:gap-0 lg:p-6"
        >
          <Icon className="size-6 sm:size-7" strokeWidth={2} aria-hidden />
          <span className="text-[14px] font-semibold sm:text-[16px] lg:mt-auto lg:text-[20px] lg:font-bold lg:leading-tight">{label}</span>
          <span className="hidden text-[14px] font-medium leading-snug lg:mt-1 lg:block">{line}</span>
          <ArrowRight className="hidden size-5 lg:absolute lg:right-6 lg:top-6 lg:block lg:transition-transform lg:group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ))}
    </nav>
  )
}
