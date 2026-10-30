/**
 * Snapshot persistence for the points system.
 *
 *   file    - local dev / self-hosted: .data/points/snapshot.json (gitignored)
 *   upstash - Vercel: Upstash Redis via the Vercel Marketplace (free tier), or
 *             any Vercel KV-compatible REST endpoint. Auto-selected when the
 *             standard env vars are present.
 *   memory  - last resort (serverless without KV): each warm instance keeps its
 *             own copy and cold starts re-sync from the cursors.
 *
 * Select explicitly with POINTS_STORE=file|upstash|memory.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { get as blobGet, put as blobPut } from '@vercel/blob'
import type { PointsSnapshot } from './types'

export interface PointsStore {
  readonly kind: 'file' | 'upstash' | 'blob' | 'memory'
  load(): Promise<PointsSnapshot | null>
  save(snapshot: PointsSnapshot): Promise<void>
}

const SNAPSHOT_KEY = 'xylonet:points:snapshot:v1'

// --- file -------------------------------------------------------------------

class FileStore implements PointsStore {
  readonly kind = 'file' as const
  private readonly file: string
  constructor(dir: string) {
    this.file = path.join(dir, 'snapshot.json')
  }
  async load(): Promise<PointsSnapshot | null> {
    try {
      const raw = await readFile(this.file, 'utf8')
      return JSON.parse(raw) as PointsSnapshot
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
      console.error('[points/store] file load failed:', (e as Error).message)
      return null
    }
  }
  async save(snapshot: PointsSnapshot): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(snapshot), 'utf8')
    await rename(tmp, this.file)
  }
}

// --- upstash / vercel kv (REST) ---------------------------------------------

class UpstashStore implements PointsStore {
  readonly kind = 'upstash' as const
  constructor(private readonly url: string, private readonly token: string) {}
  private async cmd<T>(args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`upstash ${res.status}`)
    const body = (await res.json()) as { result?: T; error?: string }
    if (body.error) throw new Error(`upstash: ${body.error}`)
    return body.result as T
  }
  async load(): Promise<PointsSnapshot | null> {
    try {
      const raw = await this.cmd<string | null>(['GET', SNAPSHOT_KEY])
      return raw ? (JSON.parse(raw) as PointsSnapshot) : null
    } catch (e) {
      console.error('[points/store] upstash load failed:', (e as Error).message)
      return null
    }
  }
  async save(snapshot: PointsSnapshot): Promise<void> {
    await this.cmd(['SET', SNAPSHOT_KEY, JSON.stringify(snapshot)])
  }
}

// --- vercel blob (first-party, auto-selected when BLOB_READ_WRITE_TOKEN is set) --

const BLOB_PATH = 'points/snapshot-v1.json'

/** Last store failure on this instance, for /api/points/health. */
export const storeDiagnostics: { lastLoadError: string | null; lastSaveError: string | null; loads: number; saves: number } = {
  lastLoadError: null,
  lastSaveError: null,
  loads: 0,
  saves: 0,
}

/**
 * Blob access level. Private is preferred (only the token can read the file);
 * on a store created as public the SDK refuses private access, so we fall back
 * to public. The content is public onchain data either way, so a public URL
 * leaks nothing that the chain and LI.FI do not already expose.
 */
let blobAccess: 'private' | 'public' = process.env.POINTS_BLOB_ACCESS === 'public' ? 'public' : 'private'
const isPublicStoreError = (e: unknown) => /private access on a public store/i.test((e as Error)?.message ?? '')

class BlobStore implements PointsStore {
  readonly kind = 'blob' as const
  async load(): Promise<PointsSnapshot | null> {
    storeDiagnostics.loads += 1
    try {
      // useCache:false reads from origin so every instance sees the latest save immediately.
      let res = await blobGet(BLOB_PATH, { access: blobAccess, useCache: false }).catch(async (e: unknown) => {
        // A public store answers 400 to a private read; retry once as public.
        if (blobAccess === 'private') {
          blobAccess = 'public'
          return blobGet(BLOB_PATH, { access: 'public', useCache: false })
        }
        throw e
      })
      if (res === undefined) res = null
      if (!res || !res.stream) {
        storeDiagnostics.lastLoadError = 'blob not found'
        return null
      }
      const text = await new Response(res.stream).text()
      storeDiagnostics.lastLoadError = null
      return JSON.parse(text) as PointsSnapshot
    } catch (e) {
      storeDiagnostics.lastLoadError = (e as Error).message
      console.error('[points/store] blob load failed:', (e as Error).message)
      return null
    }
  }
  async save(snapshot: PointsSnapshot): Promise<void> {
    storeDiagnostics.saves += 1
    const body = JSON.stringify(snapshot)
    const opts = { addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 } as const
    try {
      try {
        await blobPut(BLOB_PATH, body, { access: blobAccess, ...opts })
      } catch (e) {
        if (blobAccess === 'private' && isPublicStoreError(e)) {
          blobAccess = 'public'
          await blobPut(BLOB_PATH, body, { access: 'public', ...opts })
        } else {
          throw e
        }
      }
      storeDiagnostics.lastSaveError = null
    } catch (e) {
      storeDiagnostics.lastSaveError = (e as Error).message
      throw e
    }
  }
}

// --- memory -----------------------------------------------------------------

const memoryState = new Map<string, PointsSnapshot>()

class MemoryStore implements PointsStore {
  readonly kind = 'memory' as const
  async load(): Promise<PointsSnapshot | null> {
    return memoryState.get(SNAPSHOT_KEY) ?? null
  }
  async save(snapshot: PointsSnapshot): Promise<void> {
    memoryState.set(SNAPSHOT_KEY, snapshot)
  }
}

// --- selection --------------------------------------------------------------

let selected: PointsStore | null = null

export function getPointsStore(): PointsStore {
  if (selected) return selected
  const explicit = (process.env.POINTS_STORE || '').toLowerCase()
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  if (explicit === 'upstash' || (!explicit && kvUrl && kvToken)) {
    if (!kvUrl || !kvToken) throw new Error('POINTS_STORE=upstash but UPSTASH_REDIS_REST_URL/TOKEN missing')
    selected = new UpstashStore(kvUrl, kvToken)
  } else if (explicit === 'blob' || (!explicit && process.env.BLOB_READ_WRITE_TOKEN)) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('POINTS_STORE=blob but BLOB_READ_WRITE_TOKEN missing')
    selected = new BlobStore()
  } else if (explicit === 'memory' || (!explicit && process.env.VERCEL)) {
    selected = new MemoryStore()
  } else {
    const dir = process.env.POINTS_DATA_DIR || path.join(process.cwd(), '.data', 'points')
    selected = new FileStore(dir)
  }
  return selected
}
