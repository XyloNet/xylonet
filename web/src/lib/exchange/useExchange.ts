'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConfig, usePublicClient, useReadContract } from 'wagmi'
import { getWalletClient } from 'wagmi/actions'
import { erc20Abi, formatUnits, parseUnits, type Account, type Address, type Chain, type Hex, type PublicClient, type Transport, type WalletClient } from 'viem'
import { CONTRACTS, LIFI, TOKENS } from '@/config/constants'
import { ARC_CHAIN_ID, arcMainnet } from '@/config/wagmi'
import { useWallet } from '@/hooks/useWallet'
import { MULTICALL3_FROM, MULTICALL3_FROM_ABI, approveCall, canBatchFrom, type Call3 } from '@/lib/arc/batch'

export type Side = 'USDC' | 'EURC'
export const PAIR: Record<Side, { address: Address; symbol: Side; decimals: number }> = {
  USDC: { address: TOKENS.USDC.address, symbol: 'USDC', decimals: 6 },
  EURC: { address: TOKENS.EURC.address, symbol: 'EURC', decimals: 6 },
}

export interface Quote {
  toAmount: bigint
  toAmountMin: bigint
  rate: number
  tool: string
  approvalAddress: Address
  tx: { to: Address; data: Hex; value: bigint; gasLimit?: bigint }
  gasUsd: number | null
  feeCosts: Array<{ name: string; percentage: number; amountUsd: number }>
  fetchedAt: number
}

export type ExchangeStage = 'idle' | 'switching' | 'approving' | 'approve-wait' | 'signing' | 'confirming' | 'done'

export interface ExchangeResult {
  txHash: Hex
  from: Side
  to: Side
  amountIn: bigint
  amountOut: bigint
  settleMs: number
  batched: boolean
  tool: string
}

const QUOTE_URL = 'https://li.quest/v1/quote'
const SLIPPAGE = 0.005

