// Runbook step 4 — transferOwnership(Admin Safe) from the deployer (Ownable2Step step 1 of 2).
// Step 2 (acceptOwnership) is executed BY THE ADMIN SAFE via the 2-of-3 ceremony; this script
// prints exactly what to enter in app.safe.global ("New transaction → Contract interaction").
import { getAddress, encodeFunctionData } from 'viem'
import { publicClient, walletClient, deployerAccount, payxAddress, PAYX_ABI, ADMIN_SAFE, DEPLOYER, check, summary, fail, short } from './common.mjs'

const c = publicClient()
const addr = payxAddress()
const deployer = deployerAccount()
const w = walletClient(deployer)

const owner = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'owner' })
const pending = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'pendingOwner' })
console.log(`PayX ${addr}\n  owner        ${owner}\n  pendingOwner ${pending}\n`)

if (getAddress(owner) === getAddress(ADMIN_SAFE)) {
  console.log('Ownership already with the Admin Safe. Nothing to do.')
  process.exit(0)
}
if (getAddress(owner) !== getAddress(DEPLOYER)) fail('owner is neither deployer nor Admin Safe — investigate before doing anything')

if (getAddress(pending) !== getAddress(ADMIN_SAFE)) {
  if (process.argv[2] !== '--yes') {
    console.log('Dry run: would call transferOwnership(' + ADMIN_SAFE + '). Re-run with --yes.')
    process.exit(0)
  }
  const { request } = await c.simulateContract({ account: deployer, address: addr, abi: PAYX_ABI, functionName: 'transferOwnership', args: [ADMIN_SAFE] })
  const hash = await w.writeContract(request)
  const r = await c.waitForTransactionReceipt({ hash, timeout: 120_000 })
  check(r.status === 'success', 'transferOwnership tx success', short(hash))
  const p2 = await c.readContract({ address: addr, abi: PAYX_ABI, functionName: 'pendingOwner' })
  check(getAddress(p2) === getAddress(ADMIN_SAFE), 'pendingOwner == Admin Safe', p2)
} else {
  console.log('pendingOwner is already the Admin Safe.')
}

const calldata = encodeFunctionData({ abi: PAYX_ABI, functionName: 'acceptOwnership' })
console.log(`
=== SAFE CEREMONY (step 5) — Panchu proposes in app.safe.global on the phone ===
  Safe            : Admin Safe ${ADMIN_SAFE}
  New transaction → Contract interaction
    To (contract) : ${addr}
    ABI           : paste [{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]
    Method        : acceptOwnership   (no parameters, value 0)
  Expected calldata (verify in the review screen): ${calldata}
  Then: post safeTxHash in founders' chat → co-founder matches then confirms+executes.
  Verify with: npm run status   (owner must equal the Admin Safe, pendingOwner 0x0)
`)
summary('HANDOVER')
