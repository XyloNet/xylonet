'use client'

import { useCallback, useMemo, useState } from 'react'
import { useConfig, usePublicClient, useReadContract } from 'wagmi'
import { getWalletClient } from 'wagmi/actions'
import { encodeFunctionData, erc20Abi, parseUnits, type Account, type Address, type Chain, type PublicClient, type Transport, type WalletClient } from 'viem'
import { PayXTippingABI, PAYX_ERC20_ABI } from '@/config/abis/PayXTipping'
import { PAYX_ASSETS, isPayXAssetLive, type PayXAssetKey } from '@/config/constants'
import { ARC_CHAIN_ID, arcMainnet } from '@/config/wagmi'
import { friendlyPayXError } from '@/lib/payx/errors'
import { useWallet } from '@/hooks/useWallet'
import { MULTICALL3_FROM, MULTICALL3_FROM_ABI, approveCall, canBatchFrom } from '@/lib/arc/batch'

export type PayStage = 'idle' | 'switching' | 'approving' | 'approve-wait' | 'signing' | 'confirming' | 'done'
export type PayMode = 'handle' | 'address'

export interface PayResult {
  txHash: `0x${string}`
  amount: bigint
  fee: bigint
  net: bigint
  mode: PayMode
  to: string
  message: string
  /** Milliseconds from the wallet signature to the receipt. */
  settleMs: number
  /** True when approve and tip went through in one signature. */
  batched: boolean
}

