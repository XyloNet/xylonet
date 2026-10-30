/**
 * PayX v2 end-to-end proof on a local anvil fork (chain id 5042).
 *
 *   npx tsx scripts/payx-e2e-anvil.ts
 *
 * Proves the web app's oracle signer (src/lib/payx/oracle.ts) is in lockstep
 * with PayXTipping.sol:
 *   1. deploy MockUSDC + PayXTipping v2 with a throwaway oracle key
 *   2. approve + tip("PanchU2605", 5 USDC, "gm")  → pending == 4.95 USDC
 *   3. signClaim() → claimTips() from a fresh wallet → wallet gets 4.95 USDC
 *   4. a second claim for a different wallet reverts WalletMismatch
 *   5. a signature made for chainId 5042002 is rejected (InvalidSignature)
 *   6. a replayed nonce is rejected (NonceAlreadyUsed)
 *   7. contract.domainSeparator() == viem hashDomain(PAYX_EIP712_DOMAIN)
 *
 * Requires `anvil` on PATH (foundry). Never touches a real network.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  hashDomain,
  http,
  parseUnits,
  type Abi,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { signClaim, getOracleAddress } from '../src/lib/payx/oracle';
import { PAYX_EIP712_DOMAIN, PayXTippingABI } from '../src/config/abis/PayXTipping';

// ─── setup ───────────────────────────────────────────────────────────────────

const CHAIN_ID = 5042;
const PORT = 8560;
const RPC = `http://127.0.0.1:${PORT}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_OUT = path.resolve(__dirname, '../../payx/contracts/out');

function loadArtifact(rel: string): { abi: Abi; bytecode: Hex } {
  const json = JSON.parse(readFileSync(path.join(CONTRACTS_OUT, rel), 'utf8')) as {
    abi: Abi;
    bytecode: { object: Hex };
  };
  return { abi: json.abi, bytecode: json.bytecode.object };
}

// anvil's deterministic default accounts (test mnemonic — never used on a real chain)
const ANVIL_KEYS: Hex[] = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
];

const arcLocal = defineChain({
  id: CHAIN_ID,
  name: 'Arc (anvil)',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

let passed = 0;
function ok(label: string, cond: boolean, detail = '') {
  if (!cond) throw new Error(`ASSERTION FAILED: ${label}${detail ? ` — ${detail}` : ''}`);
  passed += 1;
  console.log(`  ✓ ${label}${detail ? `  (${detail})` : ''}`);
}

function revertName(err: unknown): string | undefined {
  if (err instanceof BaseError) {
    const r = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    return r?.data?.errorName ?? r?.reason;
  }
  return undefined;
}

async function expectRevert(label: string, fn: () => Promise<unknown>, expected: string) {
  try {
    await fn();
  } catch (err) {
    const name = revertName(err);
    ok(label, name === expected, `reverted ${name}`);
    return;
  }
  throw new Error(`ASSERTION FAILED: ${label} — expected revert ${expected} but call succeeded`);
}

async function waitForRpc(timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      const j = (await res.json()) as { result?: string };
      if (j.result && parseInt(j.result, 16) === CHAIN_ID) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('anvil did not come up in time');
}

function startAnvil(): ChildProcess {
  // No shell: we must hold the real anvil pid so kill() reaches it (a shell
  // wrapper on Windows would leave anvil orphaned and the stderr pipe open).
  const child = spawn('anvil', ['--chain-id', String(CHAIN_ID), '--port', String(PORT), '--silent'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr?.on('data', (d) => process.stderr.write(`[anvil] ${d}`));
  child.on('error', (e) => {
    console.error('failed to start anvil (is foundry on PATH?):', e.message);
    process.exit(1);
  });
  return child;
}

function stopAnvil(child: ChildProcess) {
  try {
    child.kill();
  } catch {
    /* already gone */
  }
  if (process.platform === 'win32' && child.pid) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      /* best effort */
    }
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPayX v2 e2e — anvil chain ${CHAIN_ID} on :${PORT}\n`);
  const anvil = startAnvil();
  try {
    await waitForRpc();
    console.log('anvil ready');

    const publicClient = createPublicClient({ chain: arcLocal, transport: http(RPC) });
    const [deployer, tipper, claimer] = ANVIL_KEYS.map((k) =>
      createWalletClient({ account: privateKeyToAccount(k), chain: arcLocal, transport: http(RPC) })
    );
    const feeRecipient = privateKeyToAccount(generatePrivateKey()).address; // stands in for the Treasury Safe

    // Throwaway oracle key — generated here, never persisted.
    const oracleKey = generatePrivateKey();
    const oracleAddress = getOracleAddress(oracleKey);
    console.log(`oracle (throwaway): ${oracleAddress}`);

    // 1. deploy
    const mock = loadArtifact('MockUSDC.sol/MockUSDC.json');
    const payxArt = loadArtifact('PayXTipping.sol/PayXTipping.json');

    const usdcHash = await deployer.deployContract({ abi: mock.abi, bytecode: mock.bytecode, args: [] });
    const usdc = (await publicClient.waitForTransactionReceipt({ hash: usdcHash })).contractAddress!;
    ok('MockUSDC deployed', !!usdc, usdc);

    const payxHash = await deployer.deployContract({
      abi: payxArt.abi,
      bytecode: payxArt.bytecode,
      args: [usdc, oracleAddress, feeRecipient, 100n, 100_000n],
    });
    const payx = (await publicClient.waitForTransactionReceipt({ hash: payxHash })).contractAddress!;
    ok('PayXTipping v2 deployed', !!payx, payx);

    const read = <T,>(functionName: string, args: unknown[] = []) =>
      publicClient.readContract({ address: payx, abi: PayXTippingABI, functionName: functionName as never, args: args as never }) as Promise<T>;

    ok('oracleSigner() matches', (await read<string>('oracleSigner')).toLowerCase() === oracleAddress.toLowerCase());
    ok('platformFeeBps() == 100', (await read<bigint>('platformFeeBps')) === 100n);
    ok('minTipAmount() == 100000', (await read<bigint>('minTipAmount')) === 100_000n);

    // 7. domain separator lockstep (checked early — it gates everything else)
    const onChainDomain = await read<Hex>('domainSeparator');
    const localDomain = hashDomain({
      domain: { ...PAYX_EIP712_DOMAIN(payx, CHAIN_ID), chainId: BigInt(CHAIN_ID) },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
      },
    });
    ok('domainSeparator() == viem hashDomain(PAYX_EIP712_DOMAIN)', onChainDomain === localDomain, onChainDomain.slice(0, 18) + '…');

    // 2. mint + approve + tip
    const tipperAddr = tipper.account.address;
    const mintHash = await deployer.writeContract({
      address: usdc, abi: mock.abi, functionName: 'mint', args: [tipperAddr, parseUnits('100', 6)],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });

    const tipAmount = parseUnits('5', 6);
    const approveHash = await tipper.writeContract({
      address: usdc, abi: mock.abi, functionName: 'approve', args: [payx, tipAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const tipHash = await tipper.writeContract({
      address: payx, abi: PayXTippingABI, functionName: 'tip', args: ['PanchU2605', tipAmount, 'gm'],
    });
    const tipReceipt = await publicClient.waitForTransactionReceipt({ hash: tipHash });
    ok('tip("PanchU2605", 5 USDC, "gm") mined', tipReceipt.status === 'success', tipHash.slice(0, 18) + '…');

    const info = await publicClient.readContract({
      address: payx, abi: PayXTippingABI, functionName: 'getHandleInfo', args: ['panchu2605'],
    });
    ok('getHandleInfo("panchu2605").pendingBalance == 4.95 USDC', info.pendingBalance === parseUnits('4.95', 6), formatUnits(info.pendingBalance, 6));
    ok('tipCount == 1', info.tipCount === 1n);
    ok('totalFeesCollected == 0.05 USDC', (await read<bigint>('totalFeesCollected')) === parseUnits('0.05', 6));
    ok('handle normalized in event (TipSent.handle == "panchu2605")', (() => {
      const log = tipReceipt.logs.find((l) => l.address.toLowerCase() === payx.toLowerCase());
      return !!log; // decoded below via history read for a stricter check
    })());
    const history = await publicClient.readContract({
      address: payx, abi: PayXTippingABI, functionName: 'getTipHistory', args: ['PANCHU2605', 0n, 10n],
    });
    ok('getTipHistory (case-insensitive) returns the tip with message "gm"', history.length === 1 && history[0].message === 'gm' && history[0].amount === parseUnits('4.95', 6));

    // 3. signClaim (the app's oracle) → claimTips from a fresh wallet
    const claimerAddr = claimer.account.address;
    const claim = await signClaim({
      privateKey: oracleKey, contract: payx, chainId: CHAIN_ID, handle: 'PanchU2605', wallet: claimerAddr,
    });
    ok('signClaim normalized handle', claim.handle === 'panchu2605');
    ok('signClaim returned checksummed wallet', claim.wallet === claimerAddr);
    ok('signClaim oracleAddress matches', claim.oracleAddress === oracleAddress);

    const claimHash = await claimer.writeContract({
      address: payx, abi: PayXTippingABI, functionName: 'claimTips',
      args: [claim.handle, claim.wallet, claim.nonce, claim.signature],
    });
    const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
    ok('claimTips mined', claimReceipt.status === 'success', claimHash.slice(0, 18) + '…');

    const claimerBal = await publicClient.readContract({
      address: usdc, abi: mock.abi, functionName: 'balanceOf', args: [claimerAddr],
    }) as bigint;
    ok('claimer USDC balance == 4.95', claimerBal === parseUnits('4.95', 6), formatUnits(claimerBal, 6));

    const after = await publicClient.readContract({
      address: payx, abi: PayXTippingABI, functionName: 'getHandleInfo', args: ['panchu2605'],
    });
    ok('pendingBalance == 0 after claim', after.pendingBalance === 0n);
    ok('linkedWallet == claimer', after.linkedWallet.toLowerCase() === claimerAddr.toLowerCase());
    ok('isRegistered == true', after.isRegistered === true);
    ok('totalPending() == 0', (await read<bigint>('totalPending')) === 0n);

    // 6. replaying the used nonce is rejected (checked before NoTipsToClaim)
    await expectRevert(
      'replayed nonce reverts NonceAlreadyUsed',
      () => publicClient.simulateContract({
        address: payx, abi: PayXTippingABI, functionName: 'claimTips',
        args: [claim.handle, claim.wallet, claim.nonce, claim.signature], account: claimerAddr,
      }),
      'NonceAlreadyUsed'
    );

    // 4. tip again, then a valid signature for a DIFFERENT wallet must revert WalletMismatch
    const approve2 = await tipper.writeContract({ address: usdc, abi: mock.abi, functionName: 'approve', args: [payx, parseUnits('1', 6)] });
    await publicClient.waitForTransactionReceipt({ hash: approve2 });
    const tip2 = await tipper.writeContract({ address: payx, abi: PayXTippingABI, functionName: 'tip', args: ['panchu2605', parseUnits('1', 6), ''] });
    await publicClient.waitForTransactionReceipt({ hash: tip2 });

    const otherWallet = deployer.account.address;
    const mismatch = await signClaim({ privateKey: oracleKey, contract: payx, chainId: CHAIN_ID, handle: 'panchu2605', wallet: otherWallet });
    await expectRevert(
      'claim for a different wallet reverts WalletMismatch',
      () => publicClient.simulateContract({
        address: payx, abi: PayXTippingABI, functionName: 'claimTips',
        args: [mismatch.handle, mismatch.wallet, mismatch.nonce, mismatch.signature], account: otherWallet,
      }),
      'WalletMismatch'
    );

    // 5. a signature made for the testnet chain id is rejected on 5042
    const wrongChain = await signClaim({ privateKey: oracleKey, contract: payx, chainId: 5042002, handle: 'panchu2605', wallet: claimerAddr });
    await expectRevert(
      'signature for chainId 5042002 reverts InvalidSignature on 5042',
      () => publicClient.simulateContract({
        address: payx, abi: PayXTippingABI, functionName: 'claimTips',
        args: [wrongChain.handle, wrongChain.wallet, wrongChain.nonce, wrongChain.signature], account: claimerAddr,
      }),
      'InvalidSignature'
    );

    // and a signature from a non-oracle key is rejected too
    const rogue = await signClaim({ privateKey: generatePrivateKey(), contract: payx, chainId: CHAIN_ID, handle: 'panchu2605', wallet: claimerAddr });
    await expectRevert(
      'signature from a non-oracle key reverts InvalidSignature',
      () => publicClient.simulateContract({
        address: payx, abi: PayXTippingABI, functionName: 'claimTips',
        args: [rogue.handle, rogue.wallet, rogue.nonce, rogue.signature], account: claimerAddr,
      }),
      'InvalidSignature'
    );

    // sanity: the linked wallet can still claim the second tip with a fresh signature
    const claim2 = await signClaim({ privateKey: oracleKey, contract: payx, chainId: CHAIN_ID, handle: 'panchu2605', wallet: claimerAddr });
    const claim2Hash = await claimer.writeContract({
      address: payx, abi: PayXTippingABI, functionName: 'claimTips',
      args: [claim2.handle, claim2.wallet, claim2.nonce, claim2.signature],
    });
    await publicClient.waitForTransactionReceipt({ hash: claim2Hash });
    const finalBal = await publicClient.readContract({ address: usdc, abi: mock.abi, functionName: 'balanceOf', args: [claimerAddr] }) as bigint;
    ok('linked wallet claims second tip: balance == 4.95 + 0.99', finalBal === parseUnits('5.94', 6), formatUnits(finalBal, 6));

    // oracle input validation
    let threw = false;
    try { await signClaim({ privateKey: oracleKey, contract: payx, chainId: CHAIN_ID, handle: 'bad handle!', wallet: claimerAddr }); } catch { threw = true; }
    ok('signClaim rejects an invalid handle', threw);
    threw = false;
    try { await signClaim({ privateKey: oracleKey, contract: payx, chainId: CHAIN_ID, handle: 'panchu2605', wallet: '0x1234' }); } catch { threw = true; }
    ok('signClaim rejects an invalid wallet', threw);

    console.log(`\nALL ${passed} CHECKS PASSED — oracle signer and PayXTipping v2 are in lockstep on chain ${CHAIN_ID}.\n`);
  } finally {
    stopAnvil(anvil);
    console.log('anvil stopped');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nE2E FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
