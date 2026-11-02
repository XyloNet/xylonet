'use client'

import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Dashboard } from '@/components/home/Dashboard'
import { useWallet } from '@/hooks/useWallet'

/** The dashboard for a connected wallet; a plain connect prompt otherwise. */
export function DashboardGate() {
  const { isConnected, openConnect } = useWallet()
  if (isConnected) return <Dashboard />
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10 lg:max-w-[640px] lg:pt-28 lg:pb-32">
      <PageHeader
        align="center-lg"
        eyebrow="Account"
        title="Your dollars, in one place."
        description="Connect a wallet to see your USDC across Arc and other chains, your unified balance, points and what just happened."
      />
      <div className="mt-6 lg:mt-8 lg:flex lg:justify-center">
        <Button size="lg" className="h-11 px-5 text-[15px] font-semibold" onClick={openConnect}>
          <Wallet data-icon="inline-start" />
          Connect wallet
        </Button>
      </div>
      <p className="mt-5 hidden text-center text-[13px] text-ink-3 lg:block">Connecting a wallet reads its balances and activity. It never asks for a signature.</p>
    </div>
  )
}
