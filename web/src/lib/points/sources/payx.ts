/**
 * PayX contract events on Arc -> tip_sent / tip_received events + handle links.
 *
 * Reads every live PayXTipping instance from the asset registry. Uses a
 * full-history RPC (POINTS_LOGS_RPC_URL, default Circle's public
 * https://rpc.mainnet.arc.io which allows 9,999-block eth_getLogs windows)
 * because the pruned providers cannot serve logs from launch week.
 *
 * Scans oldest -> newest in bounded, parallel windows so a request-time sync
 * can stop early (budget) and resume from a contiguous cursor next time.
 */

import { createPublicClient, formatUnits, getAbiItem, http, type Log, type PublicClient } from 'viem'
import { PayXTippingABI } from '@/config/abis/PayXTipping'
import { PAYX_ASSETS, PAYX_ASSET_KEYS, type PayXAsset } from '@/config/constants'
import { arcMainnet } from '@/config/wagmi'
import { getServerPayXAddressFor } from '@/lib/payx/env'
import { RULES } from '../rules'
import type { PointsEvent } from '../types'

export const DEFAULT_LOGS_RPC = 'https://rpc.mainnet.arc.io'
const MAX_WINDOW = 9_999n
const MIN_WINDOW = 500n

const TIP_SENT = getAbiItem({ abi: PayXTippingABI, name: 'TipSent' })
const TIPS_CLAIMED = getAbiItem({ abi: PayXTippingABI, name: 'TipsClaimed' })
const WALLET_LINKED = getAbiItem({ abi: PayXTippingABI, name: 'WalletLinked' })
const WALLET_RELINKED = getAbiItem({ abi: PayXTippingABI, name: 'WalletRelinked' })
const EVENTS = [TIP_SENT, TIPS_CLAIMED, WALLET_LINKED, WALLET_RELINKED] as const

let client: PublicClient | null = null
export function getLogsClient(): PublicClient {
  if (client) return client
  // Deliberately NOT PAYX_LOGS_RPC_URL / ARC_RPC_URL: those are pruned providers (Blockdaemon keeps ~1 day of logs).
  const url = process.env.POINTS_LOGS_RPC_URL || DEFAULT_LOGS_RPC
  // retryCount 0: retries/backoff are handled in scanPayX so we never hammer a rate-limited endpoint.
  client = createPublicClient({ chain: arcMainnet, transport: http(url, { timeout: 20_000, retryCount: 0 }) })
  return client
}

export interface PayXInstance { asset: PayXAsset; address: `0x${string}` }

export function livePayXInstances(): PayXInstance[] {
  const out: PayXInstance[] = []
  for (const key of PAYX_ASSET_KEYS) {
    const address = getServerPayXAddressFor(key)
    if (address) out.push({ asset: PAYX_ASSETS[key], address })
  }
  return out
}

/** Oldest deployment block among live instances (0 when unknown). */
export function payxStartBlock(instances = livePayXInstances()): bigint {
  const blocks = instances.map((i) => i.asset.deploymentBlock).filter((b) => b > 0)
  return blocks.length ? BigInt(Math.min(...blocks)) : 0n
}

export interface PayXScanResult {
  events: PointsEvent[]
  /** wallet -> handle from WalletLinked / WalletRelinked / TipsClaimed, in chain order. */
  handleLinks: Array<{ wallet: string; handle: string; unlinkWallet?: string }>
  /** Last block (inclusive) covered contiguously from `fromBlock`. */
  scannedTo: bigint
  /** true when scannedTo === toBlock. */
  complete: boolean
  windowsUsed: number
  /** Set when the scan stopped early because of an unrecoverable provider error (progress is still valid). */
  error?: string
}

type AnyLog = Log<bigint, number, false, undefined, true, typeof EVENTS>

function isRateLimitError(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return /rate limit|429|too many requests|capacity/.test(m)
}

