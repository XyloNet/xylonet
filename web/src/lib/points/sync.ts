/**
 * Sync orchestrator: keeps one PointsSnapshot fresh (LI.FI + PayX), persists it
 * through the configured store and memoises the computed ledger per instance.
 *
 *   getPoints()            -> cached ledger; says when a background refresh is due
 *   syncPoints('request')  -> one budgeted incremental step
 *   syncPoints('full')     -> unbounded backfill (admin / first run on a fresh store)
 *
 * Multiple instances (Next compiles every API route into its own module graph,
 * and Vercel runs many lambdas) may sync concurrently against the same store.
 * The STORE is therefore the source of truth: every sync starts from the
 * freshest stored snapshot and merges its result back in (union of events,
 * furthest cursors), so a slower instance can never roll a faster one back.
 */

import { SEASON } from './rules'
import { computeLedger } from './engine'
import { fetchLiFiEvents } from './sources/lifi'
import { getLogsClient, payxStartBlock, scanPayX } from './sources/payx'
import { getPointsStore } from './store'
import type { Ledger, PointsEvent, PointsSnapshot } from './types'
import seedJson from './seed.json'

const SNAPSHOT_VERSION = 1
/** A snapshot older than this triggers a refresh (in the background when possible). */
const MAX_AGE_MS = 60_000
/** Older than this (or empty) and the request waits for the refresh instead of serving stale data. */
const HARD_MAX_AGE_MS = 10 * 60_000
/** Re-read the store this often so an instance picks up other instances' syncs. */
const STORE_RELOAD_MS = 15_000
/** Re-fetch this much LI.FI history on every incremental sync so late-settling bridges are picked up. */
const LIFI_OVERLAP_S = 6 * 3600
/**
 * Request-time PayX budget: 12 windows x ~10k blocks = ~120k blocks = ~17 hours of
 * Arc per request (~0.8s per window on the public RPC, sequential). A warm
 * deployment only ever needs 1-2 windows; a cold one catches up over a few requests.
 */
const REQUEST_MAX_WINDOWS = 12
const REQUEST_CONCURRENCY = Number(process.env.POINTS_LOGS_CONCURRENCY || 1)

interface State {
  snapshot: PointsSnapshot | null
  loadedAt: number
  ledger: Ledger | null
  inflight: Promise<SyncReport> | null
  /** Last error per source on this instance (cleared on the next success). */
  lastError: { lifi: string | null; payx: string | null }
  lastReport: SyncReport | null
  bootedAt: number
}
const state: State = { snapshot: null, loadedAt: 0, ledger: null, inflight: null, lastError: { lifi: null, payx: null }, lastReport: null, bootedAt: Date.now() }

/**
 * Bundled seed: a snapshot exported from a completed local backfill
 * (`npm run points:seed`). A cold instance with an empty store starts from the
 * seed's cursors instead of block 20936229, so it only scans the blocks since
 * the seed was taken. Public onchain data only.
 */
function seedSnapshot(): PointsSnapshot | null {
  const seed = seedJson as unknown as PointsSnapshot
  if (!seed || seed.version !== SNAPSHOT_VERSION || !Array.isArray(seed.events) || seed.events.length === 0) return null
  // The seed's PayX cursor is only valid if it was taken for the same instance set (same start block).
  const start = Number(payxStartBlock())
  if (start > 0 && seed.cursors.payxSyncedBlock < start) return null
  return { ...seed, cursors: { ...seed.cursors, payxComplete: false }, updatedAt: 0 }
}

function freshSnapshot(): PointsSnapshot {
  const seeded = seedSnapshot()
  if (seeded) return seeded
  const start = payxStartBlock()
  return {
    version: SNAPSHOT_VERSION,
    events: [],
    handles: {},
    cursors: {
      lifiSyncedTo: SEASON.startsAt,
      payxSyncedBlock: Number(start > 0n ? start - 1n : 0n),
      payxComplete: false,
    },
    updatedAt: 0,
    lifiUpdatedAt: 0,
    payxUpdatedAt: 0,
  }
}

function mergeEvents(existing: PointsEvent[], incoming: PointsEvent[]): PointsEvent[] {
  if (incoming.length === 0) return existing
  const m = new Map(existing.map((e) => [e.id, e]))
  for (const e of incoming) m.set(e.id, e)
  return [...m.values()]
}

