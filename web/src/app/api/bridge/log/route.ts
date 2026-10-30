import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, isAddress, type Hex, type PublicClient, type TransactionReceipt } from 'viem'
import { appendBridgeLog, type BridgeLogKind } from '@/lib/admin/bridgeLog'
import { clientIp, rateLimit } from '@/lib/payx/rate-limit'
import { getPayXPublicClient, isRpcConfigured } from '@/lib/payx/client'
import { ARC_CHAIN_ID, CHAIN_RPC_URLS } from '@/config/wagmi'
import { CONTRACTS } from '@/config/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NO_STORE = { 'cache-control': 'no-store' }
const KINDS: BridgeLogKind[] = ['cctp', 'gateway_deposit', 'gateway_spend']
const RECEIPT_TRIES = 4
const RECEIPT_WAIT_MS = 2_500

/** Public client for the chain the transaction was sent on. */
function clientFor(chainId: number): PublicClient | null {
  if (chainId === ARC_CHAIN_ID) return isRpcConfigured() ? getPayXPublicClient() : null
  const url = CHAIN_RPC_URLS[chainId]
  if (!url) return null
  return createPublicClient({ transport: http(url, { timeout: 8_000, retryCount: 0 }) })
}

/**
 * Looks the transaction up on chain. 'ok' when it succeeded and was sent by
 * `wallet`; 'bad' when it exists but was reverted or sent by someone else;
 * 'unknown' when no receipt could be read in time (fresh transaction, RPC down).
 */
async function verify(chainId: number, txHash: Hex, wallet: string, kind: BridgeLogKind): Promise<'ok' | 'bad' | 'unknown'> {
  const client = clientFor(chainId)
  if (!client) return 'unknown'
  // Gateway actions on Arc may be submitted by Circle's contracts on the user's behalf,
  // so for those a log from the Gateway contract also proves the transaction is real.
  const gatewayContract = kind === 'gateway_deposit' ? CONTRACTS.GATEWAY_WALLET.toLowerCase() : kind === 'gateway_spend' ? CONTRACTS.GATEWAY_MINTER.toLowerCase() : null
  for (let i = 0; i < RECEIPT_TRIES; i++) {
    let receipt: TransactionReceipt | null = null
    try {
      receipt = await client.getTransactionReceipt({ hash: txHash })
    } catch {
      receipt = null
    }
    if (receipt) {
      if (receipt.status !== 'success') return 'bad'
      const byWallet = receipt.from.toLowerCase() === wallet
      const byGateway = !!gatewayContract && receipt.logs.some((l) => l.address.toLowerCase() === gatewayContract)
      return byWallet || byGateway ? 'ok' : 'bad'
    }
    if (i < RECEIPT_TRIES - 1) await new Promise((r) => setTimeout(r, RECEIPT_WAIT_MS))
  }
  return 'unknown'
}

/**
 * POST /api/bridge/log — records that a CCTP or Gateway action was started on
 * this site (Circle's contracts leave no XyloNet mark on chain). Public, but
 * every entry names a transaction hash that is checked on chain: it must have
 * succeeded and been sent by the wallet named, or it is refused. Entries whose
 * receipt is not readable yet are stored as unverified and never counted.
 * Rate-limited per IP and per wallet. Read only by the team on /admin.
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
  const txHash = typeof body.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.txHash) ? (body.txHash.toLowerCase() as Hex) : null
  if (
    !KINDS.includes(kind as BridgeLogKind) ||
    !isAddress(wallet) ||
    !txHash ||
    !Number.isFinite(amountUsd) ||
    amountUsd <= 0 ||
    amountUsd > 1e9 ||
    !Number.isInteger(fromChainId) ||
    !Number.isInteger(toChainId) ||
    fromChainId <= 0 ||
    toChainId <= 0
  ) {
    return NextResponse.json({ error: 'Invalid entry' }, { status: 400, headers: NO_STORE })
  }
  const walletLc = wallet.toLowerCase()
  if (!rateLimit(`bridge:log:w:${walletLc}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE })
  }
  // The transaction the user signed lives on the source chain for a burn or a
  // Gateway deposit, and on the destination (Arc) for a Gateway spend.
  const chainId = kind === 'gateway_spend' ? toChainId : fromChainId
  const check = await verify(chainId, txHash, walletLc, kind as BridgeLogKind)
  if (check === 'bad') return NextResponse.json({ error: 'Transaction does not match' }, { status: 400, headers: NO_STORE })
  try {
    const row = await appendBridgeLog({ kind: kind as BridgeLogKind, wallet: walletLc, amountUsd: Math.round(amountUsd * 100) / 100, fromChainId, toChainId, txHash, verified: check === 'ok' })
    return NextResponse.json({ ok: true, id: row.id, verified: row.verified === true }, { headers: NO_STORE })
  } catch (e) {
    console.error('[bridge/log] append failed:', (e as Error).message)
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
}
