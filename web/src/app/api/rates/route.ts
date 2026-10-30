import { NextResponse } from 'next/server'
import { CONTRACTS, LIFI } from '@/config/constants'
import { ARC_CHAIN_ID } from '@/config/wagmi'

export const revalidate = 60

const LIFI_QUOTE = 'https://li.quest/v1/quote'
// Any valid address works for a quote; the Treasury-owned PayX contract is a stable choice.
const QUOTE_FROM = CONTRACTS.PAYX && CONTRACTS.PAYX !== '0x0000000000000000000000000000000000000000' ? CONTRACTS.PAYX : CONTRACTS.LIFI_DIAMOND

type Quote = {
  rate: number
  tool: string | null
  gasUsd: number | null
  feePct: number | null
}

async function quote(from: `0x${string}`, to: `0x${string}`): Promise<Quote | null> {
  const url = new URL(LIFI_QUOTE)
  url.searchParams.set('fromChain', String(ARC_CHAIN_ID))
  url.searchParams.set('toChain', String(ARC_CHAIN_ID))
  url.searchParams.set('fromToken', from)
  url.searchParams.set('toToken', to)
  url.searchParams.set('fromAmount', '100000000') // 100 units, 6dp: a realistic size for the rate
  url.searchParams.set('fromAddress', QUOTE_FROM)
  url.searchParams.set('integrator', LIFI.integrator)
  const res = await fetch(url, { next: { revalidate: 60 }, headers: { accept: 'application/json' } })
  if (!res.ok) return null
  const j = (await res.json()) as {
    tool?: string
    estimate?: { toAmount?: string; gasCosts?: { amountUSD?: string }[]; feeCosts?: { percentage?: string }[] }
  }
  const toAmount = Number(j.estimate?.toAmount ?? 0) / 1e6
  if (!toAmount) return null
  const feePct = j.estimate?.feeCosts?.reduce((s, f) => s + Number(f.percentage ?? 0), 0) ?? null
  return {
    rate: toAmount / 100,
    tool: j.tool ?? null,
    gasUsd: j.estimate?.gasCosts?.[0]?.amountUSD ? Number(j.estimate.gasCosts[0].amountUSD) : null,
    feePct,
  }
}

/** Live USDC/EURC rates on Arc as quoted by LI.FI, cached for a minute. */
export async function GET() {
  try {
    const [usdcToEurc, eurcToUsdc] = await Promise.all([quote(CONTRACTS.USDC, CONTRACTS.EURC), quote(CONTRACTS.EURC, CONTRACTS.USDC)])
    return NextResponse.json(
      { usdcToEurc, eurcToUsdc, updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch {
    return NextResponse.json({ usdcToEurc: null, eurcToUsdc: null, updatedAt: Date.now() }, { status: 200 })
  }
}
