import 'server-only'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { get as blobGet, put as blobPut } from '@vercel/blob'

/**
 * Push subscriptions per X handle, plus the block cursor of the last
 * dispatch. Vercel Blob in production (private), a local file in dev.
 */
export interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
  addedAt: number
}
export interface PushState {
  version: 1
  subs: Record<string, PushSub[]>
  lastDispatchedBlock: number
  updatedAt: number
}

const BLOB_PATH = 'push/state.json'
const FILE = path.join(process.cwd(), '.data', 'push', 'state.json')
const empty = (): PushState => ({ version: 1, subs: {}, lastDispatchedBlock: 0, updatedAt: 0 })

const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN

export async function loadPush(): Promise<PushState> {
  try {
    if (blobEnabled()) {
      const res = await blobGet(BLOB_PATH, { access: 'private', useCache: false }).catch(() => null)
      if (!res || res.statusCode !== 200) return empty()
      const text = await new Response(res.stream).text()
      return JSON.parse(text) as PushState
    }
    const raw = await readFile(FILE, 'utf8')
    return JSON.parse(raw) as PushState
  } catch {
    return empty()
  }
}

export async function savePush(state: PushState): Promise<void> {
  state.updatedAt = Date.now()
  const body = JSON.stringify(state)
  if (blobEnabled()) {
    await blobPut(BLOB_PATH, body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' })
    return
  }
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, body, 'utf8')
}

export async function addSubscription(handle: string, sub: Omit<PushSub, 'addedAt'>): Promise<number> {
  const s = await loadPush()
  const list = (s.subs[handle] ?? []).filter((x) => x.endpoint !== sub.endpoint)
  list.push({ ...sub, addedAt: Date.now() })
  s.subs[handle] = list.slice(-5) // a handful of devices per creator is plenty
  await savePush(s)
  return s.subs[handle].length
}

export async function removeSubscription(handle: string, endpoint: string): Promise<void> {
  const s = await loadPush()
  s.subs[handle] = (s.subs[handle] ?? []).filter((x) => x.endpoint !== endpoint)
  if (s.subs[handle].length === 0) delete s.subs[handle]
  await savePush(s)
}
