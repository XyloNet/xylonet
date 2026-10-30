'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import { getAddChainParams } from '@/config/wagmi'
import { createKitAdapter, getKit, onKitEvent, type KitAdapter, type KitEvent } from '@/lib/appkit/kit'
import { ARC, canUseForwarder, explorerTx, type BridgeChain } from './chains'
import { logBridgeStart } from '@/lib/admin/logClient'

export type Speed = 'FAST' | 'SLOW'
export type StepId = 'approve' | 'burn' | 'attest' | 'mint'
export type StepState = 'pending' | 'active' | 'done' | 'error' | 'skipped'
export interface LiveStep {
  id: StepId
  state: StepState
  txHash?: string
  explorerUrl?: string
  startedAt?: number
  endedAt?: number
}
export interface Estimate {
  /** Fees taken from the transfer, in USDC. */
  providerFee: number
  forwarderFee: number
  /** What arrives on the destination, in USDC. */
  receive: number
  /** Source-chain gas for approve + burn, in the chain's native token. */
  sourceGas: number | null
  /** Destination gas for mint (only when the user mints), in the chain's native token. */
  destGas: number | null
}
export type Phase = 'idle' | 'bridging' | 'done' | 'error'

type KitStep = { name?: string; state?: string; txHash?: string; explorerUrl?: string; data?: { txHash?: string } }
type KitResult = { state: 'pending' | 'success' | 'error'; steps?: KitStep[]; error?: unknown }

const STEP_ORDER: StepId[] = ['approve', 'burn', 'attest', 'mint']
const NAME_TO_ID: Record<string, StepId> = { approve: 'approve', burn: 'burn', fetchAttestation: 'attest', attestation: 'attest', mint: 'mint' }

function initialSteps(): LiveStep[] {
  return STEP_ORDER.map((id) => ({ id, state: 'pending' }))
}

