'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type NavItem = { name: string; href: string }
type NavGroup = { title: string; items: NavItem[] }

const navigation: NavGroup[] = [
  {
    title: 'Getting started',
    items: [
      { name: 'Introduction', href: '/docs' },
      { name: 'Quick start', href: '/docs/quickstart' },
      { name: 'Network setup', href: '/docs/network' },
    ],
  },
  {
    title: 'Products',
    items: [
      { name: 'Exchange', href: '/docs/swap' },
      { name: 'Bridge', href: '/docs/bridge' },
      { name: 'Pay with PayX', href: '/docs/payx' },
      { name: 'Points', href: '/docs/points' },
    ],
  },
  {
    title: 'PayX in depth',
    items: [
      { name: 'Quick start', href: '/docs/payx/quickstart' },
      { name: 'How paying works', href: '/docs/payx/tipping' },
      { name: 'Claiming', href: '/docs/payx/claiming' },
      { name: 'Chrome extension', href: '/docs/payx/extension' },
      { name: 'Smart contract', href: '/docs/payx/contracts' },
      { name: 'Security', href: '/docs/payx/security' },
      { name: 'FAQ', href: '/docs/payx/faq' },
    ],
  },
  {
    title: 'Technical',
    items: [
      { name: 'Architecture', href: '/docs/architecture' },
      { name: 'Smart contracts', href: '/docs/contracts' },
      { name: 'Integration guide', href: '/docs/integration' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { name: 'Security', href: '/docs/security' },
      { name: 'FAQ', href: '/docs/faq' },
    ],
  },
]

const quickLinks: NavItem[] = [
  { name: 'Arc explorer', href: 'https://explorer.arc.io' },
  { name: 'Arc docs', href: 'https://docs.arc.io' },
  { name: 'GitHub', href: 'https://github.com/XyloNet/xylonet' },
  { name: 'X', href: 'https://x.com/Xylonet_' },
  { name: 'Discord', href: 'https://discord.gg/mcDkHNrFyA' },
]

const allItems = navigation.flatMap((g) => g.items)

function DocsNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navigation.map((group) => (
        <div key={group.title} className="mb-5">
          <div className="type-eyebrow mb-1.5 px-2.5">{group.title}</div>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-2.5 py-1.5 text-[14px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/80',
                      active ? 'bg-signal-tint font-medium text-signal-deep' : 'text-ink-2 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div className="mt-6 border-t border-border pt-5">
        <div className="type-eyebrow mb-1.5 px-2.5">Quick links</div>
        <ul className="grid gap-0.5">
          {quickLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[14px] text-ink-2 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/80"
              >
                {l.name}
                <ExternalLink className="size-3.5 text-ink-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

type Heading = { id: string; text: string }

/** Right rail: the h2s of the current page, scanned after mount. */
function OnThisPage({ pathname }: { pathname: string }) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const main = document.getElementById('docs-main')
    if (!main) return
    const nodes = Array.from(main.querySelectorAll<HTMLHeadingElement>('h2'))
    const seen = new Set<string>()
    const list: Heading[] = []
    for (const h of nodes) {
      const text = (h.textContent ?? '').trim()
      if (!text) continue
      let id =
        h.id ||
        (h.closest('section') as HTMLElement | null)?.id ||
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      while (seen.has(id)) id = `${id}-`
      seen.add(id)
      if (!h.id) h.id = id
      list.push({ id, text })
    }
    const raf = requestAnimationFrame(() => {
      setHeadings(list)
      setActive(list[0]?.id ?? null)
    })

    if (!list.length || typeof IntersectionObserver === 'undefined') return () => cancelAnimationFrame(raf)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive((visible[0].target as HTMLElement).id)
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    )
    for (const h of nodes) observer.observe(h)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [pathname])

  if (!headings.length) return null
  return (
    <nav aria-label="On this page" className="text-[13px]">
      <div className="type-eyebrow mb-2">On this page</div>
      <ul className="grid gap-1 border-l border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? 'location' : undefined}
              className={cn(
                '-ml-px block border-l py-0.5 pl-3 leading-snug outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/80',
                active === h.id ? 'border-signal text-foreground' : 'border-transparent text-ink-3 hover:text-foreground',
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Docs shell. The global header stays on top; this layout adds the section
 * sidebar, a readable main column and (on xl) the "On this page" rail.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [seenPath, setSeenPath] = useState(pathname)

  // Close the sheet on navigation (state adjusted during render, no effect).
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setOpen(false)
  }

  const currentName = allItems.find((i) => i.href === pathname)?.name ?? 'Docs'

  return (
    <div className="mx-auto max-w-[1120px] px-4 sm:px-5 xl:max-w-[1280px]">
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)_180px]">
        {/* Sidebar */}
        <aside className="hidden lg:block" aria-label="Docs navigation">
          <nav aria-label="Docs sections" className="sticky top-14 max-h-[calc(100dvh-3.5rem)] w-60 overflow-y-auto py-8 pr-2">
            <DocsNav pathname={pathname} />
          </nav>
        </aside>

        {/* Main */}
        <section id="docs-main" aria-label="Documentation" className="min-w-0 pb-16 pt-6 md:pt-8">
          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <div className="min-w-0 truncate text-[13px] text-ink-3">
              <Link href="/docs" className="text-ink-2 underline underline-offset-4 decoration-current/60 hover:decoration-current">
                Docs
              </Link>
              <span className="mx-1.5" aria-hidden>
                /
              </span>
              <span className="text-foreground">{currentName}</span>
            </div>
            <Sheet open={open} onOpenChange={setOpen}>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label="Open docs menu">
                <Menu data-icon="inline-start" />
                Docs menu
              </Button>
              <SheetContent side="left" className="w-[300px] overflow-y-auto">
                <SheetHeader className="pb-0">
                  <SheetTitle>Docs</SheetTitle>
                </SheetHeader>
                <nav aria-label="Docs sections" className="px-2 pb-6">
                  <DocsNav pathname={pathname} onNavigate={() => setOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          <div className="max-w-[760px]">{children}</div>
        </section>

        {/* Right rail */}
        <aside className="hidden xl:block" aria-label="On this page">
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-8">
            <OnThisPage pathname={pathname} />
          </div>
        </aside>
      </div>
    </div>
  )
}
