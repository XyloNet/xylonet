'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import { getAddChainParams } from '@/config/wagmi'
import { ALL_BRIDGE_CHAINS, ARC, type BridgeChain } from '@/lib/bridge/chains'
import { createKitAdapter, friendlyKitError, getKit, onKitEvent, type KitAdapter, type KitEvent } from '@/lib/appkit/kit'
import { logBridgeStart } from '@/lib/admin/logClient'

/** Chains where Circle Gateway is live and our wallet config can switch to. */
export const UNIFIED_CHAINS: readonly BridgeChain[] = ALL_BRIDGE_CHAINS.filter((c) => !!(c.def as { gateway?: unknown }).gateway)

export function unifiedChainByKey(key: string): BridgeChain | undefined {
  return UNIFIED_CHAINS.find((c) => c.id === key || c.def.name === key)
}

export interface UnifiedRow {
  chain: BridgeChain | null
  key: string
  confirmed: number
  pending: number
}
export interface UnifiedBalances {
  total: number
  pending: number
  rows: UnifiedRow[]
  fetchedAt: number
}

export interface SpendEstimate {
  /** Circle's transfer fee plus source gas, in USDC. */
  providerFee: number
  forwarderFee: number
  receive: number
}

export type SpendStep = 'build' | 'sign' | 'attest' | 'mint'
export type Phase = 'idle' | 'depositing' | 'spending' | 'done' | 'error'
export interface StepLive {
  id: SpendStep
  state: 'pending' | 'active' | 'done' | 'error'
}

export interface UnifiedReceipt {
  kind: 'deposit' | 'spend'
  amount: number
  chain: BridgeChain | null
  txHash: string
  explorerUrl?: string
  settleMs: number
  fees?: number
}

const STEP_ORDER: SpendStep[] = ['build', 'sign', 'attest', 'mint']
const STEP_FROM_EVENT: Record<string, SpendStep> = { buildBurnIntents: 'build', signBurnIntents: 'sign', fetchAttestation: 'attest', mint: 'mint' }

function initialSteps(): StepLive[] {
  return STEP_ORDER.map((id) => ({ id, state: 'pending' }))
}

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * Circle Gateway through App Kit: one USDC balance deposited from any chain,
 * spendable on Arc (or any Gateway chain) with a signature instead of a bridge.
 */
