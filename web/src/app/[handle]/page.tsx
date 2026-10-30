import { notFound, permanentRedirect } from 'next/navigation'
import { HANDLE_RE, normalizeHandle } from '@/lib/payx/handle'

/**
 * /@handle is the old pay-link form. X cuts a URL at the @, so the shareable
 * form is /to/handle; this keeps every existing /@handle link working.
 */
export default async function LegacyHandlePage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { handle } = await params
  const raw = decodeURIComponent(handle)
  if (!raw.startsWith('@')) notFound()
  const h = raw.slice(1)
  if (!HANDLE_RE.test(h)) notFound()
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') qs.set(k, v)
  const q = qs.toString()
  permanentRedirect(`/to/${normalizeHandle(h) ?? h.toLowerCase()}${q ? `?${q}` : ''}`)
}
