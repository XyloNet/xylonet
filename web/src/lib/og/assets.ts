import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// token-exempt: share-image colours mirror globals.css tokens (navy ground, card, white ink, mint signal)
export const OG = {
  PAPER: '#191e29', // token-exempt
  CARD: '#1f2634', // token-exempt
  INK: '#ffffff', // token-exempt
  INK2: '#b9bfca', // token-exempt
  INK3: '#8f96a3', // token-exempt
  SIGNAL: '#01c38d', // token-exempt
  SIGNAL_DEEP: '#2adba6', // token-exempt
  TINT: '#143a34', // token-exempt
  LINE: 'rgba(255,255,255,0.14)', // token-exempt
  /** QR codes stay dark-on-white so every scanner reads them. */
  QR_INK: '#191e29', // token-exempt
  QR_PAPER: '#ffffff', // token-exempt
} as const

export const OG_SIZE = { width: 1200, height: 630 }

type OgFont = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800; style: 'normal' | 'italic' }

const FONT_FILES: Array<[string, string, OgFont['weight'], OgFont['style']]> = [
  ['Manrope', 'manrope-latin-500-normal.woff', 500, 'normal'],
  ['Manrope', 'manrope-latin-600-normal.woff', 600, 'normal'],
  ['Manrope', 'manrope-latin-700-normal.woff', 700, 'normal'],
  ['Manrope', 'manrope-latin-800-normal.woff', 800, 'normal'],
  ['Geist Mono', 'geist-mono-latin-400-normal.ttf', 400, 'normal'],
]

let fonts: Promise<OgFont[]> | null = null

/** The brand typefaces as static TTFs (share images cannot use variable fonts). */
export function ogFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all(
    FONT_FILES.map(async ([name, file, weight, style]) => ({ name, weight, style, data: await readFile(join(process.cwd(), 'src', 'assets', 'og', file)) })),
  )
  return fonts
}

const cache = new Map<string, Promise<string>>()

/** A file from /public as a data URI, for <img> inside a share image. */
export function publicDataUri(rel: string, mime: string): Promise<string> {
  let p = cache.get(rel)
  if (!p) {
    p = readFile(join(process.cwd(), 'public', ...rel.split('/'))).then((b) => `data:${mime};base64,${b.toString('base64')}`)
    cache.set(rel, p)
  }
  return p
}
