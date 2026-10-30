// Read-only status of the deployed PayX v2 (safe to run any time).
import { publicClient, payxAddress, PAYX_ABI, ERC20_ABI, USDC, ADMIN_SAFE, TREASURY_SAFE, usdc6, native } from './common.mjs'
import { getAddress } from 'viem'

const c = publicClient()
const addr = payxAddress()
const r = (fn, args = []) => c.readContract({ address: addr, abi: PAYX_ABI, functionName: fn, args })
const [owner, pending, oracle, guardian, feeRecipient, feeBps, minTip, paused, totalPending, fees] = await Promise.all([
  r('owner'), r('pendingOwner'), r('oracleSigner'), r('guardian'), r('feeRecipient'), r('platformFeeBps'), r('minTipAmount'), r('paused'), r('totalPending'), r('totalFeesCollected'),
])
const bal = await c.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] })
console.log(`PayX v2 ${addr} (chain ${await c.getChainId()}, block ${await c.getBlockNumber()})`)
console.log(`  owner         ${owner} ${getAddress(owner) === getAddress(ADMIN_SAFE) ? '(Admin Safe ✓)' : '(NOT the Admin Safe)'}`)
console.log(`  pendingOwner  ${pending}`)
console.log(`  oracleSigner  ${oracle}`)
console.log(`  guardian      ${guardian}`)
console.log(`  feeRecipient  ${feeRecipient} ${getAddress(feeRecipient) === getAddress(TREASURY_SAFE) ? '(Treasury Safe ✓)' : '(NOT the Treasury Safe)'}`)
console.log(`  fee / minTip  ${feeBps} bps / ${usdc6(minTip)}`)
console.log(`  paused        ${paused}`)
console.log(`  escrow        ${usdc6(totalPending)}   fees ${usdc6(fees)}   contract USDC balance ${usdc6(bal)}`)
const ok = bal >= totalPending + fees
console.log(`  solvency      balance ≥ escrow + fees: ${ok ? 'OK' : 'VIOLATED — investigate'}`)
console.log(`  Treasury Safe native balance ${native(await c.getBalance({ address: TREASURY_SAFE }))}`)
