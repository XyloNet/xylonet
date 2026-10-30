// Fails when a component carries a raw colour instead of a token.
// Allowed: src/app/globals.css, src/app/legacy.css (until A2), the brand
// gradient inside Logo.tsx, and any line marked `// token-exempt`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('../src/', import.meta.url))
const ALLOW_FILES = new Set(['app/globals.css', 'app/legacy.css', 'components/shell/Logo.tsx'])
// Pages not yet rebuilt in Track A are exempt until their phase lands.
const LEGACY_PREFIXES = ['app/swap/', 'app/bridge/', 'components/bridge/', 'components/lifi/', 'components/ui/Confetti.tsx', 'components/ui/ConfettiEffect.tsx', 'components/ui/TiltCard.tsx', 'components/ui/Toast.tsx', 'components/ui/TokenLogos.tsx', 'lib/lifi/', 'lib/points/', 'app/api/']
const HEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/
const RGB = /\brgba?\(/
const TW_PALETTE = /\b(?:text|bg|border|from|to|via|ring|fill|stroke)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(p)
  }
  return out
}

const problems = []
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (ALLOW_FILES.has(rel) || LEGACY_PREFIXES.some((p) => rel.startsWith(p))) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes('token-exempt')) return
    if (HEX.test(line) || RGB.test(line) || TW_PALETTE.test(line)) {
      problems.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`)
    }
  })
}

if (problems.length) {
  console.error(`Raw colours found in ${problems.length} place(s). Use tokens from globals.css:\n` + problems.join('\n'))
  process.exit(1)
}
console.log('check-tokens: clean')
