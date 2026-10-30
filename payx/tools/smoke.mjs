// Runbook step 3 — real-money smoke test on Arc mainnet (≈1 USDC + dust gas):
//   deployer: approve 1 USDC → tip(SMOKE_HANDLE, 1 USDC, "mainnet smoke")
//   oracle  : EIP-712 signClaim (same code path as the web API)  [needs ORACLE_PRIVATE_KEY in payx/tools/.env]
//   claimer : SMOKE_CLAIM_WALLET receives 0.99 USDC via claimTips, sent by the deployer on its behalf?  NO —
//             claimTips can be called by anyone; the USDC goes to `wallet`. So the deployer submits
//             claimTips(handle, SMOKE_CLAIM_WALLET, nonce, sig) and SMOKE_CLAIM_WALLET receives 0.99 USDC.
// This proves the whole loop against real Arc USDC (which cannot be simulated locally).
import { getAddress, isAddress, parseUnits } from 'viem'
import { randomBytes } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { publicClient, walletClient, deployerAccount, payxAddress, PAYX_ABI, ERC20_ABI, USDC, CHAIN_ID, check, summary, fail, usdc6, short } from './common.mjs'

const handleRaw = process.env.SMOKE_HANDLE || 'PanchU2605'
const claimWallet = process.env.SMOKE_CLAIM_WALLET
const oraclePk = process.env.ORACLE_PRIVATE_KEY
if (!claimWallet || !isAddress(claimWallet)) fail('SMOKE_CLAIM_WALLET missing/invalid')
if (!oraclePk) fail('ORACLE_PRIVATE_KEY missing (temporarily needed here for the smoke test; delete after)')
const oracle = privateKeyToAccount(oraclePk)
const handle = handleRaw.replace(/^@/, '').toLowerCase()
if (!/^[a-z0-9_]{1,15}$/.test(handle)) fail('SMOKE_HANDLE invalid')

const c = publicClient()
const addr = payxAddress()
const deployer = deployerAccount()
const w = walletClient(deployer)
const AMOUNT = parseUnits('1', 6)
console.log(`Smoke test on ${addr} — tip @${handle} 1 USDC, claim to ${getAddress(claimWallet)}\n`)

const onchainOracle = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'oracleSigner' })
check(getAddress(onchainOracle) === getAddress(oracle.address), 'local ORACLE_PRIVATE_KEY matches on-chain oracleSigner', oracle.address)
if (getAddress(onchainOracle) !== getAddress(oracle.address)) summary('SMOKE')

const info0 = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'getHandleInfo', args: [handle] })
const claimBal0 = await c.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [getAddress(claimWallet)] })
console.log(`  before: pending ${usdc6(info0.pendingBalance)}, claimer ${usdc6(claimBal0)}`)

async function send(label, req) {
  const { request } = await c.simulateContract({ account: deployer, ...req }).catch((e) => {
    fail(`${label} simulation failed: ${e.shortMessage || e.message}`)
  })
  const hash = await w.writeContract(request)
  const r = await c.waitForTransactionReceipt({ hash, timeout: 120_000 })
  check(r.status === 'success', `${label} tx success`, `${short(hash)} block ${r.blockNumber}`)
  return hash
}

// 1. approve exact
const allowance = await c.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'allowance', args: [deployer.address, addr] })
if (allowance < AMOUNT) await send('approve 1 USDC', { address: USDC, abi: ERC20_ABI, functionName: 'approve', args: [addr, AMOUNT] })
else console.log('  allowance already sufficient')

// 2. tip
const tipHash = await send('tip', { address: addr, abi: PAYX_ABI, functionName: 'tip', args: [handle, AMOUNT, 'mainnet smoke test'] })
const info1 = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'getHandleInfo', args: [handle] })
const expectedNet = AMOUNT - AMOUNT / 100n
check(info1.pendingBalance === info0.pendingBalance + expectedNet, 'pendingBalance += 0.99 USDC', usdc6(info1.pendingBalance))
const fees = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'totalFeesCollected' })
check(fees >= AMOUNT / 100n, 'fee accrued (0.01 USDC)', usdc6(fees))

// 3. oracle EIP-712 signature — identical to web/src/lib/payx/oracle.ts
const nonce = `0x${randomBytes(32).toString('hex')}`
const signature = await oracle.signTypedData({
  domain: { name: 'PayX', version: '2', chainId: CHAIN_ID, verifyingContract: addr },
  types: { Claim: [{ name: 'handle', type: 'string' }, { name: 'wallet', type: 'address' }, { name: 'nonce', type: 'bytes32' }] },
  primaryType: 'Claim',
  message: { handle, wallet: getAddress(claimWallet), nonce },
})
console.log(`  oracle signature ${short(signature)} nonce ${short(nonce)}`)

// 4. claim (deployer submits; funds go to claimWallet). If the handle is already registered to a
//    different wallet this reverts WalletMismatch — use that wallet as SMOKE_CLAIM_WALLET instead.
const claimHash = await send('claimTips', { address: addr, abi: PAYX_ABI, functionName: 'claimTips', args: [handle, getAddress(claimWallet), nonce, signature] })
const info2 = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'getHandleInfo', args: [handle] })
const claimBal1 = await c.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [getAddress(claimWallet)] })
check(info2.pendingBalance === 0n, 'pendingBalance == 0 after claim')
check(claimBal1 - claimBal0 === info1.pendingBalance, 'claimer received the full pending balance', usdc6(claimBal1 - claimBal0))
check(getAddress(info2.linkedWallet) === getAddress(claimWallet) && info2.isRegistered, 'handle linked to claim wallet')
const used = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'usedNonces', args: [nonce] })
check(used === true, 'nonce marked used')

console.log(`\n  tip tx   ${tipHash}\n  claim tx ${claimHash}`)
console.log('  NOTE: @' + handle + ' is now permanently linked to ' + getAddress(claimWallet) + ' (future claims must use it; relink = Safe ceremony).')
summary('SMOKE')
