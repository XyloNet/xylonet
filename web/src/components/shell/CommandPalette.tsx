'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Copy, ExternalLink, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { NAV } from './nav'
import { ARC_EXPLORER_URL } from '@/config/wagmi'
import { CONTRACTS, TOKENS } from '@/config/constants'

export type PaletteState = { isOpen: boolean; open: () => void; close: () => void; setOpen: (v: boolean) => void }

export function useCommandPalette(): PaletteState {
  const [isOpen, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return useMemo(
    () => ({ isOpen, setOpen, open: () => setOpen(true), close: () => setOpen(false) }),
    [isOpen],
  )
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`)
  }
}

/** ⌘K: navigate, act, copy the addresses people keep asking for. */
export function CommandPalette({ state }: { state: PaletteState }) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

  const go = useCallback(
    (href: string) => {
      state.close()
      router.push(href)
    },
    [router, state],
  )
  const external = (href: string) => {
    state.close()
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <CommandDialog open={state.isOpen} onOpenChange={state.setOpen} title="Search and commands" description="Jump anywhere, copy an address, change the theme.">
      <CommandInput placeholder="Where to? Try “pay”, “bridge”, “USDC address”…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Go to">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.href} value={`go ${item.label} ${item.href}`} onSelect={() => go(item.href)}>
                <Icon />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Copy">
          <CommandItem value="copy usdc address arc" onSelect={() => copy(TOKENS.USDC.address, 'USDC address')}>
            <Copy />
            USDC on Arc
            <CommandShortcut className="font-mono">{TOKENS.USDC.address.slice(0, 10)}…</CommandShortcut>
          </CommandItem>
          <CommandItem value="copy eurc address arc" onSelect={() => copy(TOKENS.EURC.address, 'EURC address')}>
            <Copy />
            EURC on Arc
            <CommandShortcut className="font-mono">{TOKENS.EURC.address.slice(0, 10)}…</CommandShortcut>
          </CommandItem>
          {CONTRACTS.PAYX && (
            <CommandItem value="copy payx contract address" onSelect={() => copy(CONTRACTS.PAYX, 'PayX contract')}>
              <Copy />
              PayX contract
              <CommandShortcut className="font-mono">{CONTRACTS.PAYX.slice(0, 10)}…</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Elsewhere">
          <CommandItem value="arc explorer" onSelect={() => external(ARC_EXPLORER_URL)}>
            <ExternalLink />
            Arc explorer
          </CommandItem>
          <CommandItem value="arc docs" onSelect={() => external('https://docs.arc.io')}>
            <ExternalLink />
            Arc docs
          </CommandItem>
          <CommandItem value="xylonet on x twitter" onSelect={() => external('https://x.com/Xylonet_')}>
            <ExternalLink />
            XyloNet on X
          </CommandItem>
          <CommandItem value="discord community" onSelect={() => external('https://discord.gg/mcDkHNrFyA')}>
            <ExternalLink />
            Discord
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => {
              setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
              state.close()
            }}
          >
            {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
            {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
