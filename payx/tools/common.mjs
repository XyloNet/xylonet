// Shared helpers for the PayX v2 mainnet ceremony scripts.
// Loads ../../safe/.env (RPC + deployer) then ./.env (ceremony values). Never prints secrets.
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, formatUnits, getAddress, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '../../safe/.env') })
loadEnv({ path: resolve(__dirname, '.env'), override: true })

export const CHAIN_ID = 5042
export const USDC = '0x3600000000000000000000000000000000000000'
export const ADMIN_SAFE = '0xFD3A6DEE167C9B519fE7f646F91e9D80ba51Ed96'
export const TREASURY_SAFE = '0x7EF8Aa263E3Bb8a151702108bD29932e50409990'
export const DEPLOYER = '0xCb4d137f4057cD522093aF706fe2f771F74DFC00'
export const EXPECTED_FEE_BPS = 100n
export const EXPECTED_MIN_TIP = 100000n

export const arc = {
  id: CHAIN_ID,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_MAINNET_RPC_URL || ''] } },
}

export function rpcUrl() {
  const u = process.env.ARC_MAINNET_RPC_URL
  if (!u) fail('ARC_MAINNET_RPC_URL missing (safe/.env or payx/tools/.env)')
  return u
}

export function publicClient() {
  return createPublicClient({ chain: arc, transport: http(rpcUrl(), { timeout: 30_000 }) })
}

export function deployerAccount() {
  const k = process.env.DEPLOYER_PRIVATE_KEY
  if (!k) fail('DEPLOYER_PRIVATE_KEY missing')
  const acct = privateKeyToAccount(k.startsWith('0x') ? k : `0x${k}`)
  if (getAddress(acct.address) !== getAddress(DEPLOYER)) fail(`DEPLOYER_PRIVATE_KEY does not match XYLO-DEPLOYER-01 (${DEPLOYER})`)
  return acct
}

export function walletClient(account) {
  return createWalletClient({ account, chain: arc, transport: http(rpcUrl(), { timeout: 30_000 }) })
}

export function artifact(name = 'PayXTipping') {
  const p = resolve(__dirname, `../contracts/out/${name}.sol/${name}.json`)
  if (!existsSync(p)) fail(`artifact missing: ${p} — run \`forge build\` in payx/contracts`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

export const PAYX_ABI = artifact().abi

export const ERC20_ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
]

export function payxAddress() {
  const a = process.env.PAYX_ADDRESS_OVERRIDE || process.env.PAYX_ADDRESS
  if (!a || !isAddress(a)) fail('PAYX_ADDRESS missing/invalid in payx/tools/.env')
  return getAddress(a)
}

export const usdc6 = (v) => `${formatUnits(v, 6)} USDC`
export const native = (v) => `${formatUnits(v, 18)} USDC`

let failures = 0
export function check(ok, label, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL'
  if (!ok) failures += 1
  console.log(`  [${mark}] ${label}${detail ? ' — ' + detail : ''}`)
  return ok
}
export function summary(title) {
  console.log(`\n${title}: ${failures === 0 ? 'ALL GREEN' : failures + ' FAILURE(S)'}`)
  if (failures > 0) process.exit(1)
}
export function fail(msg) {
  console.error(`\nABORT: ${msg}`)
  process.exit(1)
}
export const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '')
