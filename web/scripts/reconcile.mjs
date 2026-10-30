#!/usr/bin/env node
/**
 * Transaction-level reconciliation of XyloNet's ledgers against the underlying
 * token flows on Arc mainnet. Read-only: eth_getLogs, eth_call,
 * eth_getTransactionReceipt and the public LI.FI analytics API. Nothing is
 * signed or sent.
 *
 *   A. PayX     every TipSent / TipsClaimed / FeesWithdrawn / ExcessSwept event
 *               is matched to the USDC Transfer log in the same transaction
 *               receipt (same parties, same amount). The ledger built from the
 *               matched transfers is then checked against the contract's own
 *               state at the last scanned block: escrow, accrued fees and the
 *               USDC balance. An equal balance also proves there is no USDC
 *               movement on the contract that the events do not explain.
 *   B. Exchange every LI.FI transfer attributed to the `xylonet` integrator
 *               that carries an integrator fee is matched to the USDC or EURC
 *               Transfer into the Treasury Safe in the same receipt.
 *
 * Arc note (EIP-7708): USDC moved through the ERC-20 interface shows up twice
 * in a receipt, as the ERC-20 Transfer from the USDC contract (6 decimals) and
 * as a native Transfer log from 0xff…fe (18 decimals). USDC moved as native
 * value (tx.value, e.g. a LI.FI route paid in native USDC) emits only the
 * native log. Each movement is counted once: the ERC-20 log when there is one,
 * the native log otherwise.
 *
 * Usage (from web/):  node scripts/reconcile.mjs [--from <block>] [--to <block>] [--out <dir>]
 * Env: RECONCILE_LOGS_RPC_URL     full-history RPC for eth_getLogs (default https://rpc.mainnet.arc.io)
 *      RECONCILE_RECEIPTS_RPC_URL RPC for batched receipts          (default https://5042.rpc.thirdweb.com)
 */

import fs from 'node:fs'
import path from 'node:path'
import { createPublicClient, decodeEventLog, formatUnits, http, parseAbi } from 'viem'

const LOGS_RPC = process.env.RECONCILE_LOGS_RPC_URL || 'https://rpc.mainnet.arc.io'
const RECEIPTS_RPC = process.env.RECONCILE_RECEIPTS_RPC_URL || 'https://5042.rpc.thirdweb.com'
const RECEIPTS_FALLBACK_RPC = 'https://arc.drpc.org' // free plan: batches of 3
const PAYX = (process.env.NEXT_PUBLIC_PAYX_CONTRACT_ADDRESS || '0x47d4164F2f65afc00c7ba932cbEC9858b5FDAf0A').toLowerCase()
const PAYX_DEPLOY_BLOCK = 20_936_229n
const USDC = '0x3600000000000000000000000000000000000000'
const EURC = '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1'
const TREASURY = '0x7ef8aa263e3bb8a151702108bd29932e50409990'
const INTEGRATOR = 'xylonet'
const ARC = 5042
const WINDOW = 9_999n
const MIN_INTERVAL_MS = Number(process.env.RECONCILE_MIN_INTERVAL_MS || 800)
const RECEIPT_BATCH = 20
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const NATIVE_LOG = '0xfffffffffffffffffffffffffffffffffffffffe' // EIP-7708 system address
const NATIVE_SCALE = 10n ** 12n // native USDC is 18 decimals, ERC-20 USDC is 6

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []))

const PAYX_ABI = parseAbi([
  'event TipSent(string indexed handleHash, string handle, address indexed tipper, uint256 amount, uint256 fee, string message, uint256 timestamp)',
  'event TipsClaimed(string indexed handleHash, string handle, address indexed wallet, uint256 amount, uint256 timestamp)',
  'event FeesWithdrawn(address indexed recipient, uint256 amount)',
  'event ExcessSwept(address indexed recipient, uint256 amount)',
  'function totalPending() view returns (uint256)',
  'function totalFeesCollected() view returns (uint256)',
])
const ERC20 = parseAbi(['function balanceOf(address) view returns (uint256)'])

