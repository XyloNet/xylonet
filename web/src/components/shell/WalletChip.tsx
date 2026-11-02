'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBalance } from 'wagmi'
import { Check, Copy, ExternalLink, LogOut, UserRound, Wallet, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { ARC_CHAIN_ID, ARC_EXPLORER_URL } from '@/config/wagmi'
import { useWallet } from '@/hooks/useWallet'
import { cn } from '@/lib/utils'
import { Amount } from '@/components/xylo/Amount'
import { shortAddress } from '@/lib/format'

/**
 * One control for the whole wallet state: connect, identity, network and the
 * account sheet. The mint dot means "on Arc"; amber means "not on Arc".
 * Built on wagmi only, so it costs nothing until the wallet island loads.
 */
export function WalletChip({ className }: { className?: string }) {
  const { address, isConnected, status, openConnect } = useWallet()
  if (status === 'reconnecting') {
    return <span className={cn('inline-block h-9 w-[104px] rounded-lg bg-muted', className)} aria-hidden />
  }
  if (!isConnected || !address) {
    return (
      <Button size="lg" className={cn('h-9 px-3.5 font-semibold', className)} onClick={openConnect}>
        <Wallet data-icon="inline-start" />
        Connect wallet
      </Button>
    )
  }
  return <AccountChip className={className} address={address} />
}

function AccountChip({ className, address }: { className?: string; address: string }) {
  const { onArc, ensureArc, switching, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { data: bal } = useBalance({ address: address as `0x${string}`, chainId: ARC_CHAIN_ID, query: { enabled: open } })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy the address')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg border border-line-2 bg-card px-2.5 text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/80',
              className,
            )}
            aria-label={`Account ${shortAddress(address)}${onArc ? ', on Arc' : ', not on Arc'}`}
          />
        }
      >
        <span className={cn('size-2 rounded-full', onArc ? 'bg-signal' : 'bg-warn')} aria-hidden />
        <Identicon address={address} />
        <span className="hidden font-mono sm:inline">{shortAddress(address)}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Identicon address={address} size={36} />
            <div className="min-w-0">
              <div className="font-mono text-sm text-foreground">{shortAddress(address)}</div>
              <div className="text-xs text-ink-3">{onArc ? 'Connected to Arc' : 'Wallet is on another network'}</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2.5">
            <div className="type-eyebrow">USDC on Arc</div>
            <div className="mt-1">
              <Amount value={bal ? Number(bal.formatted) : null} currency="USDC" size="lg" />
            </div>
          </div>
          {!onArc && (
            <Button className="mt-3 w-full" size="lg" onClick={() => ensureArc().catch(() => {})} disabled={switching}>
              <Zap data-icon="inline-start" />
              {switching ? 'Switching…' : 'Switch to Arc'}
            </Button>
          )}
          <Button variant="outline" size="lg" className="mt-3 hidden w-full md:inline-flex" render={<Link href="/dashboard" />} onClick={() => setOpen(false)}>
            <UserRound data-icon="inline-start" />
            Account
          </Button>
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-1 p-2">
          <Button variant="ghost" size="sm" className="justify-center" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-center"
            render={<a href={`${ARC_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink />
            Explorer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-center text-bad hover:text-bad"
            onClick={() => {
              disconnect()
              setOpen(false)
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Deterministic four-band identicon from the address; no external avatar service. */
export function Identicon({ address, size = 20 }: { address: string; size?: number }) {
  const hex = address.toLowerCase().replace(/^0x/, '')
  const hues = [0, 8, 16, 24].map((i) => parseInt(hex.slice(i, i + 4) || '0', 16) % 360)
  return (
    <span
      className="inline-block shrink-0 rounded-full ring-1 ring-border"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from 90deg, hsl(${hues[0]} 55% 55%), hsl(${hues[1]} 55% 50%), hsl(${hues[2]} 55% 45%), hsl(${hues[3]} 55% 55%), hsl(${hues[0]} 55% 55%))`,
      }}
      aria-hidden
    />
  )
}
