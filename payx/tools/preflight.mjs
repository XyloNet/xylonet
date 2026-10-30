// Runbook pre-flight (read-only). Every line must PASS before `npm run deploy`.
import { formatUnits, getAddress, isAddress } from 'viem'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { publicClient, deployerAccount, artifact, check, summary, USDC, ADMIN_SAFE, TREASURY_SAFE, DEPLOYER, CHAIN_ID, ERC20_ABI, native } from './common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SAFE_ABI = [
  { type: 'function', name: 'getOwners', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { type: 'function', name: 'getThreshold', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'nonce', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
]

console.log('PayX v2 — mainnet pre-flight\n')
const c = publicClient()

// 1. chain
const chainId = await c.getChainId()
check(chainId === CHAIN_ID, `RPC chainId == ${CHAIN_ID}`, String(chainId))
const block = await c.getBlockNumber()
check(block > 0n, 'RPC serving blocks', block.toString())
const gp = await c.getGasPrice()
check(gp > 0n, 'gas price readable', `${formatUnits(gp, 9)} gwei`)

// 2. USDC predeploy
const dec = await c.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'decimals' })
check(dec === 6, 'USDC 0x3600… decimals == 6', String(dec))

// 3. Safes
for (const [label, addr, wantNonceAtLeast] of [['Admin Safe', ADMIN_SAFE, 1n], ['Treasury Safe', TREASURY_SAFE, 1n]]) {
  const code = await c.getCode({ address: addr })
  check(!!code && code.length > 2, `${label} has code`)
  const owners = await c.readContract({ address: addr, abi: SAFE_ABI, functionName: 'getOwners' })
  const th = await c.readContract({ address: addr, abi: SAFE_ABI, functionName: 'getThreshold' })
  const nonce = await c.readContract({ address: addr, abi: SAFE_ABI, functionName: 'nonce' })
  check(owners.length === 3 && th === 2n, `${label} is 3 owners / threshold 2`, `${owners.length}/${th}`)
  check(nonce >= wantNonceAtLeast, `${label} rehearsed (nonce ≥ ${wantNonceAtLeast})`, `nonce ${nonce}`)
}

// 4. Oracle
const oracle = process.env.ORACLE_SIGNER_ADDRESS
check(!!oracle && isAddress(oracle), 'ORACLE_SIGNER_ADDRESS set + valid', oracle ? getAddress(oracle) : 'missing')
if (oracle && isAddress(oracle)) {
  const ocode = await c.getCode({ address: oracle })
  check(!ocode || ocode === '0x', 'oracle is an EOA (no code)')
  check(getAddress(oracle) !== getAddress(DEPLOYER), 'oracle != deployer')
  check(getAddress(oracle) !== getAddress(ADMIN_SAFE) && getAddress(oracle) !== getAddress(TREASURY_SAFE), 'oracle != a Safe')
}

// 5. Deployer
const deployer = deployerAccount()
check(getAddress(deployer.address) === getAddress(DEPLOYER), 'deployer key == XYLO-DEPLOYER-01')
const bal = await c.getBalance({ address: deployer.address })
check(bal >= 5n * 10n ** 18n, 'deployer balance ≥ 5 USDC', native(bal))
const dn = await c.getTransactionCount({ address: deployer.address })
console.log(`         deployer nonce ${dn}`)

// 6. Build freshness + tests
const art = artifact()
const compiler = JSON.parse(art.rawMetadata).compiler.version
check(compiler.startsWith('0.8.30'), 'artifact compiled with solc 0.8.30', compiler)
const settings = JSON.parse(art.rawMetadata).settings
check(settings.optimizer?.enabled === true && settings.optimizer?.runs === 200, 'optimizer enabled, 200 runs')
try {
  const out = execSync('forge test --no-match-path "test/*fork*" --json', { cwd: resolve(__dirname, '../contracts'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
  const suites = JSON.parse(out)
  let passed = 0
  let failed = 0
  for (const s of Object.values(suites)) for (const t of Object.values(s.test_results || {})) (t.status === 'Success' ? passed++ : failed++)
  check(passed > 0 && failed === 0, 'forge test green at this commit', `${passed} passed, ${failed} failed`)
} catch (e) {
  check(false, 'forge test green at this commit', String(e.stdout || e.message).slice(-300))
}
try {
  const rev = execSync('git rev-parse --short HEAD', { cwd: resolve(__dirname, '../..'), encoding: 'utf8' }).trim()
  const dirty = execSync('git status --porcelain -- payx/contracts/src payx/contracts/script', { cwd: resolve(__dirname, '../..'), encoding: 'utf8' }).trim()
  console.log(`         commit ${rev}${dirty ? '  (WARNING: contract sources uncommitted)' : ''}`)
} catch { console.log('         (git commit not available — commit before deploying)') }

// 7. Constructor args echo
console.log('\n  Constructor args that deploy.mjs will use:')
console.log(`    usdc         ${USDC}`)
console.log(`    oracleSigner ${oracle ? getAddress(oracle) : '(missing)'}`)
console.log(`    feeRecipient ${TREASURY_SAFE}  (Treasury Safe)`)
console.log(`    fee bps      100  (1%)`)
console.log(`    minTip       100000  (0.1 USDC)`)

summary('PRE-FLIGHT')
