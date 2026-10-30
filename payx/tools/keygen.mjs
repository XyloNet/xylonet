// XYLO-ORACLE-01 key generation — runs LOCALLY, prints the ADDRESS to the console,
// and writes the private key ONLY to ./oracle-key.local (gitignored, delete after use).
// The key must end up in exactly two places: the web host env (ORACLE_PRIVATE_KEY on
// Vercel) and, temporarily, payx/tools/.env for the ceremony smoke test.
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = resolve(__dirname, 'oracle-key.local')
if (existsSync(out)) {
  console.error(`Refusing to overwrite existing ${out}. Move or delete it first.`)
  process.exit(1)
}
const pk = generatePrivateKey()
const acct = privateKeyToAccount(pk)
writeFileSync(out, `# XYLO-ORACLE-01 — generated ${new Date().toISOString()}\nORACLE_SIGNER_ADDRESS=${acct.address}\nORACLE_PRIVATE_KEY=${pk}\n`, { mode: 0o600 })
console.log('XYLO-ORACLE-01 generated.')
console.log(`  address : ${acct.address}   <- this is safe to share; put it in payx/tools/.env as ORACLE_SIGNER_ADDRESS`)
console.log(`  key file: ${out}   <- open it, copy ORACLE_PRIVATE_KEY into Vercel env, then DELETE the file`)
console.log('The oracle never holds funds and never sends transactions; it only signs claims.')
