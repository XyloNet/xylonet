import Link from 'next/link'
import { Mark } from './Logo'
import { ChainLogo } from '@/components/ui/TokenLogos'
import { ARC_NETWORK } from '@/config/constants'
import { ThemeToggle } from './ThemeToggle'

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function DiscordLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
}

/** Explorer link that says which chain this is. Shared across the shell. */
export function ChainBadge({ className = '' }: { className?: string }) {
  return (
    <a
      href={ARC_NETWORK.explorer}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[12px] font-medium text-ink-2 hover:text-foreground ${className}`}
    >
      <ChainLogo chainId={5042} size={14} />
      Arc mainnet · {ARC_NETWORK.chainId}
    </a>
  )
}

const LINKS = [
  { href: '/docs', label: 'Docs' },
  { href: '/trust', label: 'Trust' },
  { href: '/whats-new', label: "What's new" },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 py-6 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-3">
          <span className="inline-flex items-center gap-2 text-foreground">
            <Mark className="h-3.5 text-ink-2" />
            <span className="font-semibold tracking-[-0.02em]">xylonet</span>
          </span>
          <span>Built on Arc by ForgeLabs</span>
          <ChainBadge />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} prefetch={false} className="text-ink-3 hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <span className="flex items-center gap-1">
            <a href="https://x.com/Xylonet_" target="_blank" rel="noopener noreferrer" aria-label="XyloNet on X" className="rounded-md p-1.5 text-ink-3 hover:bg-accent hover:text-foreground">
              <XLogo className="size-4" />
            </a>
            <a href="https://discord.gg/mcDkHNrFyA" target="_blank" rel="noopener noreferrer" aria-label="XyloNet on Discord" className="rounded-md p-1.5 text-ink-3 hover:bg-accent hover:text-foreground">
              <DiscordLogo className="size-4" />
            </a>
            <a href="https://github.com/XyloNet/xylonet" target="_blank" rel="noopener noreferrer" aria-label="XyloNet on GitHub" className="rounded-md p-1.5 text-ink-3 hover:bg-accent hover:text-foreground">
              <GitHubLogo className="size-4" />
            </a>
          </span>
          <span className="text-ink-3">© {new Date().getFullYear()} XyloNet</span>
          <ThemeToggle className="hidden md:inline-flex" />
        </div>
      </div>
    </footer>
  )
}
