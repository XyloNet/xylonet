import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { formatUnits } from 'viem'
import { PayCard } from '@/components/pay/PayCard'
import { Amount } from '@/components/xylo/Amount'
import { StatusPill } from '@/components/xylo/StatusPill'
import { CopyField } from '@/components/xylo/CopyField'
import { HANDLE_RE, normalizeHandle } from '@/lib/payx/handle'
import { readHandleInfo } from '@/lib/payx/server'

export const revalidate = 30

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

function parse(segment: string): string | null {
  let raw: string
  try {
    raw = decodeURIComponent(segment)
  } catch {
    return null
  }
  const h = raw.startsWith('@') ? raw.slice(1) : raw
  if (!HANDLE_RE.test(h)) return null
  return normalizeHandle(h) ?? h.toLowerCase()
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const h = parse(handle)
  if (!h) return { title: 'Not found' }
  return {
    title: `Pay @${h}`,
    description: `Pay @${h} in USDC on Arc. No wallet needed to receive: they sign in with X to claim. Settled instantly, fees in cents.`,
    alternates: { canonical: `/to/${h}` },
    openGraph: { title: `Pay @${h} in USDC`, description: `Pay @${h} on Arc via XyloNet. Instant, in dollars.`, url: `${APP_URL}/to/${h}` },
    twitter: { card: 'summary_large_image', title: `Pay @${h} in USDC` },
  }
}

/** Public pay page: /to/handle (X cuts links at an @, so the shareable form has none). A link, a QR code and the payment card. */
export default async function CreatorPage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { handle } = await params
  const sp = await searchParams
  const h = parse(handle)
  if (!h) notFound()
  const [info, qr] = await Promise.all([
    readHandleInfo(h).catch(() => null),
    QRCode.toString(`${APP_URL}/to/${h}`, { type: 'svg', margin: 1, width: 160, color: { dark: '#191e29', light: '#ffffff' } }), // token-exempt: QR stays dark on white so every scanner reads it
  ])
  const amount = sp.amount && /^\d+(\.\d+)?$/.test(sp.amount) ? sp.amount : '5'
  const note = (sp.note ?? '').slice(0, 280)

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="type-eyebrow">Pay on Arc</div>
          <h1 className="type-display mt-2 text-[clamp(32px,5vw,48px)]">@{h}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {info?.isRegistered ? (
              <StatusPill tone="ok" dot={false}>Claims to a linked wallet</StatusPill>
            ) : info && info.tipCount > 0n ? (
              <StatusPill tone="info" dot={false}>
                {info.tipCount.toString()} tip{info.tipCount === 1n ? '' : 's'} waiting
              </StatusPill>
            ) : (
              <StatusPill tone="neutral" dot={false}>New to PayX</StatusPill>
            )}
            {info && info.totalReceived > 0n && (
              <span className="text-[13px] text-ink-3">
                <Amount value={Number(formatUnits(info.totalReceived, 6))} size="sm" dollar /> received so far
              </span>
            )}
          </div>
        </div>
        <Link href="/pay/creator" className="text-[13.5px] text-signal-deep underline underline-offset-4 decoration-current/60 hover:decoration-current">
          Is this you? Claim your tips
        </Link>
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,480px)_1fr] md:items-start">
        <section aria-label={`Pay @${h}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <PayCard initialTo={`@${h}`} initialAmount={amount} initialNote={note} lockedHandle />
        </section>
        <aside className="grid gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="type-eyebrow">Pay link</div>
            <div className="mt-3 flex flex-wrap items-start gap-5">
              <div className="rounded-lg border border-border bg-white p-2 [&_svg]:block [&_svg]:size-[136px]" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR code for ${APP_URL}/to/${h}`} role="img" />
              <div className="min-w-0 flex-1 basis-[220px]">
                <CopyField value={`${APP_URL}/to/${h}`} label="Link" />
                <p className="mt-2 text-[13px] text-ink-3">Anyone with this link or code can pay @{h} in USDC. Add <span className="font-mono">?amount=5</span> to preset an amount.</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-[14px] text-ink-2">
            <div className="type-eyebrow">What happens</div>
            <p className="mt-2">Payments to @{h} are held by the PayX contract on Arc under the handle. When @{h} signs in with X on XyloNet and picks a wallet, everything waiting is paid out in one transaction. No expiry, no custody by XyloNet.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