/** Union of two snapshots: all events, all handle links, the furthest cursors. */
function mergeSnapshots(a: PointsSnapshot, b: PointsSnapshot): PointsSnapshot {
  const [older, newer] = a.updatedAt <= b.updatedAt ? [a, b] : [b, a]
  const payxSyncedBlock = Math.max(a.cursors.payxSyncedBlock, b.cursors.payxSyncedBlock)
  const ahead = a.cursors.payxSyncedBlock >= b.cursors.payxSyncedBlock ? a : b
  return {
    version: SNAPSHOT_VERSION,
    events: mergeEvents(older.events, newer.events).sort((x, y) => x.ts - y.ts || (x.id < y.id ? -1 : 1)),
    handles: { ...older.handles, ...newer.handles },
    cursors: {
      lifiSyncedTo: Math.max(a.cursors.lifiSyncedTo, b.cursors.lifiSyncedTo),
      payxSyncedBlock,
      payxComplete: ahead.cursors.payxComplete,
    },
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    lifiUpdatedAt: Math.max(a.lifiUpdatedAt || 0, b.lifiUpdatedAt || 0),
    payxUpdatedAt: Math.max(a.payxUpdatedAt || 0, b.payxUpdatedAt || 0),
  }
}

function setSnapshot(s: PointsSnapshot) {
  state.snapshot = s
  state.loadedAt = Date.now()
  if (!state.ledger || state.ledger.computedFrom !== s.updatedAt) state.ledger = computeLedger(s)
}

/** Current snapshot, re-read from the store when ours is missing or older than STORE_RELOAD_MS. */
async function loadSnapshot(force = false): Promise<PointsSnapshot> {
  const dueForReload = force || !state.snapshot || Date.now() - state.loadedAt > STORE_RELOAD_MS
  if (dueForReload) {
    const stored = await getPointsStore().load()
    const valid = stored && stored.version === SNAPSHOT_VERSION ? stored : null
    if (valid && state.snapshot) setSnapshot(mergeSnapshots(state.snapshot, valid))
    else if (valid) setSnapshot(valid)
    else if (!state.snapshot) setSnapshot(freshSnapshot())
    else state.loadedAt = Date.now()
  }
  return state.snapshot!
}

export type SyncMode = 'request' | 'full'

export interface SyncReport {
  mode: SyncMode
  ms: number
  lifi: { ok: boolean; added: number; error?: string }
  payx: { ok: boolean; added: number; windows: number; fromBlock: number; toBlock: number; complete: boolean; error?: string }
  events: number
  wallets: number
}

async function runSync(mode: SyncMode): Promise<SyncReport> {
  const started = Date.now()
  const prev = await loadSnapshot(true)
  const next: PointsSnapshot = { ...prev, cursors: { ...prev.cursors }, handles: { ...prev.handles } }
  const nowS = Math.floor(Date.now() / 1000)
  const report: SyncReport = {
    mode,
    ms: 0,
    lifi: { ok: false, added: 0 },
    payx: { ok: false, added: 0, windows: 0, fromBlock: prev.cursors.payxSyncedBlock + 1, toBlock: 0, complete: prev.cursors.payxComplete },
    events: prev.events.length,
    wallets: 0,
  }

  // LI.FI (swaps + bridges)
  const lifiTask = (async () => {
    // A full sync re-reads every LI.FI transfer since launch (cheap: ~25 API calls) so fields
    // added later, such as the fee legs, are filled on events ingested before they existed.
    const from = mode === 'full' ? SEASON.startsAt : Math.max(SEASON.startsAt, prev.cursors.lifiSyncedTo - LIFI_OVERLAP_S)
    const to = SEASON.endsAt !== null ? Math.min(nowS, SEASON.endsAt) : nowS
    const events = await fetchLiFiEvents(from, to)
    return { events, to }
  })()

  // PayX (tips sent / claimed / handle links)
  const payxTask = (async () => {
    const head = await getLogsClient().getBlockNumber()
    const from = BigInt(prev.cursors.payxSyncedBlock + 1)
    const res = await scanPayX(
      from,
      head,
      mode === 'full' ? { concurrency: REQUEST_CONCURRENCY } : { maxWindows: REQUEST_MAX_WINDOWS, concurrency: REQUEST_CONCURRENCY }
    )
    return { ...res, head }
  })()

  const [lifi, payx] = await Promise.allSettled([lifiTask, payxTask])

  if (lifi.status === 'fulfilled') {
    const before = next.events.length
    next.events = mergeEvents(next.events, lifi.value.events)
    next.cursors.lifiSyncedTo = lifi.value.to
    next.lifiUpdatedAt = Date.now()
    report.lifi = { ok: true, added: next.events.length - before }
  } else {
    report.lifi = { ok: false, added: 0, error: (lifi.reason as Error)?.message ?? 'unknown' }
    console.error('[points/sync] lifi failed:', report.lifi.error)
  }

  if (payx.status === 'fulfilled') {
    const before = next.events.length
    next.events = mergeEvents(next.events, payx.value.events)
    for (const link of payx.value.handleLinks) {
      if (link.unlinkWallet && next.handles[link.unlinkWallet] === link.handle) delete next.handles[link.unlinkWallet]
      next.handles[link.wallet] = link.handle
    }
    next.cursors.payxSyncedBlock = Number(payx.value.scannedTo)
    next.cursors.payxComplete = payx.value.complete
    next.payxUpdatedAt = Date.now()
    report.payx = {
      ok: !payx.value.error,
      added: next.events.length - before,
      windows: payx.value.windowsUsed,
      fromBlock: report.payx.fromBlock,
      toBlock: Number(payx.value.head),
      complete: payx.value.complete,
      ...(payx.value.error ? { error: payx.value.error } : {}),
    }
    if (payx.value.error) console.error('[points/sync] payx stopped early:', payx.value.error)
  } else {
    report.payx = { ...report.payx, ok: false, error: (payx.reason as Error)?.message ?? 'unknown' }
    console.error('[points/sync] payx failed:', report.payx.error)
  }

  next.updatedAt = Date.now()

  // Merge with whatever landed in the store while we were syncing, then persist.
  const store = getPointsStore()
  let merged = next
  try {
    const latest = await store.load()
    if (latest && latest.version === SNAPSHOT_VERSION) merged = mergeSnapshots(latest, next)
  } catch (e) {
    console.error('[points/sync] store reload failed:', (e as Error).message)
  }
  merged.events.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1))
  setSnapshot(merged)
  try {
    await store.save(merged)
  } catch (e) {
    console.error('[points/sync] store save failed:', (e as Error).message)
  }

  report.events = merged.events.length
  report.wallets = state.ledger?.totals.wallets ?? 0
  report.ms = Date.now() - started
  state.lastError = { lifi: report.lifi.error ?? null, payx: report.payx.error ?? null }
  state.lastReport = report
  return report
}

