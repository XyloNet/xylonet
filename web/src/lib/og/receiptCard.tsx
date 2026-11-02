import 'server-only'
import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { formatUnits, isHex } from 'viem'
import { readTipReceipt } from '@/lib/payx/server'
import { getXAvatar } from '@/lib/payx/avatar'
import { formatAmount, shortAddress } from '@/lib/format'
import { PAYX_ASSETS } from '@/config/constants'
import { OG, OG_SIZE, ogFonts, publicDataUri } from '@/lib/og/assets'

const pill = { display: 'flex', alignItems: 'center', gap: 10, border: `2px solid ${OG.LINE}`, background: OG.CARD, borderRadius: 999, padding: '9px 18px', fontSize: 23, fontWeight: 500 } as const

/**
 * Share card for a payment, rendered from chain data so it cannot be forged:
 * who was paid (their X picture and handle), how much was sent, and a QR code
 * to the receipt page. Bottom-left stays quiet because X overlays the title there.
 */
export async function receiptCardResponse(tx: string, opts: { showNote?: boolean } = {}): Promise<ImageResponse> {
  const showNote = opts.showNote !== false
  const r = isHex(tx) && tx.length === 66 ? await readTipReceipt(tx).catch(() => null) : null
  const link = r ? `xylonet.xyz/pay/receipt/${tx}` : 'xylonet.xyz/pay'
  const asset = PAYX_ASSETS[r?.asset ?? 'USDC']
  // cirBTC has no raster mark we can embed; its pill shows the symbol instead.
  const tokenLogo = asset.key === 'EURC' ? publicDataUri('tokens/eurc.png', 'image/png') : asset.key === 'USDC' ? publicDataUri('tokens/usdc.svg', 'image/svg+xml') : Promise.resolve(null)
  const [fonts, mark, usdc, arc, avatar, qr] = await Promise.all([
    ogFonts(),
    publicDataUri('mark.svg', 'image/svg+xml'),
    tokenLogo,
    publicDataUri('chains/5042.png', 'image/png'),
    r ? getXAvatar(r.handle) : Promise.resolve(null),
    QRCode.toString(`https://www.${link}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'L', color: { dark: OG.QR_INK, light: OG.QR_PAPER } }),
  ])
  const qrUri = `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`
  const sent = r ? formatAmount(Number(formatUnits(r.amount, r.decimals)), asset.fractionDigits) : null
  const net = r ? formatAmount(Number(formatUnits(r.net, r.decimals)), asset.fractionDigits) : null
  const sentSize = (sent?.length ?? 0) > 8 ? 84 : (sent?.length ?? 0) > 6 ? 104 : 128
  const name = r ? `@${r.handle}` : ''
  const nameSize = name.length > 14 ? 40 : name.length > 11 ? 46 : 54

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: OG.PAPER, color: OG.INK, padding: '52px 56px', fontFamily: 'Manrope' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={mark} width={40} height={40} />
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.6 }}>xylonet</span>
            <span style={{ display: 'flex', marginLeft: 10, fontFamily: 'Geist Mono', fontSize: 19, color: OG.INK3 }}>Receipt</span>
            <span style={{ display: 'flex', marginLeft: 'auto', border: `3px solid ${OG.SIGNAL_DEEP}`, color: OG.SIGNAL_DEEP, borderRadius: 10, padding: '4px 14px', fontFamily: 'Geist Mono', fontSize: 20, letterSpacing: 1, transform: 'rotate(-2deg)' }}>Settled</span>
          </div>

          {r ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 34 }}>
                <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: sentSize, lineHeight: 1, letterSpacing: -4 }}>{asset.currencyPrefix}{sent}</span>
                <span style={{ fontSize: 34, fontWeight: 500, color: OG.INK3 }}>{asset.token.symbol}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 22 }}>
                <span style={{ fontSize: 30, fontWeight: 500, color: OG.INK3 }}>to</span>
                <div style={{ display: 'flex', width: 76, height: 76, borderRadius: 38, border: `3px solid ${OG.SIGNAL}`, padding: 3, background: OG.PAPER }}>
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                    <img src={avatar} width={64} height={64} style={{ borderRadius: 32, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 32, background: OG.TINT, color: OG.SIGNAL_DEEP, fontFamily: 'Manrope', fontWeight: 700, fontSize: 36 }}>{r.handle.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: nameSize, letterSpacing: -1 }}>{name}</span>
              </div>

              {showNote && r.message ? (
                <div style={{ display: 'flex', marginTop: 18, fontFamily: 'Manrope', fontSize: 28, color: OG.INK2, borderLeft: `4px solid ${OG.SIGNAL}`, paddingLeft: 14, maxWidth: 640 }}>“{r.message.slice(0, 90)}”</div>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: showNote && r.message ? 22 : 30 }}>
                <span style={pill}>
                  {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                  {usdc ? <img src={usdc} width={28} height={28} /> : null}
                  They receive {net}{usdc ? '' : ` ${asset.token.symbol}`}
                </span>
                <span style={pill}>
                  {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                  <img src={arc} width={26} height={27} style={{ objectFit: 'contain' }} />
                  on Arc
                </span>
                <span style={pill}>from {shortAddress(r.tipper)}</span>
              </div>
            </div>
          ) : (
            <span style={{ display: 'flex', marginTop: 90, fontFamily: 'Manrope', fontWeight: 800, fontSize: 84, letterSpacing: -2 }}>A payment on Arc.</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 352 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: OG.CARD, border: `2px solid ${OG.LINE}`, borderRadius: 30, padding: '28px 28px 22px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={qrUri} width={292} height={292} />
            <span style={{ display: 'flex', marginTop: 18, fontSize: 24, fontWeight: 600 }}>{r ? 'Verify onchain' : 'Pay on Arc'}</span>
            <span style={{ display: 'flex', marginTop: 4, fontFamily: 'Geist Mono', fontSize: 16, color: OG.INK3 }}>{r ? `tx ${tx.slice(0, 10)}…${tx.slice(-6)}` : link}</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  )
}
