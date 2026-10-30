'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'
import { NAV, isNavActive } from './nav'
import { WalletChip } from './WalletChip'
import { CommandPalette, useCommandPalette } from './CommandPalette'
import { WalletMount } from '@/components/wallet/WalletMount'
import { cn } from '@/lib/utils'

/**
 * One header on every route: the mark, the four product verbs, the wallet.
 * The command palette stays reachable on the keyboard (⌘K / Ctrl+K); theme and
 * the secondary destinations live in the footer and the phone "More" sheet.
 */
export function Header() {
  const pathname = usePathname()
  const palette = useCommandPalette()

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-4 sm:px-5">
        <Logo />

        <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 md:flex">
          {NAV.filter((n) => n.href !== '/' && !n.secondary).map((item) => {
            const active = isNavActive(item, pathname)
            return (
              <Link
                prefetch={false}
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  active ? 'bg-secondary text-foreground' : 'text-ink-2 hover:bg-accent hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <WalletChip />
        </div>
      </div>
      <CommandPalette state={palette} />
      <WalletMount />
    </header>
  )
}
