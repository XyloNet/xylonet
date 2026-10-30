// Runbook step 2 — assert the deployed contract matches the local build and pinned config.
import { getAddress, keccak256 } from 'viem'
import { publicClient, payxAddress, artifact, PAYX_ABI, check, summary, USDC, TREASURY_SAFE, ADMIN_SAFE, DEPLOYER, EXPECTED_FEE_BPS, EXPECTED_MIN_TIP } from './common.mjs'
// Non-USDC instances: EXPECTED_TOKEN=<token> EXPECTED_MIN_TIP=<raw units> PAYX_ADDRESS_OVERRIDE=<instance>
const EXPECT_TOKEN = process.env.EXPECTED_TOKEN || USDC
const EXPECT_MIN_TIP = process.env.EXPECTED_MIN_TIP ? BigInt(process.env.EXPECTED_MIN_TIP) : EXPECTED_MIN_TIP

const c = publicClient()
const addr = payxAddress()
const art = artifact()
console.log(`PayX v2 post-deploy assertions — ${addr}\n`)

const read = (fn, args = []) => c.readContract({ address: addr, abi: PAYX_ABI, functionName: fn, args })

// bytecode: mask immutable slots in both local + on-chain, then compare hashes
const code = await c.getCode({ address: addr })
check(!!code && code.length > 2, 'contract has code', `${(code.length - 2) / 2} bytes`)
const local = art.deployedBytecode.object.toLowerCase()
const refs = Object.values(art.deployedBytecode.immutableReferences || {}).flat()
function mask(hex) {
  let b = hex.startsWith('0x') ? hex.slice(2) : hex
  for (const { start, length } of refs) b = b.slice(0, start * 2) + '0'.repeat(length * 2) + b.slice((start + length) * 2)
  return '0x' + b
}
// strip CBOR metadata tail (last 2 bytes encode its length) so a re-compile with a different path/hash still matches logic
function stripMeta(hex) {
  const b = hex.slice(2)
  const len = parseInt(b.slice(-4), 16)
  return '0x' + b.slice(0, b.length - (len + 2) * 2)
}
const onchainMasked = mask(code.toLowerCase())
const localMasked = mask(local)
check(onchainMasked.length === localMasked.length, 'runtime bytecode length matches local build')
check(keccak256(stripMeta(onchainMasked)) === keccak256(stripMeta(localMasked)), 'runtime bytecode (immutables masked, metadata stripped) matches local build')

// config
const [owner, pending, oracle, guardian, feeRecipient, feeBps, minTip, paused, usdc, totalPending, fees] = await Promise.all([
  read('owner'), read('pendingOwner'), read('oracleSigner'), read('guardian'), read('feeRecipient'), read('platformFeeBps'), read('minTipAmount'), read('paused'), read('usdc'), read('totalPending'), read('totalFeesCollected'),
])
const expectOracle = process.env.ORACLE_SIGNER_ADDRESS
check(getAddress(usdc) === getAddress(EXPECT_TOKEN), `escrow token == ${EXPECT_TOKEN}`, usdc)
check(!!expectOracle && getAddress(oracle) === getAddress(expectOracle), 'oracleSigner == XYLO-ORACLE-01', oracle)
check(getAddress(feeRecipient) === getAddress(TREASURY_SAFE), 'feeRecipient == Treasury Safe', feeRecipient)
check(feeBps === EXPECTED_FEE_BPS, 'platformFeeBps == 100', String(feeBps))
check(minTip === EXPECT_MIN_TIP, `minTipAmount == ${EXPECT_MIN_TIP}`, String(minTip))
check(paused === false, 'not paused')
check(guardian === '0x0000000000000000000000000000000000000000', 'guardian unset (set via Safe later)', guardian)
check(totalPending === 0n && fees === 0n, 'escrow + fees start at 0')
const ownerIsDeployer = getAddress(owner) === getAddress(DEPLOYER)
const ownerIsSafe = getAddress(owner) === getAddress(ADMIN_SAFE)
check(ownerIsDeployer || ownerIsSafe, 'owner is deployer (pre-handover) or Admin Safe (post-handover)', owner)
console.log(`         pendingOwner ${pending}`)
const ds = await read('domainSeparator')
console.log(`         EIP-712 domainSeparator ${ds}`)

summary('POST-DEPLOY')
