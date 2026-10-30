// XyloNet Mainnet — Safe deployment PRE-FLIGHT (read-only, sends nothing)
// Verifies: .env sanity, RPC endpoints, chain IDs, deployer wallet, signer wallets,
// canonical Safe v1.4.1 contracts (incl. cross-chain bytecode comparison vs Arc testnet),
// USDC predeploy, and Safe Transaction Service availability.
// SECURITY: never prints private keys or credentialed RPC URLs — hostnames and addresses only.

import 'dotenv/config'
import { createPublicClient, http, formatUnits, getAddress, isAddress, keccak256, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const results = []
let failures = 0
let warnings = 0
const ok = (name, detail = '') => { results.push(`  PASS  ${name}${detail ? ' — ' + detail : ''}`) }
const fail = (name, detail = '') => { failures++; results.push(`X FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
const warn = (name, detail = '') => { warnings++; results.push(`! WARN  ${name}${detail ? ' — ' + detail : ''}`) }

// ---- Expected constants (verified on-chain 2026-08-04, memory: arc-mainnet-verified-facts) ----
const CHAIN_ID_MAINNET = 5042n
const CHAIN_ID_TESTNET = 5042002n
const TESTNET_RPC = 'https://rpc.testnet.arc.network'
const USDC = '0x3600000000000000000000000000000000000000'
const EXPECTED_DEPLOYER = '0xCb4d137f4057cD522093aF706fe2f771F74DFC00'
const OLD_BURNED_EOA = '0x94e0dc7AD29b94EC9819f6cEC3364DD34f41b3c6'
const BLOCKLIST_TEST_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

// Canonical Safe v1.4.1 deployment addresses (same on all canonical chains)
const SAFE_CONTRACTS = {
  SafeL2_singleton:            '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762',
  SafeProxyFactory:            '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
  CompatibilityFallbackHandler:'0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
  MultiSend:                   '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
  MultiSendCallOnly:           '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
  Safe_L1_singleton:           '0x41675C099F32341bf84BFc5382aF534df5C7461a',
  SignMessageLib:              '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
  CreateCall:                  '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
  SimulateTxAccessor:          '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
}
// The three that matter most get byte-for-byte comparison against Arc testnet
// (testnet copies were independently verified in the 2026-07-18 audit)
const BYTECODE_COMPARE = ['SafeL2_singleton', 'SafeProxyFactory', 'CompatibilityFallbackHandler']

// Signer addresses as pasted by Panchu in chat 2026-08-18 (cross-check vs .env)
const CHAT_SIGNERS = {
  SIGNER_1: { addr: '0xdF06689771B15911e5197191d378381A1F5B8724', label: 'Panchu' },
  SIGNER_2: { addr: '0xEe5395960fA7fbb8eEEd4437De012B29dFe65A68', label: 'CarbZ' },
  SIGNER_3: { addr: '0x39e5633988d95973da3024f13416282eaa784a6b', label: 'BMS' },
}

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
])

const maskHost = (url) => { try { return new URL(url).host } catch { return '<unparseable URL>' } }

async function main () {
  console.log('=== XyloNet Mainnet Safe PRE-FLIGHT ===\n')

  // ---------- 1. .env sanity ----------
  const env = process.env
  const rpcUrl = (env.ARC_MAINNET_RPC_URL || '').trim()
  const rpcFallback = (env.ARC_MAINNET_RPC_FALLBACK || '').trim()
  const pk = (env.DEPLOYER_PRIVATE_KEY || '').trim()

  if (!rpcUrl) fail('.env ARC_MAINNET_RPC_URL', 'missing/empty')
  else ok('.env ARC_MAINNET_RPC_URL set', `host: ${maskHost(rpcUrl)}`)
  if (!rpcFallback) warn('.env ARC_MAINNET_RPC_FALLBACK', 'missing/empty (fallback recommended)')
  else ok('.env ARC_MAINNET_RPC_FALLBACK set', `host: ${maskHost(rpcFallback)}`)

  let account = null
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    fail('.env DEPLOYER_PRIVATE_KEY', `expected 0x + 64 hex chars, got length ${pk.length}${pk && !pk.startsWith('0x') ? ' (missing 0x prefix?)' : ''}`)
  } else {
    account = privateKeyToAccount(pk)
    ok('.env DEPLOYER_PRIVATE_KEY format valid', `derives to ${account.address}`)
  }

  // Signers from .env — strip any inline junk, validate, cross-check vs chat
  const signers = {}
  for (const key of ['SIGNER_1_ADDRESS', 'SIGNER_2_ADDRESS', 'SIGNER_3_ADDRESS']) {
    const raw = (env[key] || '').trim().split(/\s+/)[0]
    const short = key.replace('_ADDRESS', '')
    if (!raw) { fail(`.env ${key}`, 'missing/empty'); continue }
    if (!isAddress(raw, { strict: false })) { fail(`.env ${key}`, `not a valid address: "${raw}"`); continue }
    // If mixed-case, enforce EIP-55 checksum (a bad checksum = likely transcription corruption)
    const isMixed = raw !== raw.toLowerCase() && raw.slice(2) !== raw.slice(2).toUpperCase()
    if (isMixed) {
      try { getAddress(raw) } catch {
        fail(`.env ${key} EIP-55 checksum`, `${raw} fails checksum — re-copy the address from the wallet app`)
        continue
      }
    }
    const checksummed = getAddress(raw.toLowerCase())
    signers[short] = { addr: checksummed, label: CHAT_SIGNERS[short].label }
    const chatAddr = CHAT_SIGNERS[short].addr.toLowerCase()
    if (raw.toLowerCase() === chatAddr) ok(`${short} (.env) matches chat-pasted address`, `${checksummed} [${CHAT_SIGNERS[short].label}]`)
    else fail(`${short} (.env) vs chat mismatch`, `.env has ${checksummed}, chat had ${CHAT_SIGNERS[short].addr}`)
  }

  // Distinctness & danger-address checks
  const addrs = Object.values(signers).map(s => s.addr.toLowerCase())
  if (new Set(addrs).size === addrs.length && addrs.length === 3) ok('All 3 signer addresses are distinct')
  else fail('Signer distinctness', 'duplicate or missing signer addresses')
  for (const [k, s] of Object.entries(signers)) {
    if (s.addr.toLowerCase() === OLD_BURNED_EOA.toLowerCase()) fail(`${k} is the OLD burned testnet EOA`, 'must never be reused')
    if (s.addr.toLowerCase() === BLOCKLIST_TEST_ADDR.toLowerCase()) fail(`${k} is the known blocklist test address`)
    if (account && s.addr.toLowerCase() === account.address.toLowerCase()) fail(`${k} equals the deployer`, 'signers must be separate from deployer')
  }

  if (failures > 0) { report(); process.exit(1) } // no point hitting RPC with a broken .env

  // ---------- 2. RPC endpoints & chain IDs ----------
  const mainnet = createPublicClient({ transport: http(rpcUrl, { timeout: 15000 }) })
  let fallbackClient = null

  let chainId
  try {
    chainId = await mainnet.getChainId()
    if (BigInt(chainId) === CHAIN_ID_MAINNET) ok('Primary RPC chainId', `${chainId} (Arc mainnet)`)
    else fail('Primary RPC chainId', `expected 5042, got ${chainId} — WRONG NETWORK`)
  } catch (e) { fail('Primary RPC unreachable', e.shortMessage || e.message) }

  if (rpcFallback) {
    try {
      fallbackClient = createPublicClient({ transport: http(rpcFallback, { timeout: 15000 }) })
      const fbId = await fallbackClient.getChainId()
      if (BigInt(fbId) === CHAIN_ID_MAINNET) ok('Fallback RPC chainId', `${fbId} (Arc mainnet)`)
      else fail('Fallback RPC chainId', `expected 5042, got ${fbId} — WRONG NETWORK`)
    } catch (e) { warn('Fallback RPC unreachable', e.shortMessage || e.message) }
  }

  let block
  try {
    block = await mainnet.getBlock()
    const ageSec = Math.abs(Number(BigInt(Math.floor(Date.now() / 1000)) - block.timestamp))
    if (ageSec < 120) ok('Chain is live', `head block ${block.number}, ${ageSec}s old`)
    else warn('Head block age', `${ageSec}s — RPC may be lagging`)
  } catch (e) { fail('getBlock failed', e.shortMessage || e.message) }

  // Primary/fallback consistency: same chain, comparable height
  if (fallbackClient) {
    try {
      const fbBlock = await fallbackClient.getBlockNumber()
      const diff = block ? (fbBlock > block.number ? fbBlock - block.number : block.number - fbBlock) : null
      if (diff !== null && diff < 50n) ok('Primary/fallback height agreement', `Δ ${diff} blocks`)
      else warn('Primary/fallback height divergence', `Δ ${diff} blocks`)
    } catch { /* already warned above */ }
  }

  if (failures > 0) { report(); process.exit(1) } // wrong network → stop immediately

  // ---------- 3. Deployer wallet ----------
  const dep = account.address
  if (dep.toLowerCase() === EXPECTED_DEPLOYER.toLowerCase()) ok('Deployer matches expected funded wallet', dep)
  else warn('Deployer differs from expected wallet', `derived ${dep}, expected ${EXPECTED_DEPLOYER} — confirm intentional`)
  if (dep.toLowerCase() === OLD_BURNED_EOA.toLowerCase()) fail('Deployer is the OLD burned EOA', 'must never be reused')

  const [depBalNative, depNonce, depCode, usdcDecimals] = await Promise.all([
    mainnet.getBalance({ address: dep }),
    mainnet.getTransactionCount({ address: dep }),
    mainnet.getCode({ address: dep }),
    mainnet.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }),
  ])
  const depUsdcErc20 = await mainnet.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [dep] })
  if (!depCode || depCode === '0x') ok('Deployer is an EOA (no code)')
  else fail('Deployer has contract code', 'expected an EOA')
  if (usdcDecimals === 6) ok('USDC predeploy decimals', '6')
  else fail('USDC decimals unexpected', String(usdcDecimals))
  const depNative = Number(formatUnits(depBalNative, 18))
  const depErc20 = Number(formatUnits(depUsdcErc20, 6))
  if (Math.abs(depNative - depErc20) < 0.000001) ok('Deployer native/ERC-20 balance views agree', `${depErc20} USDC`)
  else warn('Deployer balance views differ', `native ${depNative} vs ERC-20 ${depErc20}`)
  if (depErc20 >= 10) ok('Deployer balance sufficient', `${depErc20} USDC (Safe creation ≈ 0.01 USDC each)`)
  else if (depErc20 >= 1) warn('Deployer balance low', `${depErc20} USDC — enough for Safes, top up before contract deploys`)
  else fail('Deployer balance too low', `${depErc20} USDC`)
  ok('Deployer nonce', `${depNonce}${depNonce >= 3 ? ' (consistent with 3 funding transfers sent)' : ''}`)

  // ---------- 4. Signer wallets ----------
  for (const [k, s] of Object.entries(signers)) {
    const [bal, nonce, code] = await Promise.all([
      mainnet.getBalance({ address: s.addr }),
      mainnet.getTransactionCount({ address: s.addr }),
      mainnet.getCode({ address: s.addr }),
    ])
    const erc20 = await mainnet.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [s.addr] })
    const balN = Number(formatUnits(bal, 18))
    const balE = Number(formatUnits(erc20, 6))
    const tag = `${k} [${s.label}] ${s.addr}`
    if (!code || code === '0x') ok(`${tag} is an EOA`)
    else fail(`${tag} has contract code`, 'signer must be a plain EOA')
    if (nonce === 0) ok(`${tag} nonce 0 (fresh, never sent a tx)`)
    else warn(`${tag} nonce ${nonce}`, 'wallet has history — confirm it is genuinely dedicated/fresh')
    if (balE >= 1.9) ok(`${tag} funded`, `${balE} USDC — the 2 USDC transfer arrived; address provably matches where funds were sent`)
    else if (balE > 0) warn(`${tag} balance ${balE} USDC`, 'expected ~2 — partial/fee? confirm')
    else fail(`${tag} balance 0`, 'funding transfer NOT received — wrong address or transfer not sent')
    if (Math.abs(balN - balE) >= 0.000001) warn(`${tag} native/ERC-20 views differ`, `${balN} vs ${balE}`)
  }

  // ---------- 5. Canonical Safe v1.4.1 contracts on mainnet ----------
  for (const [name, addr] of Object.entries(SAFE_CONTRACTS)) {
    const code = await mainnet.getCode({ address: addr })
    if (code && code !== '0x') ok(`Safe contract deployed: ${name}`, `${addr} (${(code.length - 2) / 2} bytes)`)
    else fail(`Safe contract MISSING: ${name}`, addr)
  }

  // ---------- 6. Byte-for-byte comparison vs Arc testnet (independently audited 2026-07-18) ----------
  try {
    const testnet = createPublicClient({ transport: http(TESTNET_RPC, { timeout: 15000 }) })
    const tId = await testnet.getChainId()
    if (BigInt(tId) !== CHAIN_ID_TESTNET) warn('Testnet RPC chainId unexpected', String(tId))
    for (const name of BYTECODE_COMPARE) {
      const addr = SAFE_CONTRACTS[name]
      const [mCode, tCode] = await Promise.all([
        mainnet.getCode({ address: addr }),
        testnet.getCode({ address: addr }),
      ])
      if (mCode && mCode === tCode) ok(`Bytecode identical mainnet↔testnet: ${name}`, `keccak256 ${keccak256(mCode).slice(0, 18)}…`)
      else fail(`Bytecode MISMATCH mainnet↔testnet: ${name}`, 'do not deploy until explained')
    }
  } catch (e) { warn('Testnet comparison skipped', `testnet RPC unreachable: ${e.shortMessage || e.message}`) }

  // ---------- 7. Safe Transaction Service + Client Gateway ----------
  try {
    const r = await fetch('https://api.safe.global/tx-service/arc/api/v1/about/', { signal: AbortSignal.timeout(15000) })
    if (r.ok) { const j = await r.json(); ok('Safe Transaction Service (arc) live', `${j.name ?? 'ok'} v${j.version ?? '?'}`) }
    else fail('Safe Transaction Service (arc)', `HTTP ${r.status}`)
  } catch (e) { fail('Safe Transaction Service (arc) unreachable', e.message) }
  try {
    const r = await fetch('https://safe-client.safe.global/v1/chains/5042', { signal: AbortSignal.timeout(15000) })
    if (r.ok) {
      const j = await r.json()
      const flags = (j.features || []).join(',')
      ok('Safe Client Gateway serves chain 5042', `${j.chainName ?? '?'}, isTestnet=${j.isTestnet}, native=${j.nativeCurrency?.symbol}`)
      if (j.isTestnet === false) ok('Gateway marks Arc as production')
      else warn('Gateway isTestnet flag', String(j.isTestnet))
      console.log(`  info  Gateway feature flags: ${flags || '(none listed)'}`)
    } else fail('Safe Client Gateway chain 5042', `HTTP ${r.status}`)
  } catch (e) { fail('Safe Client Gateway unreachable', e.message) }

  report()
  process.exit(failures > 0 ? 1 : 0)
}

function report () {
  console.log('\n=== RESULTS ===')
  for (const line of results) console.log(line)
  console.log(`\n${failures} failure(s), ${warnings} warning(s)`)
  console.log(failures === 0 ? (warnings === 0 ? '\nVERDICT: GO — all checks green.' : '\nVERDICT: GO WITH WARNINGS — review warnings above.') : '\nVERDICT: NO-GO — resolve failures before deploying.')
}

main().catch(e => { console.error('PREFLIGHT CRASHED:', e.message); process.exit(2) })
