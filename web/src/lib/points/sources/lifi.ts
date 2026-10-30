/**
 * LI.FI transfer records for the `xylonet` integrator -> swap / bridge events.
 *
 * Endpoint: GET https://li.quest/v1/analytics/transfers?integrator=..&fromTimestamp=..&toTimestamp=..
 * Returns at most 1000 transfers per call, so the range is walked in windows
 * and any window that comes back full is bisected. Same-chain = swap,
 * cross-chain = bridge. The wallet credited is `fromAddress` (the signer).
 */

import { CONTRACTS, LIFI } from '@/config/constants'
import { RULES } from '../rules'
import type { PointsEvent } from '../types'

const ENDPOINT = 'https://li.quest/v1/analytics/transfers'
const PAGE_CAP = 1000
const INITIAL_WINDOW_S = 2 * 24 * 3600
const MIN_WINDOW_S = 15 * 60
const TIMEOUT_MS = 25_000

interface LiFiToken { symbol?: string; chainId?: number }
interface LiFiSide {
  txHash?: string
  chainId?: number
  amountUSD?: string
  timestamp?: number
  token?: LiFiToken
}
interface LiFiFeeCost {
  name?: string
  token?: { symbol?: string; decimals?: number; priceUSD?: string }
  feeSplit?: { recipients?: Array<{ walletAddress?: string; fee?: string }> }
}
interface LiFiTransfer {
  transactionId?: string
  sending?: LiFiSide
  receiving?: LiFiSide
  fromAddress?: string
  toAddress?: string
  tool?: string
  status?: string
  metadata?: { integrator?: string }
  feeCosts?: LiFiFeeCost[]
}

const TREASURY = CONTRACTS.TREASURY_SAFE.toLowerCase()

/** XyloNet's share of the fee legs: the recipients that are the Treasury Safe, summed per token. */
function treasuryFee(t: LiFiTransfer): { feeUsd: number; feeSymbol?: string; feeAmount: number } | null {
  let feeUsd = 0
  let feeAmount = 0
  let feeSymbol: string | undefined
  for (const fc of t.feeCosts ?? []) {
    const decimals = fc.token?.decimals ?? 6
    const price = Number(fc.token?.priceUSD ?? 1) || 1
    for (const r of fc.feeSplit?.recipients ?? []) {
      if ((r.walletAddress ?? '').toLowerCase() !== TREASURY) continue
      const raw = Number(r.fee ?? 0)
      if (!Number.isFinite(raw) || raw <= 0) continue
      const units = raw / 10 ** decimals
      feeAmount += units
      feeUsd += units * price
      feeSymbol = feeSymbol ?? fc.token?.symbol
    }
  }
  if (feeUsd <= 0) return null
  return { feeUsd, feeSymbol, feeAmount }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' }
  if (process.env.LIFI_API_KEY) h['x-lifi-api-key'] = process.env.LIFI_API_KEY
  return h
}

async function fetchWindow(from: number, to: number): Promise<LiFiTransfer[]> {
  const url = new URL(ENDPOINT)
  url.searchParams.set('integrator', LIFI.integrator)
  url.searchParams.set('fromTimestamp', String(from))
  url.searchParams.set('toTimestamp', String(to))
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: headers(), signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`li.quest ${res.status}`)
    const body = (await res.json()) as { transfers?: LiFiTransfer[] }
    return body.transfers ?? []
  } finally {
    clearTimeout(timer)
  }
}

export function toPointsEvent(t: LiFiTransfer): PointsEvent | null {
  if (t.status !== 'DONE') return null
  const integrator = t.metadata?.integrator
  if (integrator && integrator.toLowerCase() !== LIFI.integrator.toLowerCase()) return null
  const wallet = (t.fromAddress ?? '').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) return null
  const s = t.sending
  const r = t.receiving
  if (!s?.chainId || !s.txHash || !s.timestamp) return null
  const usd = Number(s.amountUSD ?? r?.amountUSD ?? 0)
  if (!Number.isFinite(usd) || usd < RULES.minEventUsd) return null
  const toChainId = r?.chainId ?? s.chainId
  const fee = treasuryFee(t)
  return {
    id: `lifi:${t.transactionId ?? s.txHash}`,
    kind: s.chainId === toChainId ? 'swap' : 'bridge',
    wallet,
    usd,
    ts: s.timestamp,
    txHash: s.txHash,
    chainId: s.chainId,
    toChainId,
    tool: t.tool,
    fromSymbol: s.token?.symbol,
    toSymbol: r?.token?.symbol,
    ...(fee ? { feeUsd: fee.feeUsd, feeSymbol: fee.feeSymbol, feeAmount: fee.feeAmount } : { feeUsd: 0 }),
  }
}

/**
 * All DONE transfers with sending.timestamp in [from, to] (unix seconds),
 * normalised and de-duplicated by id.
 */
export async function fetchLiFiEvents(from: number, to: number): Promise<PointsEvent[]> {
  const out = new Map<string, PointsEvent>()
  const stack: Array<[number, number]> = []
  for (let a = from; a <= to; a += INITIAL_WINDOW_S) stack.push([a, Math.min(to, a + INITIAL_WINDOW_S - 1)])
  let calls = 0
  while (stack.length) {
    const [a, b] = stack.pop()!
    const transfers = await fetchWindow(a, b)
    calls += 1
    if (transfers.length >= PAGE_CAP && b - a > MIN_WINDOW_S) {
      const mid = Math.floor((a + b) / 2)
      stack.push([a, mid], [mid + 1, b])
      continue
    }
    for (const t of transfers) {
      const ev = toPointsEvent(t)
      if (ev) out.set(ev.id, ev)
    }
    if (calls > 200) throw new Error('lifi: too many windows')
  }
  return [...out.values()]
}
