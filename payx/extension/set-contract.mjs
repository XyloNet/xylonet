// After the deployment ceremony: `node set-contract.mjs 0xPayXAddress` writes the mainnet PayX
// address into every extension file, then `node package.mjs` zips it for the Chrome Web Store.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const addr = process.argv[2]
if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr) || /^0x0{40}$/.test(addr)) {
  console.error('usage: node set-contract.mjs 0x<PayXTipping v2 mainnet address>')
  process.exit(1)
}
const files = ['content.js', 'background.js', 'popup.js']
const re = /PAYX:\s*"0x[0-9a-fA-F]{40}"/g
for (const f of files) {
  const p = resolve(__dirname, f)
  const s = readFileSync(p, 'utf8')
  const n = (s.match(re) || []).length
  writeFileSync(p, s.replace(re, `PAYX: "${addr}"`))
  console.log(`${f}: ${n} occurrence(s) set`)
}
console.log('Done. Reload the unpacked extension or run `node package.mjs`.')
