// XyloNet Mainnet — deploy Admin Safe + Treasury Safe (Arc chain 5042)
// Method: SafeProxyFactory.createProxyWithNonce with the SafeL2 singleton PINNED —
// the exact call app.safe.global makes, but with every parameter explicit and asserted.
// Idempotent: if a Safe already exists at its predicted CREATE2 address, it is skipped.
// SECURITY: prints no secrets. Only addresses, tx hashes, gas figures.

import 'dotenv/config'
import {
  createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi,
  keccak256, formatUnits, concatHex, toHex, padHex, getContractAddress, parseEventLogs,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ---- Pinned constants (all verified in preflight.mjs, byte-compared vs audited testnet copies) ----
const CHAIN_ID = 5042
const SAFE_L2_SINGLETON = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762'
const PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const FALLBACK_HANDLER = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99'
const ZERO = '0x0000000000000000000000000000000000000000'
const THRESHOLD = 2n

const factoryAbi = parseAbi([
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'function proxyCreationCode() pure returns (bytes)',
  'event ProxyCreation(address indexed proxy, address singleton)',
])
const safeAbi = parseAbi([
  'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function VERSION() view returns (string)',
])

const env = process.env
const RPC = env.ARC_MAINNET_RPC_URL.trim()
const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY.trim())
const OWNERS = [env.SIGNER_1_ADDRESS, env.SIGNER_2_ADDRESS, env.SIGNER_3_ADDRESS].map(a => a.trim().split(/\s+/)[0])

const arc = {
  id: CHAIN_ID, name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
}
const pub = createPublicClient({ chain: arc, transport: http(RPC, { timeout: 20000 }) })
const wallet = createWalletClient({ chain: arc, account, transport: http(RPC, { timeout: 20000 }) })

// Documented, reproducible salt nonces (date-based scheme, see docs/ADDRESS_BOOK.md)
const SAFES = [
  { name: 'XyloNet Admin Safe', saltNonce: 20260818001n },
  { name: 'XyloNet Treasury Safe', saltNonce: 20260818002n },
]

function buildInitializer () {
  // setup(owners, threshold=2, to=0, data=0x, fallbackHandler=CompatibilityFallbackHandler, paymentToken=0, payment=0, paymentReceiver=0)
  return encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [OWNERS, THRESHOLD, ZERO, '0x', FALLBACK_HANDLER, ZERO, 0n, ZERO],
  })
}

async function predictAddress (initializer, saltNonce) {
  const creationCode = await pub.readContract({ address: PROXY_FACTORY, abi: factoryAbi, functionName: 'proxyCreationCode' })
  // SafeProxyFactory: salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce))
  const salt = keccak256(concatHex([keccak256(initializer), padHex(toHex(saltNonce), { size: 32 })]))
  // deploymentData = proxyCreationCode ++ abi.encode(uint256(uint160(singleton)))
  const deploymentData = concatHex([creationCode, padHex(SAFE_L2_SINGLETON, { size: 32 })])
  return getContractAddress({ from: PROXY_FACTORY, opcode: 'CREATE2', salt, bytecode: deploymentData })
}

async function assertSafeState (addr, label) {
  const [owners, threshold, version, code] = await Promise.all([
    pub.readContract({ address: addr, abi: safeAbi, functionName: 'getOwners' }),
    pub.readContract({ address: addr, abi: safeAbi, functionName: 'getThreshold' }),
    pub.readContract({ address: addr, abi: safeAbi, functionName: 'VERSION' }),
    pub.getCode({ address: addr }),
  ])
  // masterCopy/singleton lives in storage slot 0 of the proxy
  const slot0 = await pub.getStorageAt({ address: addr, slot: '0x0' })
  const singleton = '0x' + slot0.slice(-40)
  const checks = [
    [version === '1.4.1', `version 1.4.1 (got ${version})`],
    [threshold === THRESHOLD, `threshold 2 (got ${threshold})`],
    [owners.length === 3, `3 owners (got ${owners.length})`],
    [OWNERS.every(o => owners.map(x => x.toLowerCase()).includes(o.toLowerCase())), 'owners match the 3 signers exactly'],
    [singleton.toLowerCase() === SAFE_L2_SINGLETON.toLowerCase(), `singleton is SafeL2 (slot0 ${singleton})`],
    [code && code !== '0x', 'proxy code present'],
  ]
  let allOk = true
  for (const [pass, desc] of checks) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}: ${desc.split(' (got')[0]}${pass ? '' : ' — ' + desc}`)
    if (!pass) allOk = false
  }
  console.log(`  info  ${label} owners: ${owners.join(', ')}`)
  return allOk
}

async function checkTxService (addr, label) {
  const url = `https://api.safe.global/tx-service/arc/api/v1/safes/${addr}/`
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0', Accept: 'application/json' }
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
      if (r.ok) { console.log(`  PASS  ${label}: indexed by Safe Transaction Service`); return true }
    } catch { /* retry */ }
    await new Promise(res => setTimeout(res, 5000))
  }
  console.log(`  WARN  ${label}: not yet visible on Transaction Service (indexer lag is normal — re-check in a few minutes)`)
  return false
}

