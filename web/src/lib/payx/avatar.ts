import 'server-only'
import { get as blobGet, put as blobPut } from '@vercel/blob'

/**
 * A public X profile picture for a handle, as a data URI, or null.
 *
 * The picture comes from unavatar.io (no X API key needed, about 25 lookups a
 * day per server address), so each one is kept in the Blob store for a week
 * and misses are remembered in memory for a few hours.
 */
const WEEK = 7 * 24 * 60 * 60 * 1000
const MISS_TTL = 6 * 60 * 60 * 1000
const memory = new Map<string, { at: number; uri: string | null }>()

const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN
const key = (h: string) => `avatars/${h}.img`

async function fromBlob(h: string): Promise<string | null> {
  if (!blobEnabled()) return null
  try {
    const res = await blobGet(key(h), { access: 'private' })
    if (!res || res.statusCode !== 200) return null
    if (Date.now() - new Date(res.blob.uploadedAt).getTime() > WEEK) return null
    const buf = Buffer.from(await new Response(res.stream).arrayBuffer())
    return `data:${res.blob.contentType || 'image/jpeg'};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

async function fromSource(h: string): Promise<{ uri: string; buf: Buffer; type: string } | null> {
  try {
    const r = await fetch(`https://unavatar.io/x/${encodeURIComponent(h)}?fallback=false`, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    if (!r.ok) return null
    const type = r.headers.get('content-type') || ''
    if (!/^image\/(jpeg|png|webp)/.test(type)) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 200 || buf.length > 1_500_000) return null
    return { uri: `data:${type.split(';')[0]};base64,${buf.toString('base64')}`, buf, type: type.split(';')[0] }
  } catch {
    return null
  }
}

export async function getXAvatar(handle: string): Promise<string | null> {
  const h = handle.toLowerCase()
  const hit = memory.get(h)
  if (hit && Date.now() - hit.at < (hit.uri ? WEEK : MISS_TTL)) return hit.uri
  const cached = await fromBlob(h)
  if (cached) {
    memory.set(h, { at: Date.now(), uri: cached })
    return cached
  }
  const fresh = await fromSource(h)
  memory.set(h, { at: Date.now(), uri: fresh?.uri ?? null })
  if (fresh && blobEnabled()) {
    await blobPut(key(h), fresh.buf, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: fresh.type }).catch(() => {})
  }
  return fresh?.uri ?? null
}
