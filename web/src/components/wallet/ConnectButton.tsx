'use client'

import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/hooks/useWallet'
import { shortAddress } from '@/lib/format'
import { Identicon } from '@/components/shell/WalletChip'
import { cn } from '@/lib/utils'

/**
 * Inline connect control for page bodies. Disconnected: a primary "Connect
 * wallet" button. Connected: a quiet identity chip (the header chip owns the
 * account sheet). Extra props are accepted and ignored so legacy call sites
 * that passed RainbowKit options keep compiling.
 */
export function ConnectButton({
  label = 'Connect wallet',
  size = 'lg',
  className,
}: {
  label?: string
  size?: 'default' | 'lg' | 'sm'
  className?: string
  showBalance?: boolean
  chainStatus?: string
}) {
  const { address, isConnected, openConnect } = useWallet()
  if (isConnected && address) {
    return (
      <span className={cn('inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 font-mono text-[13px]', className)}>
        <Identicon address={address} size={18} />
        {shortAddress(address)}
      </span>
    )
  }
  return (
    <Button size={size} className={cn('h-10 px-4 font-semibold', className)} onClick={openConnect}>
      <Wallet data-icon="inline-start" />
      {label}
    </Button>
  )
}