function toNumber(v: unknown): number {
  const n = typeof v === 'bigint' ? Number(v) : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * Everything the bridge card needs: an App Kit adapter bound to the connected
 * wallet, a fee estimate, the bridge call with live step events, and retry.
 */
export function useBridge() {
  const { address, connector, isConnected, chainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const [phase, setPhase] = useState<Phase>('idle')
  const [steps, setSteps] = useState<LiveStep[]>(initialSteps)
  const [error, setError] = useState<string | null>(null)
  const [resumable, setResumable] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const resultRef = useRef<KitResult | null>(null)
  const routeRef = useRef<{ source: BridgeChain; dest: BridgeChain } | null>(null)
  const adapterRef = useRef<KitAdapter | null>(null)

  const createAdapter = useCallback(async () => {
    if (!connector || !isConnected) throw new Error('Connect a wallet first.')
    const adapter = await createKitAdapter(connector)
    adapterRef.current = adapter
    return adapter
  }, [connector, isConnected])

  /** Switch the wallet to `target` (adding it if unknown). One prompt, only when needed. */
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

  const estimate = useCallback(
    async (source: BridgeChain, dest: BridgeChain, amount: string, speed: Speed): Promise<Estimate> => {
      if (!address) throw new Error('Connect a wallet first.')
      const adapter = adapterRef.current ?? (await createAdapter())
      const kit = getKit()
      const forward = canUseForwarder(dest)
      const est = (await kit.estimateBridge({
        from: { adapter, chain: source.def },
        to: forward ? { chain: dest.def, recipientAddress: address, useForwarder: true as const } : { adapter, chain: dest.def, recipientAddress: address },
        amount,
        token: 'USDC',
        config: { transferSpeed: speed, batchTransactions: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as {
        fees?: { type: string; amount: string }[]
        gasFees?: { name: string; fees: { gas: bigint; gasPrice: bigint; fee?: string } | null }[]
      }
      const providerFee = est.fees?.filter((f) => f.type === 'provider').reduce((s, f) => s + Number(f.amount), 0) ?? 0
      const forwarderFee = est.fees?.filter((f) => f.type === 'forwarder').reduce((s, f) => s + Number(f.amount), 0) ?? 0
      const gasFor = (names: string[]) => {
        const rows = (est.gasFees ?? []).filter((g) => names.includes(g.name) && g.fees)
        if (!rows.length) return null
        return rows.reduce((s, g) => s + (g.fees?.fee ? toNumber(g.fees.fee) : toNumber(g.fees!.gas) * toNumber(g.fees!.gasPrice)), 0) / 1e18
      }
      return {
        providerFee,
        forwarderFee,
        receive: Math.max(0, Number(amount) - providerFee - forwarderFee),
        sourceGas: gasFor(['approve', 'burn']),
        destGas: forward ? null : gasFor(['mint']),
      }
    },
    [address, createAdapter],
  )

  const onEvent = useCallback((e: KitEvent) => {
    const name = e.values?.name
    const id = name ? NAME_TO_ID[name] : undefined
    if (!id) return
    const state = e.values?.state
    setSteps((prev) => {
      const now = Date.now()
      return prev.map((s) => {
        if (s.id !== id) {
          // when a later step starts, mark earlier still-active ones done
          return s
        }
        if (state === 'success') return { ...s, state: 'done', txHash: e.values?.txHash ?? s.txHash, explorerUrl: e.values?.explorerUrl ?? s.explorerUrl, endedAt: now, startedAt: s.startedAt ?? now }
        if (state === 'error') return { ...s, state: 'error', endedAt: now, startedAt: s.startedAt ?? now }
        return { ...s, state: 'active', startedAt: s.startedAt ?? now, txHash: e.values?.txHash ?? s.txHash, explorerUrl: e.values?.explorerUrl ?? s.explorerUrl }
      })
    })
  }, [])

  useEffect(() => onKitEvent(onEvent), [onEvent])

  const applyResult = useCallback((res: KitResult, source: BridgeChain, dest: BridgeChain) => {
    const kitSteps = res.steps ?? []
    setSteps((prev) =>
      prev.map((s) => {
        const k = kitSteps.find((x) => x.name && NAME_TO_ID[x.name] === s.id)
        if (!k) return s.state === 'active' ? { ...s, state: res.state === 'success' ? 'done' : s.state } : s
        const hash = k.txHash ?? k.data?.txHash
        const def = s.id === 'mint' ? dest.def : source.def
        return {
          ...s,
          state: k.state === 'success' ? 'done' : k.state === 'error' ? 'error' : k.state === 'noop' ? 'skipped' : s.state,
          txHash: hash ?? s.txHash,
          explorerUrl: k.explorerUrl ?? (hash ? explorerTx(def, hash) : s.explorerUrl),
          endedAt: s.endedAt ?? Date.now(),
        }
      }),
    )
    const burnOk = kitSteps.find((x) => x.name === 'burn')?.state === 'success'
    if (res.state === 'success') {
      setPhase('done')
      setEndedAt(Date.now())
    } else {
      setPhase('error')
      setResumable(burnOk)
      const err = res.error as { message?: string } | string | undefined
      const msg = typeof err === 'string' ? err : err?.message
      setError(burnOk ? 'Your USDC was burned on the source chain but the mint did not complete. Nothing is lost: resume to finish the mint, or wait, CCTP will still deliver it.' : friendly(msg))
    }
  }, [])

  const bridge = useCallback(
    async (source: BridgeChain, dest: BridgeChain, amount: string, speed: Speed) => {
      if (!address) throw new Error('Connect a wallet first.')
      setError(null)
      setResumable(false)
      setSteps(initialSteps())
      setPhase('bridging')
      setStartedAt(Date.now())
      setEndedAt(null)
      routeRef.current = { source, dest }
      try {
        await ensureChain(source.chainId)
        const adapter = await createAdapter()
        const kit = getKit()
        const forward = canUseForwarder(dest)
        const res = (await kit.bridge({
          from: { adapter, chain: source.def },
          to: forward ? { chain: dest.def, recipientAddress: address, useForwarder: true as const } : { adapter, chain: dest.def, recipientAddress: address },
          amount,
          token: 'USDC',
          config: { transferSpeed: speed, batchTransactions: false },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)) as KitResult
        resultRef.current = res
        applyResult(res, source, dest)
        // Team analytics only: Circle's contracts leave no XyloNet mark, so a burn started here is recorded (never blocks the flow).
        const burn = (res.steps ?? []).find((x) => x.name === 'burn')
        if (burn && burn.state !== 'error') logBridgeStart({ kind: 'cctp', wallet: address, amountUsd: Number(amount), fromChainId: source.chainId, toChainId: dest.chainId, txHash: burn.txHash ?? burn.data?.txHash })
      } catch (err) {
        setPhase('error')
        setError(friendly((err as { message?: string })?.message))
      }
    },
    [address, applyResult, createAdapter, ensureChain],
  )

  const resume = useCallback(async () => {
    const res = resultRef.current
    const route = routeRef.current
    if (!res || !route) return
    setError(null)
    setPhase('bridging')
    try {
      await ensureChain(route.dest.chainId)
      const adapter = await createAdapter()
      const kit = getKit()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retried = (await (kit as any).retryBridge(res, { from: adapter, to: adapter })) as KitResult
      resultRef.current = retried
      applyResult(retried, route.source, route.dest)
    } catch (err) {
      setPhase('error')
      setError(friendly((err as { message?: string })?.message))
    }
  }, [applyResult, createAdapter, ensureChain])

  const reset = useCallback(() => {
    setPhase('idle')
    setSteps(initialSteps())
    setError(null)
    setResumable(false)
    setStartedAt(null)
    setEndedAt(null)
    resultRef.current = null
  }, [])

  return useMemo(
    () => ({ phase, steps, error, resumable, startedAt, endedAt, estimate, bridge, resume, reset, ARC }),
    [phase, steps, error, resumable, startedAt, endedAt, estimate, bridge, resume, reset],
  )
}

function friendly(msg?: string): string {
  const m = (msg ?? '').toLowerCase()
  if (!m) return 'The bridge did not complete. Nothing was moved.'
  if (m.includes('user rejected') || m.includes('user denied') || m.includes('rejected the request')) return 'You cancelled in your wallet. Nothing was moved.'
  if (m.includes('insufficient funds')) return 'Not enough gas on the source chain to send the transaction.'
  if (m.includes('pre_finality_unavailable') || m.includes('fast transfer')) return 'Fast transfer is not available from this chain. Choose Standard and try again.'
  if (m.includes('max fee must be less than amount')) return 'The amount is below the fast-transfer fee for this route. Send more, or choose Standard.'
  if (m.includes('timeout')) return 'The network did not answer in time. Your funds are safe; try again.'
  return msg!.length > 160 ? msg!.slice(0, 157) + '…' : msg!
}