/** A same-chain exchange on Arc, quoted by LI.FI and executed from the user's wallet. */
export function useExchange(from: Side, to: Side, amountInput: string) {
  const { address, onArc, ensureArc } = useWallet()
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID }) as PublicClient | undefined
  const config = useConfig()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'error' | 'none'>('idle')
  const [stage, setStage] = useState<ExchangeStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [result, setResult] = useState<ExchangeResult | null>(null)
  const timer = useRef<number | null>(null)
  const seq = useRef(0)

  const amount = useMemo(() => {
    const t = amountInput.trim()
    if (!/^\d+(\.\d{0,6})?$/.test(t)) return null
    try {
      const v = parseUnits(t, 6)
      return v > 0n ? v : null
    } catch {
      return null
    }
  }, [amountInput])

  const { data: balanceIn, refetch: refetchIn } = useReadContract({ address: PAIR[from].address, abi: erc20Abi, functionName: 'balanceOf', args: address ? [address] : undefined, chainId: ARC_CHAIN_ID, query: { enabled: !!address, refetchInterval: 15_000 } })
  const { data: balanceOut, refetch: refetchOut } = useReadContract({ address: PAIR[to].address, abi: erc20Abi, functionName: 'balanceOf', args: address ? [address] : undefined, chainId: ARC_CHAIN_ID, query: { enabled: !!address, refetchInterval: 15_000 } })

  // Quote, debounced; refreshed every 30 s while idle.
  useEffect(() => {
    setQuote(null)
    if (!amount || from === to || stage !== 'idle') {
      setQuoteState('idle')
      return
    }
    setQuoteState('loading')
    if (timer.current) window.clearTimeout(timer.current)
    const run = async () => {
      const my = ++seq.current
      try {
        const url = new URL(QUOTE_URL)
        url.searchParams.set('fromChain', String(ARC_CHAIN_ID))
        url.searchParams.set('toChain', String(ARC_CHAIN_ID))
        url.searchParams.set('fromToken', PAIR[from].address)
        url.searchParams.set('toToken', PAIR[to].address)
        url.searchParams.set('fromAmount', amount.toString())
        url.searchParams.set('fromAddress', address ?? CONTRACTS.PAYX)
        url.searchParams.set('slippage', String(SLIPPAGE))
        url.searchParams.set('integrator', LIFI.integrator)
        if (LIFI.fee) url.searchParams.set('fee', String(LIFI.fee))
        const r = await fetch(url, { headers: { accept: 'application/json' } })
        if (my !== seq.current) return
        if (!r.ok) {
          setQuoteState(r.status === 404 ? 'none' : 'error')
          return
        }
        const j = (await r.json()) as {
          tool?: string
          estimate?: { toAmount?: string; toAmountMin?: string; approvalAddress?: string; gasCosts?: { amountUSD?: string }[]; feeCosts?: { name?: string; percentage?: string; amountUSD?: string }[] }
          transactionRequest?: { to?: string; data?: string; value?: string; gasLimit?: string }
        }
        const tr = j.transactionRequest
        if (!j.estimate?.toAmount || !tr?.to || !tr.data) {
          setQuoteState('none')
          return
        }
        const toAmount = BigInt(j.estimate.toAmount)
        setQuote({
          toAmount,
          toAmountMin: BigInt(j.estimate.toAmountMin ?? j.estimate.toAmount),
          rate: Number(formatUnits(toAmount, 6)) / Number(formatUnits(amount, 6)),
          tool: j.tool ?? 'LI.FI',
          approvalAddress: (j.estimate.approvalAddress ?? tr.to) as Address,
          tx: { to: tr.to as Address, data: tr.data as Hex, value: BigInt(tr.value ?? '0'), gasLimit: tr.gasLimit ? BigInt(tr.gasLimit) : undefined },
          gasUsd: j.estimate.gasCosts?.[0]?.amountUSD ? Number(j.estimate.gasCosts[0].amountUSD) : null,
          feeCosts: (j.estimate.feeCosts ?? []).map((f) => ({ name: f.name ?? 'fee', percentage: Number(f.percentage ?? 0), amountUsd: Number(f.amountUSD ?? 0) })),
          fetchedAt: Date.now(),
        })
        setQuoteState('idle')
      } catch {
        if (my === seq.current) setQuoteState('error')
      }
    }
    timer.current = window.setTimeout(run, 450)
    const iv = window.setInterval(run, 30_000)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      window.clearInterval(iv)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount?.toString(), from, to, address, stage])

  const exchange = useCallback(async () => {
    if (!address || !publicClient || !quote || !amount) throw new Error('Get a quote first.')
    setError(null)
    setTxHash(null)
    setResult(null)
    try {
      if (!onArc) {
        setStage('switching')
        const ok = await ensureArc()
        if (!ok) throw new Error('Please switch your wallet to Arc to continue.')
      }
      const walletClient = (await getWalletClient(config, { chainId: ARC_CHAIN_ID })) as unknown as WalletClient<Transport, Chain, Account>
      const allowance = await publicClient.readContract({ address: PAIR[from].address, abi: erc20Abi, functionName: 'allowance', args: [address, quote.approvalAddress] })
      let hash: Hex
      let batched = false
      if (allowance < amount && (await canBatchFrom(publicClient, address))) {
        const calls: Call3[] = [approveCall(PAIR[from].address, quote.approvalAddress, amount), { target: quote.tx.to, allowFailure: false, callData: quote.tx.data }]
        let ok = false
        try {
          await publicClient.simulateContract({ address: MULTICALL3_FROM, abi: MULTICALL3_FROM_ABI, functionName: 'aggregate3', args: [calls], account: address })
          ok = true
        } catch {
          ok = false
        }
        if (ok) {
          setStage('signing')
          hash = await walletClient.writeContract({ address: MULTICALL3_FROM, abi: MULTICALL3_FROM_ABI, functionName: 'aggregate3', args: [calls], account: address, chain: arcMainnet })
          batched = true
        } else {
          hash = await sequential()
        }
      } else if (allowance < amount) {
        hash = await sequential()
      } else {
        setStage('signing')
        hash = await walletClient.sendTransaction({ to: quote.tx.to, data: quote.tx.data, value: quote.tx.value, account: address, chain: arcMainnet })
      }
      async function sequential(): Promise<Hex> {
        setStage('approving')
        const a = await walletClient.writeContract({ address: PAIR[from].address, abi: erc20Abi, functionName: 'approve', args: [quote!.approvalAddress, amount!], account: address!, chain: arcMainnet })
        setStage('approve-wait')
        const rc = await publicClient!.waitForTransactionReceipt({ hash: a })
        if (rc.status !== 'success') throw new Error('The approval reverted onchain.')
        setStage('signing')
        return walletClient.sendTransaction({ to: quote!.tx.to, data: quote!.tx.data, value: quote!.tx.value, account: address!, chain: arcMainnet })
      }
      const signedAt = Date.now()
      setTxHash(hash)
      setStage('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The exchange reverted onchain. Nothing was taken.')
      const before = balanceOut ?? 0n
      const after = await publicClient.readContract({ address: PAIR[to].address, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
      const res: ExchangeResult = { txHash: hash, from, to, amountIn: amount, amountOut: after > before ? after - before : quote.toAmount, settleMs: Date.now() - signedAt, batched, tool: quote.tool }
      setResult(res)
      setStage('done')
      await Promise.all([refetchIn(), refetchOut()])
      return res
    } catch (err) {
      const m = String((err as { shortMessage?: string; message?: string })?.shortMessage ?? (err as { message?: string })?.message ?? '')
      setError(/rejected|denied/i.test(m) ? 'You cancelled in your wallet. Nothing was moved.' : m.length > 160 ? m.slice(0, 157) + '…' : m || 'The exchange did not complete.')
      setStage('idle')
      throw err
    }
  }, [address, publicClient, quote, amount, onArc, ensureArc, config, from, to, balanceOut, refetchIn, refetchOut])

  const reset = useCallback(() => {
    setStage('idle')
    setError(null)
    setTxHash(null)
    setResult(null)
  }, [])

  return { amount, quote, quoteState, stage, error, txHash, result, balanceIn, balanceOut, refetchBalanceIn: refetchIn, exchange, reset, slippage: SLIPPAGE }
}