export function useUnifiedBalance(opts: { balancesOnly?: boolean } = {}) {
  const { address, connector, isConnected, chainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const queryClient = useQueryClient()
  const adapterRef = useRef<KitAdapter | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [steps, setSteps] = useState<StepLive[]>(initialSteps)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<UnifiedReceipt | null>(null)

  const getAdapter = useCallback(async () => {
    if (!connector || !isConnected) throw new Error('Connect a wallet first.')
    if (adapterRef.current) return adapterRef.current
    const a = await createKitAdapter(connector)
    adapterRef.current = a
    return a
  }, [connector, isConnected])

  useEffect(() => {
    adapterRef.current = null
  }, [connector, address])

  const balances = useQuery<UnifiedBalances>({
    queryKey: ['unified-balance', address?.toLowerCase()],
    enabled: !!address && !!connector && isConnected,
    staleTime: 20_000,
    refetchInterval: opts.balancesOnly ? 60_000 : 20_000,
    queryFn: async () => {
      const adapter = await getAdapter()
      const kit = getKit()
      const r = (await kit.unifiedBalance.getBalances({ sources: { adapter }, networkType: 'mainnet', includePending: true })) as {
        totalConfirmedBalance: string
        totalPendingBalance?: string
        breakdown: { depositor: string; breakdown: { chain: string; confirmedBalance: string; pendingBalance?: string }[] }[]
      }
      const rows: UnifiedRow[] = []
      for (const d of r.breakdown ?? []) {
        for (const b of d.breakdown ?? []) {
          const confirmed = num(b.confirmedBalance)
          const pending = num(b.pendingBalance)
          if (confirmed <= 0 && pending <= 0) continue
          rows.push({ key: String(b.chain), chain: unifiedChainByKey(String(b.chain)) ?? null, confirmed, pending })
        }
      }
      rows.sort((a, b) => b.confirmed - a.confirmed)
      return { total: num(r.totalConfirmedBalance), pending: num(r.totalPendingBalance), rows, fetchedAt: Date.now() }
    },
  })

  const ensureChain = useCallback(
    async (target: number) => {
      if (chainId === target) return
      try {
        await switchChainAsync({ chainId: target })
      } catch (err) {
        const code = (err as { code?: number })?.code ?? (err as { cause?: { code?: number } })?.cause?.code
        const msg = String((err as { message?: string })?.message ?? '')
        const unknown = code === 4902 || /unrecognized chain|not been added|4902/i.test(msg)
        if (!unknown || !walletClient) throw err
        const params = getAddChainParams(target)
        if (!params) throw err
        await walletClient.request({ method: 'wallet_addEthereumChain', params: [params] })
        await switchChainAsync({ chainId: target })
      }
    },
    [chainId, switchChainAsync, walletClient],
  )

  const onEvent = useCallback((e: KitEvent) => {
    if (e.protocol !== 'gateway') return
    const step = e.tags?.step ? STEP_FROM_EVENT[e.tags.step] : undefined
    if (!step) return
    setSteps((prev) => {
      const idx = STEP_ORDER.indexOf(step)
      return prev.map((s, i) => (i < idx ? { ...s, state: s.state === 'error' ? s.state : 'done' } : i === idx ? { ...s, state: 'active' } : s))
    })
  }, [])

  useEffect(() => onKitEvent(onEvent), [onEvent])

  /** Deposit USDC from `chain` into the unified balance (one signature with permit; approve fallback). */
  const deposit = useCallback(
    async (chain: BridgeChain, amount: string) => {
      if (!address) throw new Error('Connect a wallet first.')
      setError(null)
      setReceipt(null)
      setPhase('depositing')
      const t0 = Date.now()
      try {
        await ensureChain(chain.chainId)
        const adapter = await getAdapter()
        const kit = getKit()
        const res = (await kit.unifiedBalance.deposit({
          from: { adapter, chain: chain.def },
          amount,
          token: 'USDC',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)) as { txHash: string; explorerUrl?: string }
        const rc: UnifiedReceipt = { kind: 'deposit', amount: Number(amount), chain, txHash: res.txHash, explorerUrl: res.explorerUrl, settleMs: Date.now() - t0 }
        logBridgeStart({ kind: 'gateway_deposit', wallet: address, amountUsd: Number(amount), fromChainId: chain.chainId, toChainId: chain.chainId, txHash: res.txHash })
        setReceipt(rc)
        setPhase('done')
        void queryClient.invalidateQueries({ queryKey: ['unified-balance'] })
        return rc
      } catch (err) {
        setError(friendlyKitError(err, 'The deposit did not complete.'))
        setPhase('error')
        throw err
      }
    },
    [address, ensureChain, getAdapter, queryClient],
  )

  const spendParams = useCallback(
    async (dest: BridgeChain, amount: string, recipient: string) => {
      const adapter = await getAdapter()
      const forward = (dest.def as { gateway?: { forwarderSupported?: { destination?: boolean } } }).gateway?.forwarderSupported?.destination === true
      return {
        amount,
        token: 'USDC' as const,
        from: { adapter },
        to: forward ? { chain: dest.def, recipientAddress: recipient, useForwarder: true as const } : { adapter, chain: dest.def, recipientAddress: recipient },
      }
    },
    [getAdapter],
  )

  /** Fees for spending `amount` onto `dest`, in USDC. */
  const estimateSpend = useCallback(
    async (dest: BridgeChain, amount: string, recipient: string): Promise<SpendEstimate> => {
      const kit = getKit()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const est = (await kit.unifiedBalance.estimateSpend((await spendParams(dest, amount, recipient)) as any)) as { fees?: { type: string; amount: string }[] }
      const sum = (t: string[]) => (est.fees ?? []).filter((f) => t.includes(f.type)).reduce((s, f) => s + num(f.amount), 0)
      const providerFee = sum(['provider', 'gasFee', 'kit'])
      const forwarderFee = sum(['forwarder'])
      return { providerFee, forwarderFee, receive: Math.max(0, Number(amount) - forwarderFee) }
    },
    [spendParams],
  )

  /** Spend from the unified balance: sign burn intents, Circle attests and mints on `dest`. */
  const spend = useCallback(
    async (dest: BridgeChain, amount: string, recipient: string) => {
      if (!address) throw new Error('Connect a wallet first.')
      setError(null)
      setReceipt(null)
      setSteps(initialSteps())
      setPhase('spending')
      const t0 = Date.now()
      try {
        const kit = getKit()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = (await kit.unifiedBalance.spend((await spendParams(dest, amount, recipient)) as any)) as { txHash: string; explorerUrl?: string; fees?: { type: string; amount: string }[] }
        setSteps((prev) => prev.map((s) => ({ ...s, state: 'done' })))
        const fees = (res.fees ?? []).reduce((s, f) => s + num(f.amount), 0)
        const rc: UnifiedReceipt = { kind: 'spend', amount: Number(amount), chain: dest, txHash: res.txHash, explorerUrl: res.explorerUrl, settleMs: Date.now() - t0, fees }
        logBridgeStart({ kind: 'gateway_spend', wallet: address, amountUsd: Number(amount), fromChainId: dest.chainId, toChainId: dest.chainId, txHash: res.txHash })
        setReceipt(rc)
        setPhase('done')
        void queryClient.invalidateQueries({ queryKey: ['unified-balance'] })
        void queryClient.invalidateQueries({ queryKey: ['usdc-balance'] })
        return rc
      } catch (err) {
        setSteps((prev) => prev.map((s) => (s.state === 'active' ? { ...s, state: 'error' } : s)))
        setError(friendlyKitError(err, 'The spend did not complete. Your balance is unchanged.'))
        setPhase('error')
        throw err
      }
    },
    [address, spendParams, queryClient],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setError(null)
    setReceipt(null)
    setSteps(initialSteps())
  }, [])

  const arc = useMemo(() => ARC, [])

  return { address, isConnected, balances, phase, steps, error, receipt, deposit, estimateSpend, spend, reset, arc }
}
