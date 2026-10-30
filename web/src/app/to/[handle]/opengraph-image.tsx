import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { HANDLE_RE, normalizeHandle } from '@/lib/payx/handle'
import { getXAvatar } from '@/lib/payx/avatar'
import { OG, OG_SIZE, ogFonts, publicDataUri } from '@/lib/og/assets'

export const runtime = 'nodejs'
export const revalidate = 86400
export const alt = 'Pay in USDC on Arc via XyloNet'
export const size = OG_SIZE
export const contentType = 'image/png'

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

const pill = { display: 'flex', alignItems: 'center', gap: 10, border: `2px solid ${OG.LINE}`, background: OG.CARD, borderRadius: 999, padding: '9px 18px', fontSize: 23, fontWeight: 500 } as const

/**
 * Link card for a pay link. The person is the headline (their X picture and
 * handle), the QR code makes the card itself payable from another screen, and
 * the bottom-left stays quiet because X overlays the page title there.
 */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = parse(handle)
  const link = h ? `xylonet.xyz/to/${h}` : 'xylonet.xyz/pay'
  const [fonts, mark, usdc, arc, avatar, qr] = await Promise.all([
    ogFonts(),
    publicDataUri('mark.svg', 'image/svg+xml'),
    publicDataUri('tokens/usdc.svg', 'image/svg+xml'),
    publicDataUri('chains/5042.png', 'image/png'),
    h ? getXAvatar(h) : Promise.resolve(null),
    QRCode.toString(`https://www.${link}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: OG.INK, light: OG.CARD } }),
  ])
  const qrUri = `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`
  const name = h ? `@${h}` : 'anyone on X'
  const big = name.length > 14 ? 52 : name.length > 12 ? 60 : name.length > 9 ? 72 : name.length > 7 ? 86 : 98

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: OG.PAPER, color: OG.INK, padding: '52px 56px', fontFamily: 'Instrument Sans' }}>
        {/* left: who you are paying */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={mark} width={40} height={40} />
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.6 }}>xylonet</span>
            <span style={{ display: 'flex', marginLeft: 10, fontFamily: 'Geist Mono', fontSize: 19, color: OG.INK3 }}>Pay link</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 50 }}>
            <div style={{ display: 'flex', width: 136, height: 136, borderRadius: 68, border: `4px solid ${OG.SIGNAL}`, padding: 5, background: OG.PAPER }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={avatar} width={118} height={118} style={{ borderRadius: 59, objectFit: 'cover' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 118, height: 118, borderRadius: 59, background: OG.TINT, color: OG.SIGNAL_DEEP, fontFamily: 'Fraunces', fontSize: 64 }}>{(h ?? 'x').charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 500 }}>
              <span style={{ fontSize: 30, fontWeight: 500, color: OG.INK3 }}>Pay</span>
              <span style={{ fontFamily: 'Fraunces', fontSize: big, lineHeight: 1.05, letterSpacing: -2 }}>{name}</span>
            </div>
          </div>

          <div style={{ display: 'flex', marginTop: 22, fontFamily: 'Fraunces', fontSize: 46, letterSpacing: -1 }}>
            in dollars,&nbsp;<span style={{ fontStyle: 'italic', color: OG.SIGNAL }}>instantly.</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 30 }}>
            <span style={pill}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={usdc} width={28} height={28} />
              USDC
            </span>
            <span style={pill}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={arc} width={26} height={27} style={{ objectFit: 'contain' }} />
              on Arc
            </span>
            <span style={pill}>One signature</span>
            <span style={pill}>No wallet needed to receive</span>
          </div>
        </div>

        {/* right: the card is payable from another screen */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 352 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: OG.CARD, border: `2px solid ${OG.LINE}`, borderRadius: 30, padding: '28px 28px 22px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={qrUri} width={292} height={292} />
            <span style={{ display: 'flex', marginTop: 18, fontSize: 24, fontWeight: 600 }}>Scan to pay</span>
            <span style={{ display: 'flex', marginTop: 4, fontFamily: 'Geist Mono', fontSize: link.length > 28 ? 15 : 17, color: OG.INK3 }}>{link}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
