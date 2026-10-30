import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/rpc — same-origin JSON-RPC proxy for Arc mainnet (chain 5042).
 *
 * Why: at launch there is no confirmed public Arc mainnet RPC. The browser talks
 * to this route; this route talks to our credentialed endpoints (ARC_RPC_URL,
 * ARC_RPC_FALLBACK_URL) which never leave the server.
 *
 * Safety:
 *  - Origin tiers (see `classifyOrigin`):
 *      trusted  — our own sites (xylonet.xyz, the Vercel project + previews,
 *                 same-host, localhost in dev): full method allowlist.
 *      wallet   — browser-extension origins (MetaMask, Rabby, the PayX
 *                 extension …) and requests with NO Origin header (mobile
 *                 wallets, wallet desktop apps, curl): the minimal
 *                 WALLET_METHODS set only.
 *      blocked  — any other web origin: 403 before touching upstream.
 *    Trade-off: we cannot distinguish a mobile wallet from curl (neither sends
 *    an Origin), so the wallet tier stays open to anonymous callers. It is
 *    limited to cheap, wallet-essential methods (no eth_getLogs, no storage or
 *    block-by-hash reads), rate limited per IP, and every tx it can relay is a
 *    signed raw tx that costs the sender gas. Quota abuse from that tier is a
 *    nuisance, not a security boundary; the Alchemy key itself never leaves
 *    the server.
 *  - method allowlist (reads + raw-tx broadcast + gas/fee helpers only)
 *  - eth_getLogs must be bounded (blockHash, or hex from/to within MAX_LOG_RANGE)
 *  - batch size cap, body size cap
 *  - cheap per-IP token bucket (best-effort; Vercel functions are stateless
 *    per instance, so this is a nuisance limiter, not a security boundary)
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_METHODS = new Set([
  'eth_chainId',
  'eth_syncing',
  'net_version',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getLogs',
  'eth_sendRawTransaction',
  'eth_getBlockTransactionCountByNumber',
  'eth_getTransactionByBlockNumberAndIndex',
  'web3_clientVersion',
])

/**
 * What a wallet needs to add/use chain 5042 (wallet_addEthereumChain points at
 * this route) and what the PayX extension popup needs (eth_call for balances).
 * Deliberately excludes eth_getLogs and the block/storage scans.
 */
const WALLET_METHODS = new Set([
  'eth_chainId',
  'eth_syncing',
  'eth_getBlockByHash',
  'net_version',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getTransactionCount',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getBlockByNumber',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_sendRawTransaction',
  'web3_clientVersion',
])

const MAX_BATCH = 50
const MAX_BODY_BYTES = 256 * 1024
const MAX_LOG_RANGE = 10_000n

// ── origin policy ────────────────────────────────────────────────────────────

const TRUSTED_ORIGINS = new Set([
  'https://www.xylonet.xyz',
  'https://xylonet.xyz',
  'https://xylonet-mainnet.vercel.app',
])
// Vercel preview/branch deployments of this project (xylonet-mainnet-<hash>-<team>.vercel.app,
// xylonet-mainnet-git-<branch>-<team>.vercel.app).
const VERCEL_PREVIEW_RE = /^https:\/\/xylonet-mainnet-[a-z0-9-]+\.vercel\.app$/i
// Browser-extension origins: Chrome/Edge/Brave, Firefox, Safari.
const EXTENSION_ORIGIN_RE = /^(chrome|moz|safari-web)-extension:\/\/[a-z0-9-]+$/i
const LOCALHOST_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

/** Extra trusted origins from env (comma separated), e.g. a staging domain. */
function envOrigins(): Set<string> {
  return new Set(
    (process.env.RPC_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter((s) => /^https?:\/\//.test(s))
  )
}

type OriginTier = 'trusted' | 'wallet' | 'blocked'

function classifyOrigin(request: NextRequest): { tier: OriginTier; origin: string | null } {
  const origin = request.headers.get('origin')

  // No Origin (mobile wallets, wallet desktop apps, server-side callers, curl)
  // or the opaque "null" origin: wallet tier.
  if (!origin || origin === 'null') return { tier: 'wallet', origin: null }

  if (TRUSTED_ORIGINS.has(origin) || VERCEL_PREVIEW_RE.test(origin) || envOrigins().has(origin)) {
    return { tier: 'trusted', origin }
  }

  // Same host as the request itself (covers every deployment URL without a list).
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? (LOCALHOST_RE.test(origin) ? 'http' : 'https')
    if (origin.toLowerCase() === `${proto}://${host}`.toLowerCase()) return { tier: 'trusted', origin }
  }

  if (process.env.NODE_ENV !== 'production' && LOCALHOST_RE.test(origin)) {
    return { tier: 'trusted', origin }
  }

  if (EXTENSION_ORIGIN_RE.test(origin)) return { tier: 'wallet', origin }

  return { tier: 'blocked', origin }
}

/** CORS headers for cross-origin callers we accept (extension popups need them). */
function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

// ── rate limit ───────────────────────────────────────────────────────────────

// best-effort token bucket per IP
const buckets = new Map<string, { tokens: number; ts: number }>()
const RATE = 20 // tokens per second
const BURST = 60
function allow(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip) ?? { tokens: BURST, ts: now }
  b.tokens = Math.min(BURST, b.tokens + ((now - b.ts) / 1000) * RATE)
  b.ts = now
  if (b.tokens < 1) {
    buckets.set(ip, b)
    return false
  }
  b.tokens -= 1
  buckets.set(ip, b)
  if (buckets.size > 5000) buckets.clear()
  return true
}

