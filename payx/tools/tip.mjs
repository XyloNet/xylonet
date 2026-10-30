// Send one tip from XYLO-DEPLOYER-01 on the live PayX v2 (no claim).
//   node tip.mjs <handle> <amountUSDC> "<message>"
// Used for the first-ever mainnet tip. The recipient claims it themselves via X login.
import { getAddress, parseUnits } from 'viem'
import { publicClient, walletClient, deployerAccount, payxAddress, PAYX_ABI, ERC20_ABI, USDC, check, summary, fail, usdc6, short } from './common.mjs'

const [, , handleRaw, amountRaw, message = ''] = process.argv
if (!handleRaw || !amountRaw) fail('usage: node tip.mjs <handle> <amountUSDC> "<message>"')
const handle = handleRaw.replace(/^@/, '').toLowerCase()
if (!/^[a-z0-9_]{1,15}$/.test(handle)) fail('invalid handle')
const amount = parseUnits(amountRaw, 6)
const msgBytes = Buffer.byteLength(message, 'utf8')
if (msgBytes > 280) fail(`message is ${msgBytes} bytes (max 280)`)

const c = publicClient()
const addr = payxAddress()
const deployer = deployerAccount()
const w = walletClient(deployer)

const minTip = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'minTipAmount' })
if (amount < minTip) fail(`amount below minTip ${usdc6(minTip)}`)
const feeBps = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'platformFeeBps' })
const fee = (amount * feeBps) / 10000n
console.log(`Tip @${handle}: ${usdc6(amount)} (fee ${usdc6(fee)}, recipient gets ${usdc6(amount - fee)}), message ${msgBytes} bytes`)
console.log(`  "${message}"`)

const before = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'getHandleInfo', args: [handle] })

async function send(label, req) {
  const { request } = await c.simulateContract({ account: deployer, ...req }).catch((e) => fail(`${label} simulation failed: ${e.shortMessage || e.message}`))
  const hash = await w.writeContract(request)
  const r = await c.waitForTransactionReceipt({ hash, timeout: 120_000 })
  check(r.status === 'success', `${label} tx success`, `${hash} block ${r.blockNumber}`)
  return hash
}

const allowance = await c.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'allowance', args: [deployer.address, addr] })
if (allowance < amount) await send('approve', { address: USDC, abi: ERC20_ABI, functionName: 'approve', args: [addr, amount] })
const tipHash = await send('tip', { address: addr, abi: PAYX_ABI, functionName: 'tip', args: [handle, amount, message] })

const after = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'getHandleInfo', args: [handle] })
check(after.pendingBalance === before.pendingBalance + (amount - fee), 'pendingBalance increased by net amount', usdc6(after.pendingBalance))
check(after.tipCount === before.tipCount + 1n, 'tipCount incremented', String(after.tipCount))
console.log(`\n  tip tx ${tipHash}\n  @${handle} can claim at https://www.xylonet.xyz/payx/claim (sign in with X)`)
summary('TIP')