const client = createPublicClient({ transport: http(LOGS_RPC, { timeout: 30_000, retryCount: 0 }) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastCall = 0

/** Paced call with backoff on rate limits; the public RPC tolerates about one log query a second. */
async function paced(fn) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    try {
      return await fn()
    } catch (e) {
      const m = String(e?.message ?? e).toLowerCase()
      if (attempt < 8 && /429|rate limit|too many|capacity|timeout|timed out|fetch failed|exceeds defined limit/.test(m)) {
        await sleep(1_500 * (attempt + 1))
        continue
      }
      throw e
    }
  }
}

/** Receipts in JSON-RPC batches; returns Map(txHash -> receipt). Anything missing is retried on a second provider. */
async function fetchReceipts(hashes) {
  const out = new Map()
  const unique = [...new Set(hashes)]
  const post = async (url, batch) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch.map((h, i) => ({ jsonrpc: '2.0', id: i, method: 'eth_getTransactionReceipt', params: [h] }))) })
    if (!res.ok) throw new Error(`receipts ${res.status}`)
    const body = await res.json()
    if (!Array.isArray(body)) throw new Error(`receipts: ${JSON.stringify(body).slice(0, 200)}`)
    return body
  }
  for (let i = 0; i < unique.length; i += RECEIPT_BATCH) {
    const batch = unique.slice(i, i + RECEIPT_BATCH)
    for (let attempt = 0; ; attempt++) {
      try {
        const body = await post(RECEIPTS_RPC, batch)
        for (const r of body) if (r.result) out.set(batch[r.id], r.result)
        break
      } catch (e) {
        if (attempt >= 5) throw e
        await sleep(1_500 * (attempt + 1))
      }
    }
    await sleep(250)
    if ((i / RECEIPT_BATCH) % 10 === 9) process.stderr.write(`  receipts ${Math.min(i + RECEIPT_BATCH, unique.length)}/${unique.length}\n`)
  }
  const missing = unique.filter((h) => !out.has(h))
  for (let i = 0; i < missing.length; i += 3) {
    const batch = missing.slice(i, i + 3)
    const body = await post(RECEIPTS_FALLBACK_RPC, batch).catch(() => [])
    for (const r of body) if (r.result) out.set(batch[r.id], r.result)
    await sleep(300)
  }
  return out
}

/** ERC-20 Transfer logs of `token` in a receipt, as { from, to, value, logIndex, used }. */
function transfersOf(receipt, token) {
  return (receipt?.logs ?? [])
    .filter((l) => l.address.toLowerCase() === token && l.topics[0] === TRANSFER_TOPIC && l.topics.length === 3)
    .map((l) => ({ from: '0x' + l.topics[1].slice(26), to: '0x' + l.topics[2].slice(26), value: BigInt(l.data), logIndex: Number(l.logIndex), used: false }))
}

/** Native (EIP-7708) USDC transfers in a receipt, scaled to 6 decimals; amounts below one ERC-20 unit are dropped. */
function nativeTransfersOf(receipt) {
  return transfersOf(receipt, NATIVE_LOG)
    .filter((t) => t.value % NATIVE_SCALE === 0n)
    .map((t) => ({ ...t, value: t.value / NATIVE_SCALE }))
}

const u6 = (v) => formatUnits(v, 6)
const lc = (s) => String(s).toLowerCase()