async function main () {
  console.log('=== XyloNet Safe deployment — Arc mainnet (5042) ===\n')
  const chainId = await pub.getChainId()
  if (chainId !== CHAIN_ID) throw new Error(`RPC chainId ${chainId} != 5042 — aborting`)
  console.log(`Deployer: ${account.address}`)
  console.log(`Owners (2-of-3): ${OWNERS.join(', ')}\n`)

  const balBefore = await pub.getBalance({ address: account.address })
  const initializer = buildInitializer()
  const deployed = []

  for (const s of SAFES) {
    console.log(`--- ${s.name} (saltNonce ${s.saltNonce}) ---`)
    const predicted = await predictAddress(initializer, s.saltNonce)
    console.log(`  Predicted address: ${predicted}`)

    const existing = await pub.getCode({ address: predicted })
    if (existing && existing !== '0x') {
      console.log('  Already deployed at predicted address — skipping creation, verifying state only.')
    } else {
      // Simulate first — reverts here cost nothing
      const { result } = await pub.simulateContract({
        account, address: PROXY_FACTORY, abi: factoryAbi, functionName: 'createProxyWithNonce',
        args: [SAFE_L2_SINGLETON, initializer, s.saltNonce],
      })
      if (result.toLowerCase() !== predicted.toLowerCase()) throw new Error(`Simulation returned ${result}, predicted ${predicted} — CREATE2 mismatch, aborting`)
      console.log('  Simulation OK (returned address matches prediction). Sending…')

      const hash = await wallet.writeContract({
        address: PROXY_FACTORY, abi: factoryAbi, functionName: 'createProxyWithNonce',
        args: [SAFE_L2_SINGLETON, initializer, s.saltNonce],
      })
      console.log(`  Tx: ${hash}`)
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60000 })
      if (receipt.status !== 'success') throw new Error(`Deployment tx reverted: ${hash}`)
      const events = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: 'ProxyCreation' })
      const evAddr = events[0]?.args?.proxy
      const evSingleton = events[0]?.args?.singleton
      console.log(`  Mined in block ${receipt.blockNumber}, gasUsed ${receipt.gasUsed}`)
      if (!evAddr || evAddr.toLowerCase() !== predicted.toLowerCase()) throw new Error(`ProxyCreation event address ${evAddr} != predicted ${predicted}`)
      if (evSingleton.toLowerCase() !== SAFE_L2_SINGLETON.toLowerCase()) throw new Error(`Event singleton ${evSingleton} is not SafeL2 — CRITICAL`)
      console.log('  Event checks OK (address + SafeL2 singleton confirmed).')
    }

    const stateOk = await assertSafeState(predicted, s.name)
    if (!stateOk) throw new Error(`${s.name}: on-chain state verification FAILED`)
    await checkTxService(predicted, s.name)
    deployed.push({ ...s, address: predicted })
    console.log()
  }

  const balAfter = await pub.getBalance({ address: account.address })
  console.log('=== SUMMARY ===')
  for (const d of deployed) console.log(`${d.name}: ${d.address} (saltNonce ${d.saltNonce})`)
  console.log(`Total gas cost: ${formatUnits(balBefore - balAfter, 18)} USDC`)
  console.log(`Deployer balance: ${formatUnits(balAfter, 18)} USDC`)
}

main().catch(e => { console.error('\nDEPLOY ABORTED:', e.message); process.exit(1) })
