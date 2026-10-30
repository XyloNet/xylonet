'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ChainLogo } from '@/components/ui/TokenLogos'
import { Identity } from '@/components/xylo/Identity'
import { Skeleton } from '@/components/ui/skeleton'
import { useWallet } from '@/hooks/useWallet'
import { useUsdcBalances } from '@/lib/wallet/useUsdcBalances'
import { ARC_CHAIN_ID } from '@/config/wagmi'
import { formatUsd } from '@/lib/format'

/**
 * A slim strip above the landing for a connected wallet: the dollar figure and
 * the way into the dashboard. The landing itself stays the front door for everyone.
 */
export function ConnectedStrip() {
  const { address, isConnected } = useWallet()
  const usdc = useUsdcBalances(address)
  if (!isConnected || !address) return null
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-[13.5px] sm:px-5">
        <Identity address={address} size="sm" />
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <ChainLogo chainId={ARC_CHAIN_ID} size={14} />
          {usdc.anyLoading && usdc.total === 0 ? <Skeleton className="h-4 w-20" /> : <span className="font-mono text-foreground" data-numeric>{formatUsd(usdc.total)}</span>}
          <span>USDC across your chains</span>
        </span>
        <Link href="/dashboard" className="ml-auto inline-flex items-center gap-1 font-semibold text-signal-deep">
          Open your dashboard <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