// Checked AFTER isRateLimitError: the public RPC wraps 429s as "Request exceeds defined limit".
function isRangeError(e: unknown): boolean {
  if (isRateLimitError(e)) return false
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return /range too large|block range|too many blocks|exceeds defined limit|limited to|ranges over/.test(m)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** First line of a viem error plus its "Status:" / "Details:" lines (the provider's own message), never the request body. */
function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const lines = e.message.split(/\r?\n/)
  const status = lines.find((l) => l.startsWith('Status:'))
  const details = lines.find((l) => l.startsWith('Details:'))
  return [lines[0], status, details].filter(Boolean).join(' ')
}
/** Circle's public RPC tolerates roughly one getLogs per second; pace calls and back off on 429s. */
const RATE_LIMIT_RETRIES = 8
const RATE_LIMIT_BASE_MS = 1_500
const MIN_INTERVAL_MS = Number(process.env.POINTS_LOGS_MIN_INTERVAL_MS || 750)
let lastCallAt = 0

/** Rough USD value of one unit of each tipping asset, used only when the live price cannot be read. */
const FALLBACK_USD: Record<string, number> = { USDC: 1, EURC: 1.1, CIRBTC: 85_000 }

/** USD price per unit for every registry asset (LI.FI's Arc token list), so points score EURC and cirBTC tips at their dollar value. */
async function assetUsdRates(): Promise<Record<string, number>> {
  const rates: Record<string, number> = { ...FALLBACK_USD }
  try {
    const res = await fetch('https://li.quest/v1/tokens?chains=5042', { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
    if (!res.ok) return rates
    const body = (await res.json()) as { tokens?: Record<string, Array<{ address?: string; priceUSD?: string }>> }
    const list = body.tokens?.['5042'] ?? []
    for (const key of PAYX_ASSET_KEYS) {
      if (key === 'USDC') continue
      const hit = list.find((t) => t.address?.toLowerCase() === PAYX_ASSETS[key].token.address.toLowerCase())
      const price = Number(hit?.priceUSD)
      if (Number.isFinite(price) && price > 0) rates[key] = price
    }
  } catch {
    /* keep the fallbacks */
  }
  return rates
}

function decode(log: AnyLog, byAddress: Map<string, PayXAsset>, out: PayXScanResult, rates: Record<string, number>) {
  const asset = byAddress.get((log.address ?? '').toLowerCase())
  if (!asset) return
  const decimals = asset.token.decimals
  const rate = rates[asset.key] ?? 1
  const base = { txHash: log.transactionHash ?? '', chainId: arcMainnet.id }
  const id = `payx:${log.transactionHash}:${log.logIndex ?? 0}`
  switch (log.eventName) {
    case 'TipSent': {
      const { handle, tipper, amount, fee, timestamp } = log.args as {
        handle?: string; tipper?: `0x${string}`; amount?: bigint; fee?: bigint; timestamp?: bigint
      }
      if (!handle || !tipper || amount === undefined || timestamp === undefined) return
      // TipSent.amount is NET of the platform fee; the tipper's volume is the gross amount.
      const usd = Number(formatUnits(amount + (fee ?? 0n), decimals)) * rate
      if (usd < RULES.minEventUsd) return
      const feeAmount = Number(formatUnits(fee ?? 0n, decimals))
      out.events.push({ ...base, id, kind: 'tip_sent', wallet: tipper.toLowerCase(), usd, ts: Number(timestamp), handle, fromSymbol: asset.token.symbol, feeUsd: feeAmount * rate, feeSymbol: asset.token.symbol, feeAmount })
      return
    }
    case 'TipsClaimed': {
      const { handle, wallet, amount, timestamp } = log.args as {
        handle?: string; wallet?: `0x${string}`; amount?: bigint; timestamp?: bigint
      }
      if (!handle || !wallet || amount === undefined || timestamp === undefined) return
      const usd = Number(formatUnits(amount, decimals)) * rate
      if (usd < RULES.minEventUsd) return
      out.events.push({ ...base, id, kind: 'tip_received', wallet: wallet.toLowerCase(), usd, ts: Number(timestamp), handle, fromSymbol: asset.token.symbol })
      out.handleLinks.push({ wallet: wallet.toLowerCase(), handle })
      return
    }
    case 'WalletLinked': {
      const { handle, wallet } = log.args as { handle?: string; wallet?: `0x${string}` }
      if (handle && wallet) out.handleLinks.push({ wallet: wallet.toLowerCase(), handle })
      return
    }
    case 'WalletRelinked': {
      const { handle, oldWallet, newWallet } = log.args as { handle?: string; oldWallet?: `0x${string}`; newWallet?: `0x${string}` }
      if (handle && newWallet) out.handleLinks.push({ wallet: newWallet.toLowerCase(), handle, unlinkWallet: oldWallet?.toLowerCase() })
      return
    }
  }
}

/**
 * Scan [fromBlock, toBlock] for all live instances. `maxWindows` bounds the
 * number of eth_getLogs calls (Infinity for a full backfill); `concurrency`
 * windows are fetched in parallel per round.
 */
export async function scanPayX(
  fromBlock: bigint,
  toBlock: bigint,
  opts: { maxWindows?: number; concurrency?: number } = {}
): Promise<PayXScanResult> {
  const instances = livePayXInstances()
  const result: PayXScanResult = { events: [], handleLinks: [], scannedTo: fromBlock - 1n, complete: false, windowsUsed: 0 }
  if (instances.length === 0 || fromBlock > toBlock) {
    result.scannedTo = toBlock
    result.complete = true
    return result
  }
  const maxWindows = opts.maxWindows ?? Number.POSITIVE_INFINITY
  const concurrency = Math.max(1, opts.concurrency ?? Number(process.env.POINTS_LOGS_CONCURRENCY || 1))
  const byAddress = new Map(instances.map((i) => [i.address.toLowerCase(), i.asset]))
  const addresses = instances.map((i) => i.address)
  const c = getLogsClient()
  const rates = instances.length > 1 ? await assetUsdRates() : FALLBACK_USD
  let window = MAX_WINDOW
  let cursor = fromBlock

  while (cursor <= toBlock && result.windowsUsed < maxWindows) {
    const batch: Array<{ from: bigint; to: bigint }> = []
    let next = cursor
    for (let i = 0; i < concurrency && next <= toBlock && result.windowsUsed + batch.length < maxWindows; i++) {
      const to = next + window - 1n > toBlock ? toBlock : next + window - 1n
      batch.push({ from: next, to })
      next = to + 1n
    }
    let logs: AnyLog[][] | null = null
    let attempt = 0
    while (logs === null) {
      const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
      if (wait > 0) await sleep(wait)
      lastCallAt = Date.now()
      try {
        logs = (await Promise.all(
          batch.map((b) => c.getLogs({ address: addresses, events: EVENTS, fromBlock: b.from, toBlock: b.to, strict: true }))
        )) as AnyLog[][]
      } catch (e) {
        if (isRangeError(e) && window > MIN_WINDOW) {
          window = window / 2n < MIN_WINDOW ? MIN_WINDOW : window / 2n
          break
        }
        if (isRateLimitError(e) && attempt < RATE_LIMIT_RETRIES) {
          attempt += 1
          await sleep(RATE_LIMIT_BASE_MS * attempt)
          continue
        }
        // Unrecoverable for now: keep the contiguous progress made so far and let the next sync resume.
        result.error = describeError(e)
        result.complete = false
        return result
      }
    }
    if (logs === null) continue // window shrunk; rebuild the batch
    result.windowsUsed += batch.length
    // Windows are ascending and logs within a window are ascending, so chain order is preserved.
    for (const group of logs) for (const log of group) decode(log, byAddress, result, rates)
    cursor = next
    result.scannedTo = next - 1n
  }
  result.complete = result.scannedTo >= toBlock
  return result
}
