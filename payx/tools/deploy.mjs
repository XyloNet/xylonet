// Runbook step 1 — deploy PayXTipping v2 from XYLO-DEPLOYER-01 via viem (same bytecode
// as `forge build`; constructor args pinned). Simulates first, then broadcasts, then
// waits for the receipt and prints everything needed for ADDRESS_BOOK.md.
import { encodeDeployData, getAddress, isAddress, formatUnits } from 'viem'
import { publicClient, walletClient, deployerAccount, artifact, USDC, TREASURY_SAFE, EXPECTED_FEE_BPS, EXPECTED_MIN_TIP, CHAIN_ID, fail, native } from './common.mjs'

const oracle = process.env.ORACLE_SIGNER_ADDRESS
if (!oracle || !isAddress(oracle)) fail('ORACLE_SIGNER_ADDRESS missing — run preflight first')
if (process.argv[2] !== '--yes') {
  console.log('Dry run. Re-run with `node deploy.mjs --yes` to broadcast. Pre-flight must be ALL GREEN first.')
}

const c = publicClient()
if ((await c.getChainId()) !== CHAIN_ID) fail('wrong chain')
const acct = deployerAccount()
const w = walletClient(acct)
const art = artifact()

const args = [USDC, getAddress(oracle), TREASURY_SAFE, EXPECTED_FEE_BPS, EXPECTED_MIN_TIP]
const data = encodeDeployData({ abi: art.abi, bytecode: art.bytecode.object, args })

// simulate (eth_call of a create) — catches constructor reverts before spending gas
const gas = await c.estimateGas({ account: acct.address, data }).catch((e) => fail(`constructor simulation failed: ${e.shortMessage || e.message}`))
const gp = await c.getGasPrice()
console.log(`Deploy simulation OK. gas ≈ ${gas} @ ${formatUnits(gp, 9)} gwei ≈ ${formatUnits(gas * gp, 18)} USDC`)
console.log(`  constructor: usdc=${args[0]} oracle=${args[1]} feeRecipient=${args[2]} feeBps=${args[3]} minTip=${args[4]}`)
const nonce = await c.getTransactionCount({ address: acct.address })
console.log(`  deployer ${acct.address} nonce ${nonce} balance ${native(await c.getBalance({ address: acct.address }))}`)

if (process.argv[2] !== '--yes') process.exit(0)

const hash = await w.deployContract({ abi: art.abi, bytecode: art.bytecode.object, args, gas: (gas * 12n) / 10n })
console.log(`\nBroadcast: ${hash}`)
const rcpt = await c.waitForTransactionReceipt({ hash, timeout: 120_000 })
if (rcpt.status !== 'success' || !rcpt.contractAddress) fail(`deploy tx failed: status=${rcpt.status}`)
console.log('\n=== RECORD IN docs/ADDRESS_BOOK.md ===')
console.log(`PayXTipping v2 : ${rcpt.contractAddress}`)
console.log(`tx             : ${hash}`)
console.log(`block          : ${rcpt.blockNumber}`)
console.log(`gas used       : ${rcpt.gasUsed}  (≈ ${formatUnits(rcpt.gasUsed * (rcpt.effectiveGasPrice ?? gp), 18)} USDC)`)
console.log(`compiler       : ${JSON.parse(art.rawMetadata).compiler.version}, optimizer 200 runs, evm cancun`)
console.log(`\nNEXT: put PAYX_ADDRESS=${rcpt.contractAddress} into payx/tools/.env, then \`npm run assert\`.`)