/** Operational status for /api/points/health (no platform metrics). */
export async function getSyncHealth() {
  const s = await loadSnapshot()
  const r = state.lastReport
  return {
    instance: { bootedAt: state.bootedAt, syncing: state.inflight !== null },
    cursors: s.cursors,
    updatedAt: s.updatedAt,
    lifi: { updatedAt: s.lifiUpdatedAt, error: state.lastError.lifi },
    payx: {
      updatedAt: s.payxUpdatedAt,
      complete: s.cursors.payxComplete,
      error: state.lastError.payx,
      lastScan: r ? { windows: r.payx.windows, fromBlock: r.payx.fromBlock, toBlock: r.payx.toBlock, ms: r.ms } : null,
    },
  }
}

/** Run a sync now (deduplicated per instance; concurrent callers share the result). */
export function syncPoints(mode: SyncMode = 'request'): Promise<SyncReport> {
  if (!state.inflight) {
    state.inflight = runSync(mode).finally(() => {
      state.inflight = null
    })
  }
  return state.inflight
}

export interface PointsView {
  snapshot: PointsSnapshot
  ledger: Ledger
  /** true while the PayX backfill has not reached the chain head yet. */
  partial: boolean
  /** true when a source has not refreshed for 15+ minutes (data shown may be older). */
  stale: boolean
  /** true when the caller should schedule a background refresh (see `after()` in the routes). */
  refreshDue: boolean
}

/**
 * Cached ledger for request handlers. Serves what it has and flags a
 * background refresh when the snapshot is older than MAX_AGE_MS; only waits
 * in-line when the snapshot is empty, very old, or the backfill is incomplete.
 * Never throws.
 */
export async function getPoints(opts: { maxAgeMs?: number } = {}): Promise<PointsView> {
  const maxAge = opts.maxAgeMs ?? MAX_AGE_MS
  let snapshot = await loadSnapshot()
  const age = Date.now() - snapshot.updatedAt
  const mustWait = snapshot.events.length === 0 || age > HARD_MAX_AGE_MS || !snapshot.cursors.payxComplete
  if (mustWait) {
    try {
      await syncPoints('request')
      snapshot = state.snapshot ?? snapshot
    } catch (e) {
      console.error('[points] sync failed:', (e as Error).message)
    }
  }
  if (!state.ledger || state.ledger.computedFrom !== snapshot.updatedAt) state.ledger = computeLedger(snapshot)
  const stale = Date.now() - Math.min(snapshot.lifiUpdatedAt || 0, snapshot.payxUpdatedAt || 0) > 15 * 60_000
  const refreshDue = !mustWait && age > maxAge
  return { snapshot, ledger: state.ledger, partial: !snapshot.cursors.payxComplete, stale, refreshDue }
}

/** Fire-and-forget refresh for `after()` in route handlers. */
export function refreshInBackground(): void {
  syncPoints('request').catch((e) => console.error('[points] background sync failed:', (e as Error).message))
}

/** Events for one wallet (lower-cased), from the current snapshot. */
export function eventsForWallet(snapshot: PointsSnapshot, wallet: string): PointsEvent[] {
  const w = wallet.toLowerCase()
  return snapshot.events.filter((e) => e.wallet === w)
}
