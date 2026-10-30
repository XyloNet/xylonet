// Deploy an additional PayXTipping v2 instance whose escrow token is NOT USDC.
//   node deploy-token.mjs <tokenAddress> <minTipHuman> [--yes]
// Same audited bytecode, same oracle, same Treasury feeRecipient, same 1% fee.
// The contract's ERC-20 handling is decimal-agnostic; only minTip is token-native.
import { encodeDeployData, getAddress, isAddress, parseUnits, formatUnits } from 'viem'
import { publicClient, walletClient, deployerAccount, artifact, ERC20_ABI, TREASURY_SAFE, EXPECTED_FEE_BPS, CHAIN_ID, fail, native } from './common.mjs'

const [, , tokenRaw, minTipHuman, flag] = process.argv
if (!tokenRaw || !isAddress(tokenRaw) || !minTipHuman) fail('usage: node deploy-token.mjs <token> <minTip e.g. 100> [--yes]')
const token = getAddress(tokenRaw)
const oracle = process.env.ORACLE_SIGNER_ADDRESS
if (!oracle || !isAddress(oracle)) fail('ORACLE_SIGNER_ADDRESS missing')

const c = publicClient()
if ((await c.getChainId()) !== CHAIN_ID) fail('wrong chain')
const acct = deployerAccount()
const w = walletClient(acct)
const art = artifact()

const decimals = await c.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' })
const minTip = parseUnits(minTipHuman, decimals)
const args = [token, getAddress(oracle), TREASURY_SAFE, EXPECTED_FEE_BPS, minTip]
const data = encodeDeployData({ abi: art.abi, bytecode: art.bytecode.object, args })
const gas = await c.estimateGas({ account: acct.address, data }).catch((e) => fail(`constructor simulation failed: ${e.shortMessage || e.message}`))
const gp = await c.getGasPrice()
console.log(`PayXTipping v2 for token ${token} (${decimals} dp)`)
console.log(`  oracle ${args[1]} feeRecipient ${args[2]} feeBps ${args[3]} minTip ${formatUnits(minTip, decimals)}`)
console.log(`  gas ≈ ${gas} ≈ ${formatUnits(gas * gp, 18)} USDC · deployer ${native(await c.getBalance({ address: acct.address }))}`)
if (flag !== '--yes') { console.log('Dry run. Add --yes to broadcast.'); process.exit(0) }

const hash = await w.deployContract({ abi: art.abi, bytecode: art.bytecode.object, args, gas: (gas * 12n) / 10n })
console.log(`\nBroadcast: ${hash}`)
const rcpt = await c.waitForTransactionReceipt({ hash, timeout: 120_000 })
if (rcpt.status !== 'success' || !rcpt.contractAddress) fail(`deploy tx failed: ${rcpt.status}`)
console.log(`\n=== RECORD ===\nPayXTipping v2 (${token}) : ${rcpt.contractAddress}\ntx ${hash}\nblock ${rcpt.blockNumber}\ngas ${rcpt.gasUsed}`)
