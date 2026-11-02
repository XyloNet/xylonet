// Generates the icon set and the social image from the brand mark.
// Run: node scripts/make-icons.mjs
// Brand book: Midnight Navy #191E29 tile, mark in the brand gradient
// (#132D46 → #0A786A → #01C38E), Neo Mint #01C38D for flat marks.
import sharp from 'sharp'
import opentype from 'opentype.js'
import { readFileSync, writeFileSync } from 'node:fs'

// Text in the social image is drawn as glyph outlines from the same Manrope
// files the share cards use, so the output never depends on system fonts.
function manrope(weight) {
  const b = readFileSync(`src/assets/og/manrope-latin-${weight}-normal.woff`)
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
const textPath = (font, text, x, y, size, fill) => `<path d="${font.getPath(text, x, y, size, { kerning: true }).toPathData(2)}" fill="${fill}"/>`

const PATH = 'M2538.1 1055.9l1479.46 -715.71 -166.6 -340.19 -1126.78 552.82c-235.86,115.75 -492.16,192.18 -701.88,191 -164.65,-0.96 -295.98,-51.56 -323.95,-170.56l-116.03 -493.5 -556.29 282.66 112.2 666 1399.86 27.47zm-1773.36 1151.56l963.73 482.99 1300.68 -612.25 -284 -878.16 -1447.28 -40.03 -1297.87 638.84 19.28 378.55 1054.63 -511.97c230.79,-112.04 482.89,-182.62 694.24,-171.7 173.79,8.98 319.39,74.98 356,221.52l84.82 339.56 -499.09 245.66 -534.44 -292.38 -410.7 199.38z'
const NAVY = '#191E29'
const MINT = '#01C38D'
const GRAD = '<linearGradient id="brand" x1="0" y1="0.6" x2="1" y2="0.4"><stop offset="0" stop-color="#132D46"/><stop offset="0.62" stop-color="#0A786A"/><stop offset="1" stop-color="#01C38E"/></linearGradient>'

// mark centred in a square; `pad` = fraction of side left as margin
function svg(size, { bg = null, pad = 0.14, radius = 0, fill = MINT } = {}) {
  const inner = size * (1 - pad * 2)
  const scale = inner / 4017.56
  const h = 2690.46 * scale
  const tx = size * pad
  const ty = (size - h) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${GRAD}</defs>${bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : ''}<g transform="translate(${tx} ${ty}) scale(${scale})"><path d="${PATH}" fill="${fill}"/></g></svg>`
}

const out = async (file, size, opts) => {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(file)
  console.log('wrote', file)
}
await out('public/icon-192.png', 192, { bg: NAVY, radius: 40 })
await out('public/icon-512.png', 512, { bg: NAVY, radius: 108 })
await out('public/icon-maskable-512.png', 512, { bg: NAVY, pad: 0.24 })
await out('src/app/icon.png', 64, { bg: NAVY, radius: 14, pad: 0.12 })
await out('src/app/apple-icon.png', 180, { bg: NAVY, pad: 0.16 })
writeFileSync('public/mark.svg', svg(64, { pad: 0.02, fill: 'url(#brand)' }))

// Social image: navy, gradient mark, the wordmark outlines, the tagline.
const wordmark = readFileSync('src/components/shell/Wordmark.tsx', 'utf8')
const vb = wordmark.match(/viewBox="([^"]+)"/)[1]
const glyphs = [...wordmark.matchAll(/<path transform="([^"]+)" d="([^"]+)" \/>/g)].map((m) => `<path transform="${m[1]}" d="${m[2]}"/>`).join('')
const [vx, vy, vw, vh] = vb.split(' ').map(Number)
const W = 1200, H = 630
const wmW = 520, wmScale = wmW / vw, wmH = vh * wmScale
const markScale = 150 / 2690.46, markW = 4017.56 * markScale
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GRAD}</defs>
<rect width="${W}" height="${H}" fill="${NAVY}"/>
<g opacity="0.06" transform="translate(640 -60) scale(0.22)"><path d="${PATH}" fill="#ffffff"/></g>
<g transform="translate(96 ${(H - 150) / 2 - 60}) scale(${markScale})"><path d="${PATH}" fill="url(#brand)"/></g>
<g transform="translate(${96 + markW + 36} ${(H - wmH) / 2 - 60 + 10}) scale(${wmScale}) translate(${-vx} ${-vy})" fill="#ffffff">${glyphs}</g>
${textPath(manrope(600), 'Pay anyone on X, exchange USDC and EURC, bridge dollars to Arc.', 96, H / 2 + 120, 34, '#B9BFCA')}
${textPath(manrope(500), 'Settled in under a second · xylonet.xyz', 96, H / 2 + 170, 26, MINT)}
</svg>`
await sharp(Buffer.from(og)).png().toFile('public/og.png')
console.log('wrote public/og.png')
console.log('done')
