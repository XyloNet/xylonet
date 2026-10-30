// One command per extra tipping asset: deploy a PayXTipping v2 instance for the
// token, assert its configuration, hand ownership to the Admin Safe (step 1 of
// Ownable2Step) and record the result for the web app and the address book.
//   node launch-asset.mjs <EURC|CIRBTC>          dry run: checks + gas estimate, nothing is sent
//   node launch-asset.mjs <EURC|CIRBTC> --yes    broadcast (two transactions from the deployer)
// Same audited bytecode, oracle, Treasury fee recipient and 1% fee as the USDC instance.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeDeployData, encodeFunctionData, getAddress, isAddress, parseUnits, formatUnits } from 'viem'
import { publicClient, walletClient, deployerAccount, artifact, ERC20_ABI, PAYX_ABI, ADMIN_SAFE, TREASURY_SAFE, EXPECTED_FEE_BPS, CHAIN_ID, check, summary, fail, native, short } from './common.mjs'

const ASSETS = {
  EURC: { token: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1', decimals: 6, symbol: 'EURC', minTip: '0.1' },
  // 100 sats: the smallest tip whose 1% fee is a whole satoshi.
  CIRBTC: { token: '0x171A4217b86A807A64eB94757Db6849fb4bDbAA0', decimals: 8, symbol: 'cirBTC', minTip: '0.000001' },
}

const [, , keyRaw, flag] = process.argv
const key = String(keyRaw || '').toUpperCase()
const spec = ASSETS[key]
if (!spec) fail('usage: node launch-asset.mjs <EURC|CIRBTC> [--yes]')
const oracle = process.env.ORACLE_SIGNER_ADDRESS
if (!oracle || !isAddress(oracle)) fail('ORACLE_SIGNER_ADDRESS missing in payx/tools/.env')

const here = dirname(fileURLToPath(import.meta.url))
const recordPath = resolve(here, 'deployments', `${key}.json`)
if (existsSync(recordPath) && flag === '--yes') {
  const prev = JSON.parse(readFileSync(recordPath, 'utf8'))
  fail(`${key} is already recorded at ${prev.address} (${recordPath}). Delete the file only if that deployment is being abandoned.`)
}

const c = publicClient()
if ((await c.getChainId()) !== CHAIN_ID) fail('wrong chain')
const acct = deployerAccount()
const w = walletClient(acct)
const art = artifact()
const token = getAddress(spec.token)

const [decimals, symbol] = await Promise.all([
  c.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }),
  c.readContract({ address: token, abi: [{ type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }], functionName: 'symbol' }),
])
check(Number(decimals) === spec.decimals, `token decimals == ${spec.decimals}`, String(decimals))
check(symbol === spec.symbol, `token symbol == ${spec.symbol}`, symbol)
const minTip = parseUnits(spec.minTip, spec.decimals)
const args = [token, getAddress(oracle), TREASURY_SAFE, EXPECTED_FEE_BPS, minTip]
const data = encodeDeployData({ abi: art.abi, bytecode: art.bytecode.object, args })
const gas = await c.estimateGas({ account: acct.address, data }).catch((e) => fail(`constructor simulation failed: ${e.shortMessage || e.message}`))
const gp = await c.getGasPrice()
const bal = await c.getBalance({ address: acct.address })
console.log(`PayXTipping v2 for ${spec.symbol} (${token}, ${spec.decimals} dp)`)
console.log(`  oracle ${args[1]}\n  feeRecipient ${args[2]} (Treasury Safe)\n  feeBps ${args[3]}  minTip ${spec.minTip} ${spec.symbol}`)
console.log(`  deploy gas ≈ ${gas} ≈ ${formatUnits(gas * gp, 18)} USDC · deployer holds ${native(bal)}`)
check(bal > gas * gp * 3n, 'deployer can pay for both transactions')
if (flag !== '--yes') {
  summary('DRY RUN')
  console.log('Nothing was sent. Add --yes to deploy and hand over.')
  process.exit(0)
}

// 1. deploy
const hash = await w.deployContract({ abi: art.abi, bytecode: art.bytecode.object, args, gas: (gas * 12n) / 10n })
console.log(`\nDeploy broadcast: ${hash}`)
const rcpt = await c.waitForTransactionReceipt({ hash, timeout: 120_000 })
if (rcpt.status !== 'success' || !rcpt.contractAddress) fail(`deploy tx failed: ${rcpt.status}`)
const addr = rcpt.contractAddress
// Record immediately so a failure further down never loses the address.
mkdirSync(dirname(recordPath), { recursive: true })
const record = { asset: key, symbol: spec.symbol, token, address: addr, deployTx: hash, block: Number(rcpt.blockNumber), minTip: spec.minTip, handoverTx: null }
writeFileSync(recordPath, JSON.stringify(record, null, 2))

// 2. assert
const read = (fn) => c.readContract({ address: addr, abi: PAYX_ABI, functionName: fn })
const [owner, escrowToken, oracleSigner, feeRecipient, feeBps, min, paused] = await Promise.all([read('owner'), read('usdc'), read('oracleSigner'), read('feeRecipient'), read('platformFeeBps'), read('minTipAmount'), read('paused')])
check(getAddress(owner) === getAddress(acct.address), 'owner == deployer (before handover)', owner)
check(getAddress(escrowToken) === token, `escrow token == ${spec.symbol}`, escrowToken)
check(getAddress(oracleSigner) === getAddress(oracle), 'oracleSigner == XYLO-ORACLE-01', oracleSigner)
check(getAddress(feeRecipient) === getAddress(TREASURY_SAFE), 'feeRecipient == Treasury Safe', feeRecipient)
check(feeBps === EXPECTED_FEE_BPS, 'platformFeeBps == 100', String(feeBps))
check(min === minTip, `minTipAmount == ${spec.minTip}`, String(min))
check(paused === false, 'not paused')

// 3. hand over (Ownable2Step, step 1 of 2)
const { request } = await c.simulateContract({ account: acct, address: addr, abi: PAYX_ABI, functionName: 'transferOwnership', args: [ADMIN_SAFE] })
const h2 = await w.writeContract(request)
const r2 = await c.waitForTransactionReceipt({ hash: h2, timeout: 120_000 })
check(r2.status === 'success', 'transferOwnership tx success', short(h2))
const pending = await read('pendingOwner')
check(getAddress(pending) === getAddress(ADMIN_SAFE), 'pendingOwner == Admin Safe', pending)
writeFileSync(recordPath, JSON.stringify({ ...record, handoverTx: h2 }, null, 2))

console.log(`
=== RECORD (${recordPath}) ===
PayXTipping v2 (${spec.symbol}) : ${addr}
deploy tx ${hash}  block ${rcpt.blockNumber}
handover tx ${h2}

=== SAFE CEREMONY — propose in app.safe.global, a second founder confirms and executes ===
  Safe            : Admin Safe ${ADMIN_SAFE}
  New transaction → Contract interaction
    To (contract) : ${addr}
    ABI           : [{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]
    Method        : acceptOwnership   (no parameters, value 0)
  Expected calldata: ${encodeFunctionData({ abi: PAYX_ABI, functionName: 'acceptOwnership' })}
`)
summary(`LAUNCH ${key}`)