/** Reads and actions for paying an X handle (escrow) or an address (direct), in one PayX asset. */
export function usePayX(handle: string | null, amount: bigint | null, assetKey: PayXAssetKey = 'USDC') {
  const ASSET = PAYX_ASSETS[assetKey]
  const { address, onArc, ensureArc } = useWallet()
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID }) as PublicClient | undefined
  const config = useConfig()
  const live = isPayXAssetLive(assetKey)
  const [stage, setStage] = useState<PayStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [result, setResult] = useState<PayResult | null>(null)

  const reads = { address: ASSET.contract, abi: PayXTippingABI, chainId: ARC_CHAIN_ID } as const
  const { data: feeBps } = useReadContract({ ...reads, functionName: 'platformFeeBps', query: { enabled: live, staleTime: 60_000 } })
  const { data: minTip } = useReadContract({ ...reads, functionName: 'minTipAmount', query: { enabled: live, staleTime: 60_000 } })
  const { data: paused } = useReadContract({ ...reads, functionName: 'paused', query: { enabled: live, refetchInterval: 30_000 } })
  const { data: handleInfo, refetch: refetchHandle } = useReadContract({
    ...reads,
    functionName: 'getHandleInfo',
    args: handle ? [handle] : undefined,
    query: { enabled: live && !!handle, refetchInterval: 15_000 },
  })
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: ASSET.token.address,
    abi: PAYX_ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ASSET.token.address,
    abi: PAYX_ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ASSET.contract] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: !!address && live },
  })

  const effectiveFeeBps = feeBps ?? ASSET.feeBpsFallback
  const effectiveMinTip = minTip ?? parseUnits(ASSET.minTipHuman, ASSET.token.decimals)
  const fee = amount !== null ? (amount * effectiveFeeBps) / 10_000n : 0n
  const net = amount !== null ? amount - fee : 0n

  const walletClientFor = useCallback(async () => {
    return (await getWalletClient(config, { chainId: ARC_CHAIN_ID })) as unknown as WalletClient<Transport, Chain, Account>
  }, [config])

  const payHandle = useCallback(
    async (to: string, value: bigint, message: string) => {
      if (!address || !publicClient) throw new Error('Connect a wallet first.')
      setError(null)
      setTxHash(null)
      setResult(null)
      try {
        if (!onArc) {
          setStage('switching')
          const ok = await ensureArc()
          if (!ok) throw new Error('Please switch your wallet to Arc to continue.')
        }
        const currentAllowance = await publicClient.readContract({ address: ASSET.token.address, abi: PAYX_ERC20_ABI, functionName: 'allowance', args: [address, ASSET.contract] })
        const walletClient = await walletClientFor()
        const tipData = encodeFunctionData({ abi: PayXTippingABI, functionName: 'tip', args: [to, value, message] })
        let batched = false
        let hash: `0x${string}`
        const t0 = Date.now()

        if (currentAllowance < value && (await canBatchFrom(publicClient, address))) {
          // One signature: approve (exact) + tip through Multicall3From.
          const calls = [approveCall(ASSET.token.address, ASSET.contract, value), { target: ASSET.contract as Address, allowFailure: false, callData: tipData }]
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
        } else if (currentAllowance < value) {
          hash = await sequential()
        } else {
          // Allowance already covers it: simulate (surfaces custom errors by name), then one signature.
          await publicClient.simulateContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'tip', args: [to, value, message], account: address })
          setStage('signing')
          hash = await walletClient.writeContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'tip', args: [to, value, message], account: address, chain: arcMainnet })
        }

        async function sequential(): Promise<`0x${string}`> {
          setStage('approving')
          const approveHash = await walletClient.writeContract({ address: ASSET.token.address, abi: PAYX_ERC20_ABI, functionName: 'approve', args: [ASSET.contract, value], account: address!, chain: arcMainnet })
          setStage('approve-wait')
          const r = await publicClient!.waitForTransactionReceipt({ hash: approveHash })
          if (r.status !== 'success') throw new Error(`${ASSET.token.symbol} approval failed onchain.`)
          await publicClient!.simulateContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'tip', args: [to, value, message], account: address! })
          setStage('signing')
          return walletClient.writeContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'tip', args: [to, value, message], account: address!, chain: arcMainnet })
        }

        const signedAt = Date.now()
        setTxHash(hash)
        setStage('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('The payment reverted onchain.')
        const settleMs = Date.now() - signedAt
        void t0
        const f = (value * effectiveFeeBps) / 10_000n
        const res: PayResult = { txHash: hash, amount: value, fee: f, net: value - f, mode: 'handle', to, message, settleMs, batched }
        setResult(res)
        setStage('done')
        await Promise.all([refetchHandle(), refetchBalance(), refetchAllowance()])
        return res
      } catch (err) {
        setError(friendlyPayXError(err, { symbol: ASSET.token.symbol, minTipHuman: ASSET.minTipHuman }).message)
        setStage('idle')
        throw err
      }
    },
    [address, publicClient, onArc, ensureArc, walletClientFor, effectiveFeeBps, refetchHandle, refetchBalance, refetchAllowance, ASSET],
  )

  const payAddress = useCallback(
    async (to: Address, value: bigint) => {
      if (!address || !publicClient) throw new Error('Connect a wallet first.')
      setError(null)
      setTxHash(null)
      setResult(null)
      try {
        if (!onArc) {
          setStage('switching')
          const ok = await ensureArc()
          if (!ok) throw new Error('Please switch your wallet to Arc to continue.')
        }
        const walletClient = await walletClientFor()
        setStage('signing')
        const hash = await walletClient.writeContract({ address: ASSET.token.address, abi: erc20Abi, functionName: 'transfer', args: [to, value], account: address, chain: arcMainnet })
        const signedAt = Date.now()
        setTxHash(hash)
        setStage('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('The transfer reverted onchain.')
        const res: PayResult = { txHash: hash, amount: value, fee: 0n, net: value, mode: 'address', to, message: '', settleMs: Date.now() - signedAt, batched: false }
        setResult(res)
        setStage('done')
        await refetchBalance()
        return res
      } catch (err) {
        setError(friendlyPayXError(err, { symbol: ASSET.token.symbol, minTipHuman: ASSET.minTipHuman }).message)
        setStage('idle')
        throw err
      }
    },
    [address, publicClient, onArc, ensureArc, walletClientFor, refetchBalance, ASSET],
  )

  const reset = useCallback(() => {
    setStage('idle')
    setError(null)
    setTxHash(null)
    setResult(null)
  }, [])

  return useMemo(
    () => ({
      live,
      paused: !!paused,
      feeBps: effectiveFeeBps,
      minTip: effectiveMinTip,
      fee,
      net,
      handleInfo,
      balance,
      allowance,
      stage,
      error,
      txHash,
      result,
      payHandle,
      payAddress,
      reset,
      refetchBalance,
      contract: ASSET.contract,
      token: ASSET.token,
      asset: ASSET,
    }),
    [ASSET, live, paused, effectiveFeeBps, effectiveMinTip, fee, net, handleInfo, balance, allowance, stage, error, txHash, result, payHandle, payAddress, reset, refetchBalance],
  )
}
