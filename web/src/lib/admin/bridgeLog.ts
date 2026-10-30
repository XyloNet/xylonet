import 'server-only'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { get as blobGet, put as blobPut } from '@vercel/blob'

/**
 * Log of CCTP and Gateway actions STARTED on xylonet.xyz. Circle's contracts
 * leave no XyloNet mark on chain, so this is the only way to count them.
 * Written by /api/bridge/log (public, validated, rate-limited); read by /admin.
 * Same persistence choices as the points snapshot: file locally, Vercel Blob
 * in production, memory as a last resort.
 */
export type BridgeLogKind = 'cctp' | 'gateway_deposit' | 'gateway_spend'

export interface BridgeLogEntry {
  id: string
  kind: BridgeLogKind
  wallet: string
  amountUsd: number
  fromChainId: number
  toChainId: number
  txHash?: string
  /** Unix seconds. */
  ts: number
}

export interface BridgeLog {
  version: 1
  /** Unix ms the log was created (counts are only meaningful from here). */
  since: number
  entries: BridgeLogEntry[]
}

const MAX_ENTRIES = 50_000
const BLOB_PATH = 'admin/bridge-log-v1.json'
const KEY = 'xylonet:admin:bridge-log:v1'

function fresh(): BridgeLog {
  return { version: 1, since: Date.now(), entries: [] }
}

interface LogStore {
  kind: 'file' | 'blob' | 'memory'
  load(): Promise<BridgeLog | null>
  save(log: BridgeLog): Promise<void>
}

class FileLog implements LogStore {
  kind = 'file' as const
  private file: string
  constructor(dir: string) {
    this.file = path.join(dir, 'bridge-log.json')
  }
  async load() {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as BridgeLog
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[admin/bridgeLog] load failed:', (e as Error).message)
      return null
    }
  }
  async save(log: BridgeLog) {
    await mkdir(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(log), 'utf8')
    await rename(tmp, this.file)
  }
}

let blobAccess: 'private' | 'public' = process.env.POINTS_BLOB_ACCESS === 'public' ? 'public' : 'private'
const isPublicStoreError = (e: unknown) => /private access on a public store/i.test((e as Error)?.message ?? '')

class BlobLog implements LogStore {
  kind = 'blob' as const
  async load() {
    try {
      let res = await blobGet(BLOB_PATH, { access: blobAccess, useCache: false }).catch(async (e: unknown) => {
        if (blobAccess === 'private') {
          blobAccess = 'public'
          return blobGet(BLOB_PATH, { access: 'public', useCache: false })
        }
        throw e
      })
      if (res === undefined) res = null
      if (!res || !res.stream) return null
      return JSON.parse(await new Response(res.stream).text()) as BridgeLog
    } catch (e) {
      console.error('[admin/bridgeLog] blob load failed:', (e as Error).message)
      return null
    }
  }
  async save(log: BridgeLog) {
    const body = JSON.stringify(log)
    const opts = { addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 } as const
    try {
      await blobPut(BLOB_PATH, body, { access: blobAccess, ...opts })
    } catch (e) {
      if (blobAccess === 'private' && isPublicStoreError(e)) {
        blobAccess = 'public'
        await blobPut(BLOB_PATH, body, { access: 'public', ...opts })
      } else throw e
    }
  }
}

const memory = new Map<string, BridgeLog>()
class MemoryLog implements LogStore {
  kind = 'memory' as const
  async load() {
    return memory.get(KEY) ?? null
  }
  async save(log: BridgeLog) {
    memory.set(KEY, log)
  }
}

let store: LogStore | null = null
function getStore(): LogStore {
  if (store) return store
  const explicit = (process.env.POINTS_STORE || '').toLowerCase()
  if (explicit === 'blob' || (!explicit && process.env.BLOB_READ_WRITE_TOKEN)) store = new BlobLog()
  else if (explicit === 'memory' || explicit === 'upstash' || (!explicit && process.env.VERCEL)) store = new MemoryLog()
  else store = new FileLog(process.env.POINTS_DATA_DIR ? path.join(process.env.POINTS_DATA_DIR, '..', 'admin') : path.join(process.cwd(), '.data', 'admin'))
  return store
}

export function bridgeLogStoreKind(): LogStore['kind'] {
  return getStore().kind
}

export async function readBridgeLog(): Promise<BridgeLog> {
  return (await getStore().load()) ?? fresh()
}

/** Append one entry (deduplicated by txHash when present). Serialised per instance. */
let chain: Promise<unknown> = Promise.resolve()
export function appendBridgeLog(entry: Omit<BridgeLogEntry, 'id' | 'ts'> & { ts?: number }): Promise<BridgeLogEntry> {
  const run = async () => {
    const s = getStore()
    const log = (await s.load()) ?? fresh()
    if (entry.txHash) {
      const hash = entry.txHash.toLowerCase()
      const dup = log.entries.find((e) => e.txHash && e.txHash.toLowerCase() === hash)
      if (dup) return dup
    }
    const row: BridgeLogEntry = { ...entry, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, ts: entry.ts ?? Math.floor(Date.now() / 1000) }
    log.entries.push(row)
    if (log.entries.length > MAX_ENTRIES) log.entries.splice(0, log.entries.length - MAX_ENTRIES)
    await s.save(log)
    return row
  }
  const p = chain.then(run, run)
  chain = p.catch(() => undefined)
  return p
}
