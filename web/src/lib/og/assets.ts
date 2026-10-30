import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// token-exempt: share-image colours mirror globals.css tokens (paper, card, ink, signal)
export const OG = {
  PAPER: '#f4f1ea', // token-exempt
  CARD: '#fffdf8', // token-exempt
  INK: '#121212', // token-exempt
  INK2: '#4b4740', // token-exempt
  INK3: '#6b665d', // token-exempt
  SIGNAL: '#e8461b', // token-exempt
  SIGNAL_DEEP: '#b9350f', // token-exempt
  TINT: '#fbe3da', // token-exempt
  LINE: 'rgba(18,18,18,0.14)', // token-exempt
} as const

export const OG_SIZE = { width: 1200, height: 630 }

type OgFont = { name: string; data: Buffer; weight: 400 | 500 | 600; style: 'normal' | 'italic' }

const FONT_FILES: Array<[string, string, OgFont['weight'], OgFont['style']]> = [
  ['Fraunces', 'fraunces-latin-400-normal.ttf', 400, 'normal'],
  ['Fraunces', 'fraunces-latin-400-italic.ttf', 400, 'italic'],
  ['Instrument Sans', 'instrument-sans-latin-500-normal.ttf', 500, 'normal'],
  ['Instrument Sans', 'instrument-sans-latin-600-normal.ttf', 600, 'normal'],
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
