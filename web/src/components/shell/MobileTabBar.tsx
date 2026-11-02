'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Ellipsis, ExternalLink } from 'lucide-react'
import { NAV, isNavActive } from './nav'
import { ThemeToggle } from './ThemeToggle'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ARC_EXPLORER_URL } from '@/config/wagmi'
import { cn } from '@/lib/utils'

const PRIMARY = NAV.filter((n) => !n.secondary).slice(0, 4)
const MORE = NAV.filter((n) => !PRIMARY.includes(n))

/** Phone navigation: four verbs and More, one tap from anywhere. */
export function MobileTabBar() {
  const pathname = usePathname()
  const [more, setMore] = useState(false)
  const moreActive = MORE.some((n) => isNavActive(n, pathname))

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/92 backdrop-blur-md safe-bottom md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {PRIMARY.map((item) => {
            const active = isNavActive(item, pathname)
            const Icon = item.icon
            return (
              <li key={item.href} className="contents">
                <Link prefetch={false}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/80',
                    active ? 'text-signal-deep' : 'text-ink-3',
                  )}
                >
                  <span className={cn('flex h-7 w-11 items-center justify-center rounded-md', active && 'bg-signal-tint')}>
                    <Icon className="size-[19px]" strokeWidth={active ? 2.25 : 1.9} />
                  </span>
                  {item.label}
                </Link>
              </li>
            )
          })}
          <li className="contents">
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-haspopup="dialog"
              aria-expanded={more}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/80',
                moreActive ? 'text-signal-deep' : 'text-ink-3',
              )}
            >
              <span className={cn('flex h-7 w-11 items-center justify-center rounded-md', moreActive && 'bg-signal-tint')}>
                <Ellipsis className="size-[19px]" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">Other destinations and settings</SheetDescription>
          </SheetHeader>
          <ul className="mt-2 grid gap-1">
            {MORE.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link prefetch={false}
                    href={item.href}
                    onClick={() => setMore(false)}
                    className="flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium hover:bg-accent"
                  >
                    <Icon className="size-5 text-ink-2" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
            <li>
              <a
                href={ARC_EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium hover:bg-accent"
              >
                <ExternalLink className="size-5 text-ink-2" />
                Arc explorer
              </a>
            </li>
            <li className="flex h-12 items-center justify-between rounded-lg px-3 text-[15px] font-medium">
              <span>Theme</span>
              <ThemeToggle />
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