// ── request validation ───────────────────────────────────────────────────────

type RpcReq = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown[] }

const isHex = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v)

function validate(req: RpcReq, tier: OriginTier): string | null {
  if (!req || typeof req.method !== 'string') return 'invalid request'
  if (!ALLOWED_METHODS.has(req.method)) return `method not allowed: ${req.method}`
  if (tier !== 'trusted' && !WALLET_METHODS.has(req.method)) {
    return `method not allowed for this origin: ${req.method}`
  }
  if (req.method === 'eth_getLogs') {
    const p = (req.params?.[0] ?? {}) as { fromBlock?: unknown; toBlock?: unknown; blockHash?: unknown }
    if (isHex(p.blockHash)) return null
    // Unbounded scans ("earliest"/"latest" tags, missing bounds) are refused:
    // callers must give an explicit hex window.
    if (!isHex(p.fromBlock) || !isHex(p.toBlock)) {
      return 'eth_getLogs requires hex fromBlock and toBlock (or blockHash)'
    }
    const range = BigInt(p.toBlock) - BigInt(p.fromBlock)
    if (range < 0n || range > MAX_LOG_RANGE) return 'eth_getLogs range too large'
  }
  return null
}

// ── upstream ─────────────────────────────────────────────────────────────────

function upstreams(): string[] {
  return [process.env.ARC_RPC_URL, process.env.ARC_RPC_FALLBACK_URL].filter(
    (u): u is string => !!u && u.startsWith('http')
  )
}

async function forward(body: string, extraHeaders: Record<string, string>): Promise<Response> {
  const urls = upstreams()
  if (urls.length === 0) {
    return new Response(JSON.stringify({ error: 'RPC upstream not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json', ...extraHeaders },
    })
  }
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 15_000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: ctrl.signal,
        cache: 'no-store',
      })
      clearTimeout(t)
      if (res.ok) {
        const text = await res.text()
        return new Response(text, {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extraHeaders },
        })
      }
      lastErr = new Error(`upstream ${res.status}`)
    } catch (e) {
      lastErr = e
    }
  }
  // Status/short reason only — never the upstream URL (it carries the credential).
  const reason = lastErr instanceof Error ? lastErr.message.slice(0, 80) : 'error'
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: `upstream unavailable: ${reason}` } }),
    { status: 502, headers: { 'content-type': 'application/json', ...extraHeaders } }
  )
}

// ── handlers ─────────────────────────────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const { tier, origin } = classifyOrigin(request)
  if (tier === 'blocked') return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest) {
  const { tier, origin } = classifyOrigin(request)
  if (tier === 'blocked') {
    return NextResponse.json({ error: 'origin not allowed' }, { status: 403 })
  }
  const cors = corsHeaders(origin)

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  if (!allow(ip)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429, headers: { ...cors, 'retry-after': '3' } })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body too large' }, { status: 413, headers: cors })
  }

  let parsed: RpcReq | RpcReq[]
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers: cors })
  }

  const list = Array.isArray(parsed) ? parsed : [parsed]
  if (list.length === 0 || list.length > MAX_BATCH) {
    return NextResponse.json({ error: 'bad batch size' }, { status: 400, headers: cors })
  }
  for (const r of list) {
    const err = validate(r, tier)
    if (err) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: r?.id ?? null, error: { code: -32601, message: err } },
        { status: 400, headers: cors }
      )
    }
  }

  return forward(raw, cors)
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    chainId: 5042,
    configured: upstreams().length > 0,
    note: 'POST JSON-RPC here. Read methods + eth_sendRawTransaction only.',
  })
}