async function main() {
  const head = await paced(() => client.getBlockNumber())
  const toBlock = args.to ? BigInt(args.to) : head
  const fromBlock = args.from ? BigInt(args.from) : PAYX_DEPLOY_BLOCK
  const stamp = new Date().toISOString().slice(0, 10)
  const outDir = path.resolve(args.out || path.join('.data', 'reconcile', `${stamp}-block-${toBlock}`))
  fs.mkdirSync(outDir, { recursive: true })

  // Contract state at the last scanned block, read first so the node still has it.
  const totalPending = await paced(() => client.readContract({ address: PAYX, abi: PAYX_ABI, functionName: 'totalPending', blockNumber: toBlock }))
  const totalFees = await paced(() => client.readContract({ address: PAYX, abi: PAYX_ABI, functionName: 'totalFeesCollected', blockNumber: toBlock }))
  const payxBalance = await paced(() => client.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [PAYX], blockNumber: toBlock }))

  // ── A. PayX ─────────────────────────────────────────────────────────────
  // The event scan is the slow part (one paced query per 9,999 blocks), so it is cached and resumed.
  const cachePath = path.resolve('.data', 'reconcile', 'payx-events-cache.json')
  let payxLogs = []
  let cursor0 = fromBlock
  try {
    const c = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    if (c.contract === PAYX && BigInt(c.fromBlock) === fromBlock && BigInt(c.scannedTo) <= toBlock) {
      payxLogs = c.logs.map((l) => ({ ...l, blockNumber: BigInt(l.blockNumber) }))
      cursor0 = BigInt(c.scannedTo) + 1n
    }
  } catch {
    /* no cache yet */
  }
  const saveCache = (scannedTo) => {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true })
    fs.writeFileSync(cachePath, JSON.stringify({ contract: PAYX, fromBlock: String(fromBlock), scannedTo: String(scannedTo), logs: payxLogs.map((l) => ({ blockNumber: String(l.blockNumber), transactionHash: l.transactionHash, logIndex: l.logIndex, data: l.data, topics: l.topics })) }))
  }
  const windows = cursor0 > toBlock ? 0 : Number((toBlock - cursor0) / WINDOW) + 1
  let n = 0
  for (let a = cursor0; a <= toBlock; a += WINDOW) {
    const b = a + WINDOW - 1n > toBlock ? toBlock : a + WINDOW - 1n
    payxLogs.push(...(await paced(() => client.getLogs({ address: PAYX, fromBlock: a, toBlock: b }))))
    n += 1
    if (n % 25 === 0 || b === toBlock) {
      saveCache(b)
      process.stderr.write(`  events ${n}/${windows} windows (to block ${b})
`)
    }
  }

  const decoded = []
  for (const log of payxLogs) {
    try {
      decoded.push({ log, d: decodeEventLog({ abi: PAYX_ABI, data: log.data, topics: log.topics }) })
    } catch {
      /* admin and link events carry no value */
    }
  }
  const payxReceipts = await fetchReceipts(decoded.map((x) => x.log.transactionHash))
  const txTransfers = new Map()
  const usdcOf = (tx) => txTransfers.get(tx) ?? txTransfers.set(tx, transfersOf(payxReceipts.get(tx), USDC)).get(tx)
  const take = (tx, pred) => {
    const hit = usdcOf(tx).find((t) => !t.used && pred(t))
    if (hit) hit.used = true
    return hit
  }

  const rows = []
  const sum = { tips: 0, gross: 0n, net: 0n, fees: 0n, claims: 0, claimed: 0n, feesWithdrawn: 0n, swept: 0n, matchedIn: 0n, matchedOut: 0n }
  let unmatchedEvents = 0
  for (const { log, d } of decoded) {
    const tx = log.transactionHash
    const base = { block: Number(log.blockNumber), tx, logIndex: log.logIndex }
    if (d.eventName === 'TipSent') {
      const gross = d.args.amount + d.args.fee
      const t = take(tx, (x) => x.from === lc(d.args.tipper) && x.to === PAYX && x.value === gross)
      sum.tips += 1
      sum.gross += gross
      sum.net += d.args.amount
      sum.fees += d.args.fee
      if (t) sum.matchedIn += t.value
      else unmatchedEvents += 1
      rows.push({ ...base, type: 'tip', handle: d.args.handle, counterparty: d.args.tipper, grossUsdc: u6(gross), feeUsdc: u6(d.args.fee), netUsdc: u6(d.args.amount), transferLogIndex: t?.logIndex ?? '', status: t ? 'matched' : 'UNMATCHED' })
    } else {
      const who = d.eventName === 'TipsClaimed' ? d.args.wallet : d.args.recipient
      const t = take(tx, (x) => x.from === PAYX && x.to === lc(who) && x.value === d.args.amount)
      if (d.eventName === 'TipsClaimed') {
        sum.claims += 1
        sum.claimed += d.args.amount
      } else if (d.eventName === 'FeesWithdrawn') sum.feesWithdrawn += d.args.amount
      else sum.swept += d.args.amount
      if (t) sum.matchedOut += t.value
      else unmatchedEvents += 1
      const type = d.eventName === 'TipsClaimed' ? 'claim' : d.eventName === 'FeesWithdrawn' ? 'fee_withdrawal' : 'sweep'
      rows.push({ ...base, type, handle: d.args.handle ?? '', counterparty: who, grossUsdc: '', feeUsdc: '', netUsdc: u6(d.args.amount), transferLogIndex: t?.logIndex ?? '', status: t ? 'matched' : 'UNMATCHED' })
    }
  }
  // USDC touching the contract inside these receipts that no event explains.
  const stray = []
  for (const [tx, list] of txTransfers) for (const t of list) if (!t.used && (t.from === PAYX || t.to === PAYX)) stray.push({ tx, logIndex: t.logIndex, from: t.from, to: t.to, usdc: u6(t.value) })

  const ledgerPending = sum.net - sum.claimed
  const ledgerFees = sum.fees - sum.feesWithdrawn
  const ledgerBalance = sum.matchedIn - sum.matchedOut
  const payx = {
    contract: PAYX,
    tips: sum.tips,
    claims: sum.claims,
    transactions: new Set(decoded.map((x) => x.log.transactionHash)).size,
    grossTippedUsdc: u6(sum.gross),
    netToRecipientsUsdc: u6(sum.net),
    feesAccruedUsdc: u6(sum.fees),
    claimedUsdc: u6(sum.claimed),
    feesWithdrawnUsdc: u6(sum.feesWithdrawn),
    sweptUsdc: u6(sum.swept),
    eventsWithoutTransfer: unmatchedEvents,
    transfersWithoutEvent: stray.length,
    checks: {
      escrow: { ledger: u6(ledgerPending), contract: u6(totalPending), equal: ledgerPending === totalPending },
      fees: { ledger: u6(ledgerFees), contract: u6(totalFees), equal: ledgerFees === totalFees },
      balance: { matchedTransfersNet: u6(ledgerBalance), contract: u6(payxBalance), equal: ledgerBalance === payxBalance },
      solvent: payxBalance >= totalPending + totalFees,
    },
  }

  // ── B. Exchange (LI.FI integrator fees into the Treasury Safe) ──────────
  const transfers = []
  let cursor
  for (let page = 0; page < 200; page++) {
    const url = new URL('https://li.quest/v2/analytics/transfers')
    url.searchParams.set('integrator', INTEGRATOR)
    url.searchParams.set('status', 'DONE')
    url.searchParams.set('limit', '1000')
    if (cursor) url.searchParams.set('next', cursor)
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`li.quest ${res.status}`)
    const body = await res.json()
    transfers.push(...(body.data ?? []))
    if (!body.hasNext || !body.next) break
    cursor = body.next
    await sleep(400)
  }

  const legs = []
  let arcOrigin = 0
  let otherTokenFees = 0
  for (const t of transfers) {
    const s = t.sending
    if (s?.chainId !== ARC || !s.txHash) continue
    arcOrigin += 1
    for (const fc of t.feeCosts ?? []) {
      const mine = (fc.feeSplit?.recipients ?? []).find((r) => lc(r.walletAddress) === TREASURY)
      if (!mine || BigInt(mine.fee || '0') === 0n) continue
      const token = lc(fc.token?.address ?? '')
      if (token !== USDC && token !== EURC) {
        otherTokenFees += 1
        continue
      }
      legs.push({ t, token, fee: BigInt(mine.fee) })
    }
  }
  const feeReceipts = await fetchReceipts(legs.map((l) => l.t.sending.txHash))
  const feeTransfers = new Map()
  const feeRows = []
  const ex = { matched: 0, matchedNative: 0, unmatched: 0, noReceipt: 0, beyondScan: 0, feeUsdc: 0n, feeEurc: 0n }
  for (const { t, token, fee } of legs) {
    const s = t.sending
    const receipt = feeReceipts.get(s.txHash)
    const k = `${s.txHash}:${token}`
    const list = feeTransfers.get(k) ?? feeTransfers.set(k, transfersOf(receipt, token)).get(k)
    let hit = list.find((x) => !x.used && x.to === TREASURY && x.value === fee)
    let via = 'erc20'
    if (!hit && token === USDC) {
      // Route paid in native USDC: the fee leg exists only as an EIP-7708 log.
      const nk = `${s.txHash}:native`
      const natives = feeTransfers.get(nk) ?? feeTransfers.set(nk, nativeTransfersOf(receipt)).get(nk)
      hit = natives.find((x) => !x.used && x.to === TREASURY && x.value === fee)
      via = 'native'
    }
    const symbol = token === USDC ? 'USDC' : 'EURC'
    const row = { block: receipt ? Number(BigInt(receipt.blockNumber)) : '', tx: s.txHash, timestamp: s.timestamp, wallet: t.fromAddress, tool: t.tool, sendToken: s.token?.symbol, sendAmount: s.amount, feeToken: symbol, fee: u6(fee) }
    if (receipt && BigInt(receipt.blockNumber) > toBlock) {
      ex.beyondScan += 1
      feeRows.push({ ...row, transferLogIndex: '', status: 'after_scan_block' })
    } else if (hit) {
      hit.used = true
      ex.matched += 1
      if (token === USDC) ex.feeUsdc += fee
      else ex.feeEurc += fee
      if (via === 'native') ex.matchedNative += 1
      feeRows.push({ ...row, transferLogIndex: hit.logIndex, status: via === 'native' ? 'matched_native_log' : 'matched' })
    } else {
      if (!receipt) ex.noReceipt += 1
      ex.unmatched += 1
      feeRows.push({ ...row, transferLogIndex: '', status: receipt ? 'UNMATCHED' : 'NO_RECEIPT' })
    }
  }
  const exchange = {
    integrator: INTEGRATOR,
    treasurySafe: TREASURY,
    lifiTransfersDone: transfers.length,
    arcOriginTransfers: arcOrigin,
    feeLegsExpected: legs.length,
    feeLegsMatched: ex.matched,
    feeLegsMatchedOnNativeLogOnly: ex.matchedNative,
    feeLegsUnmatched: ex.unmatched,
    feeLegsWithoutReceipt: ex.noReceipt,
    feeLegsAfterScanBlock: ex.beyondScan,
    feeLegsInOtherTokens: otherTokenFees,
    matchedFeesUsdc: u6(ex.feeUsdc),
    matchedFeesEurc: u6(ex.feeEurc),
  }

  // ── output ──────────────────────────────────────────────────────────────
  const csv = (list) => (list.length ? [Object.keys(list[0]).join(','), ...list.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n') : '')
  const summary = { generatedAt: new Date().toISOString(), chainId: ARC, logsRpc: LOGS_RPC, receiptsRpc: RECEIPTS_RPC, fromBlock: Number(fromBlock), toBlock: Number(toBlock), payx, exchange }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(outDir, 'payx-ledger.csv'), csv(rows))
  fs.writeFileSync(path.join(outDir, 'payx-unexplained-transfers.csv'), csv(stray))
  fs.writeFileSync(path.join(outDir, 'exchange-fee-ledger.csv'), csv(feeRows))
  console.log(JSON.stringify(summary, null, 2))
  console.error(`\nwritten to ${outDir}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
