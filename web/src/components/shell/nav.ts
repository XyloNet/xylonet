import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, BookOpen, Home, Send, ShieldCheck, Sparkles, UserRound, Waypoints } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Marks the item active for any path under `href`. */
  prefix?: boolean
  /** Hidden from the primary bar, shown under "More" and in the palette. */
  secondary?: boolean
}

/**
 * The product map: four verbs in the header, everything else one level down.
 * Account (/dashboard) carries the wallet's balances, points and activity.
 */
export const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/pay', label: 'Pay', icon: Send, prefix: true },
  { href: '/exchange', label: 'Exchange', icon: ArrowLeftRight },
  { href: '/bridge', label: 'Bridge', icon: Waypoints },
  { href: '/points', label: 'Points', icon: Sparkles },
  { href: '/dashboard', label: 'Account', icon: UserRound, secondary: true },
  { href: '/docs', label: 'Docs', icon: BookOpen, prefix: true, secondary: true },
  { href: '/trust', label: 'Trust', icon: ShieldCheck, secondary: true },
]

export function isNavActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false
  if (item.href === '/') return pathname === '/'
  if (item.href === '/dashboard') return pathname === '/dashboard' || pathname === '/activity'
  return item.prefix ? pathname.startsWith(item.href) : pathname === item.href
}
