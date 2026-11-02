'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'
import { NAV, isNavActive } from './nav'
import { WalletChip } from './WalletChip'
import { CommandPalette, useCommandPalette } from './CommandPalette'
import { WalletMount } from '@/components/wallet/WalletMount'
import { useWallet } from '@/hooks/useWallet'
import { cn } from '@/lib/utils'

/**
 * One header on every route: the mark, the four product verbs, the wallet.
 * While a wallet is connected, Account joins the bar after a hairline.
 * The command palette stays reachable on the keyboard (⌘K / Ctrl+K); theme and
 * the secondary destinations live in the footer and the phone "More" sheet.
 */
export function Header() {
  const pathname = usePathname()
  const palette = useCommandPalette()
  const { isConnected } = useWallet()

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-4 sm:px-5 lg:h-16">
        <Logo />

        <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 md:flex lg:ml-6 lg:gap-1">
          {NAV.filter((n) => n.href !== '/' && (!n.secondary || (n.href === '/dashboard' && isConnected))).map((item) => {
            const active = isNavActive(item, pathname)
            return (
              <Fragment key={item.href}>
                {item.href === '/dashboard' && <span aria-hidden className="mx-1 h-4 w-px bg-line-2" />}
                <Link
                  prefetch={false}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/80 lg:px-3 lg:text-[14px]',
                    active ? 'bg-secondary text-foreground' : 'text-ink-2 hover:bg-accent hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              </Fragment>
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
