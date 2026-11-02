'use client'

import { useEffect, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { createPublicClient, erc20Abi, fallback, http, formatUnits } from 'viem'
import { ChevronDown } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChainLogo } from '@/components/ui/TokenLogos'
import { bridgeChains, CHAIN_FALLBACK_RPCS, CHAIN_RPC_URLS } from '@/config/wagmi'
import { formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BridgeChain } from '@/lib/bridge/chains'

function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

/** USDC balances per chain, fetched only while the picker is open. */
function useChainBalances(chains: readonly BridgeChain[], address: string | undefined, enabled: boolean) {
  return useQueries({
    queries: chains.map((c) => ({
      queryKey: ['usdc-balance', c.chainId, address],
      enabled: enabled && !!address,
      staleTime: 30_000,
      queryFn: async () => {
        const viemChain = bridgeChains.find((x) => x.id === c.chainId)
        const primary = CHAIN_RPC_URLS[c.chainId]
        const extras = CHAIN_FALLBACK_RPCS[c.chainId] ?? []
        const client = createPublicClient({ chain: viemChain, transport: primary ? fallback([http(primary), ...extras.map((u) => http(u))]) : http() })
        const raw = await client.readContract({ address: c.def.usdcAddress as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] })
        return Number(formatUnits(raw, 6))
      },
    })),
  })
}

export function ChainPicker({
  chains,
  value,
  onChange,
  address,
  label,
  disabled,
}: {
  chains: readonly BridgeChain[]
  value: BridgeChain
  onChange: (c: BridgeChain) => void
  address?: string
  label: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const phone = useIsPhone()
  const balances = useChainBalances(chains, address, open)

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${value.name}`}
      className="inline-flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-[14px] font-semibold text-foreground outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/80 disabled:cursor-default disabled:hover:bg-secondary"
    >
      <ChainLogo chainId={value.chainId} size={18} />
      <span className="truncate">{value.name}</span>
      {/* A fixed side (Arc) has nothing to open, so it reads as a chip, not a menu. */}
      {!disabled && <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />}
    </button>
  )

  const list = (
    <Command className="bg-transparent">
      <CommandInput placeholder="Search chains" />
      <CommandList className="max-h-[50dvh]">
        <CommandEmpty>No chain matches.</CommandEmpty>
        <CommandGroup>
          {chains.map((c, i) => {
            const b = balances[i]
            return (
              <CommandItem
                key={c.chainId}
                value={`${c.name} ${c.chainId}`}
                onSelect={() => {
                  onChange(c)
                  setOpen(false)
                }}
                className={cn('h-11', c.chainId === value.chainId && 'bg-secondary')}
              >
                <ChainLogo chainId={c.chainId} size={20} />
                <span className="flex-1">{c.name}</span>
                <span className="font-mono text-[12.5px] text-ink-3" data-numeric>
                  {!address ? '' : b?.isLoading ? '…' : b?.data != null ? `${formatAmount(b.data)} USDC` : '—'}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )

  if (phone) {
    return (
      <>
        <span onClick={() => !disabled && setOpen(true)}>{trigger}</span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom,0px)]">
            <SheetHeader className="px-4 pt-4">
              <SheetTitle>{label}</SheetTitle>
              <SheetDescription className="sr-only">Choose a chain</SheetDescription>
            </SheetHeader>
            <div className="px-2 pb-2">{list}</div>
          </SheetContent>
        </Sheet>
      </>
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-80 p-1">
        {list}
      </PopoverContent>
    </Popover>
  )
}
