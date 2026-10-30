import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { appendBridgeLog, type BridgeLogKind } from '@/lib/admin/bridgeLog'
import { clientIp, rateLimit } from '@/lib/payx/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'cache-control': 'no-store' }
const KINDS: BridgeLogKind[] = ['cctp', 'gateway_deposit', 'gateway_spend']

/**
 * POST /api/bridge/log — records that a CCTP or Gateway action was started on
 * this site (Circle's contracts leave no XyloNet mark on chain). Public, but
 * strictly validated and rate-limited; it stores nothing a user did not just
 * broadcast themselves. Read only by the team on /admin.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`bridge:log:${clientIp(request.headers)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE })
  }
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE })
  }
  const kind = body.kind
  const wallet = typeof body.wallet === 'string' ? body.wallet : ''
  const amountUsd = Number(body.amountUsd)
  const fromChainId = Number(body.fromChainId)
  const toChainId = Number(body.toChainId)
  const txHash = typeof body.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.txHash) ? body.txHash.toLowerCase() : undefined
  if (!KINDS.includes(kind as BridgeLogKind) || !isAddress(wallet) || !Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 1e9 || !Number.isInteger(fromChainId) || !Number.isInteger(toChainId) || fromChainId <= 0 || toChainId <= 0) {
    return NextResponse.json({ error: 'Invalid entry' }, { status: 400, headers: NO_STORE })
  }
  try {
    const row = await appendBridgeLog({ kind: kind as BridgeLogKind, wallet: wallet.toLowerCase(), amountUsd: Math.round(amountUsd * 100) / 100, fromChainId, toChainId, txHash })
    return NextResponse.json({ ok: true, id: row.id }, { headers: NO_STORE })
  } catch (e) {
    console.error('[bridge/log] append failed:', (e as Error).message)
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
}
