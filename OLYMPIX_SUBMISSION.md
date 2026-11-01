# OLYMPIX_SUBMISSION.md

## 1. Summary

| | |
| --- | --- |
| Project | XyloNet, PayX tipping contracts (Arc mainnet, chain 5042) |
| Repository | https://github.com/XyloNet/xylonet, Foundry project at `payx/contracts` |
| Date | 2026-11-01 |
| Review level | Max (Critical, High, Medium, Low, Informational), full manual review plus Slither plus Foundry unit, fuzz and invariant tests |
| Solidity compiler | solc 0.8.30, optimizer on (200 runs), EVM `cancun` (pragma `^0.8.24`) |
| Dependencies | OpenZeppelin Contracts 5.1.0, forge-std 1.9.6 (pinned under `lib/`, out of scope) |
| Tools | forge 1.7.1, slither 0.11.6 |

In-scope files (every production contract; tests, mocks, deploy script and `lib/` skipped):

| File | SHA-256 before review | SHA-256 after fixes |
| --- | --- | --- |
| `payx/contracts/src/PayXTipping.sol` | `6065e2cdc85aa7ed384523d94bd7c6472d5aa82b4a77ec333f844c75ba731d46` | `7e31f34bd844a337a1d4c4bcf267f1559209c2e4100076ef7d7297ce6261732f` |

Out of scope, hashed for completeness: `src/MockUSDC.sol` (test mock, never deployed) `4f8096ede5530301b6b43b5204acbd48aae7ff8cddbf91b576fd349b08e2dffd`; `script/Deploy.s.sol` (deploy script) `6f1430421ed9e38c8cb7197f19bb191597aef37c075b007808f04e75d923946e`.

Behavior changes made by the fixes: none. The one source change (F-01) reorders `tip()` so that all state is written before the token transfer; the function's inputs, outputs, events, reverts and token movement are identical. Three instances of the pre-review source are live on Arc mainnet (USDC `0x47d4164F2f65afc00c7ba932cbEC9858b5FDAf0A`, EURC `0xB9E6b729425DB5565E8caFCE6d35E820FaE7d1ca`, cirBTC `0x1de44961059A0E4516fF56379EB77B1c4Da62f87`); the contract is not upgradeable, so the fix applies to the next deployment.

## 2. Findings

| ID | Severity | Source | Title | File and line | Status | Fix or reason open |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | Low | Review | `tip()` performed the token transfer before writing state (interaction before effects); safe only because of `nonReentrant` and a trusted token | `src/PayXTipping.sol` 224-243 | Fixed | State updates and the history push now precede `safeTransferFrom`; `nonReentrant` kept as the second layer. Proven by `test_F01_*`. |
| F-02 | Informational | Slither (missing-zero-check) | `setGuardian` accepts the zero address | `src/PayXTipping.sol` 356-360 | Accepted risk | Intentional: the zero address is the documented way to disable the guardian role; `address(0)` can never be `msg.sender`, so nothing gains the role. `test_F02_*`. |
| F-03 | Low | Review | Claim authorizations have no deadline; a signed `Claim(handle, wallet, nonce)` stays valid until its nonce is used | `src/PayXTipping.sol` 252-292 | Open | Adding `deadline` to the typed struct changes the oracle message format and the web signer (an ABI and API change). A stale signature can only pay the wallet it names, so there is no path to loss; decision needed on whether the next version adds a deadline. `test_F03_*` documents the behavior. |
| F-04 | Medium | Review | Privileged roles: the owner can rotate `oracleSigner` and relink a registered handle (`adminRelinkWallet`); together these can redirect a handle's future claims | `src/PayXTipping.sol` 348-353, 429-440 | Accepted risk | By design: this is the recovery path for lost wallets and sold handles. The owner is a 2-of-3 Safe held by the three co-founders; both actions emit events (`OracleSignerUpdated`, `WalletRelinked`); no role below owner has either power. A timelock would reduce the risk further and is listed under open items. `test_F04_*`. |
| F-05 | Informational | Slither (incorrect-equality) | `rescueToken` uses `balance == 0` | `src/PayXTipping.sol` 462 | False positive | A zero check that guards a revert, not a balance comparison that can be manipulated. `test_F05_*`. |
| F-06 | Informational | Review | Fee arithmetic rounds down; the remainder stays with the recipient | `src/PayXTipping.sol` 224-225 | Accepted risk | Correct direction (never over-charges, sums conserve). Fuzzed in `test_F06_*` over 512 runs. |
| F-07 | Low | Review | No refund or expiry path: a payment to a handle that never claims is held forever | `src/PayXTipping.sol` 214-243 | Accepted risk | Product decision: a payment waits for its handle indefinitely. Escrow leaves only through `claimTips`; no owner function can touch it (`test_F07_*`). A sender-side timeout refund would be a feature, not a fix. |
| F-08 | Informational | Review | Pause scope: `pause` halts `tip` and `claimTips` only; fee withdrawal and all owner recovery functions keep working while paused | `src/PayXTipping.sol` 392-400, 415-422 | Accepted risk | Intended: a guardian can freeze user flows but cannot trap fees or block owner recovery; only the owner can unpause. `test_F08_*`. |
| F-09 | Informational | Slither (naming-convention) | Setter parameters use a leading underscore (`_newSigner`, …) | `src/PayXTipping.sol` 348-380 | Accepted risk | Style only; left as is to keep the source identical to the verified deployed contract apart from F-01. |
| F-10 | Informational | Review | Floating pragma `^0.8.24` in source; version pinned to 0.8.30 in `foundry.toml` | `src/PayXTipping.sol` 2 | Accepted risk | The build is pinned in configuration and the deployed bytecode is verified against 0.8.30; the pragma is left floating so the verified source stays byte-identical. |

Reviewed and found sound (no finding): EIP-712 domain binds name, version, chain id and instance address, so signatures cannot cross the three instances; nonces are single use and the burn is reverted together with a failed signature check; OpenZeppelin `ECDSA.recover` rejects malleable signatures; first claim permanently links the wallet and later claims must match it; `withdrawFees` restricted to owner or fee recipient and pays only the fee recipient; `sweepExcessUSDC` can only move balance above `totalPending + totalFeesCollected`; `rescueToken` refuses the escrow token; `renounceOwnership` disabled, `Ownable2Step` for transfers; `minTipAmount` cannot be zero, `platformFeeBps` capped at 5%; handle normalisation bounds length and character set; every token-moving function is `nonReentrant`; no delegatecall, no selfdestruct, no assembly, no external calls other than the escrow token and `rescueToken`'s target.

## 3. Tests

Command (from `payx/contracts`; the fork suite needs an Arc RPC and was excluded):

```
forge test --no-match-path "test/PayXTipping.fork.t.sol"
```

Test files: `test/PayXTipping.t.sol` (42 unit tests), `test/PayXTipping.audit.t.sol` (36 tests from the 2026-09-15 audit), `test/PayXTipping.invariant.t.sol` (10 handler-based invariants, 256 runs, depth 50, fail on revert), `test/PayXTipping.olympix.t.sol` (10 tests written for this review).

Result: 98 passed, 0 failed, 0 skipped.

| Test | Covers |
| --- | --- |
| `test_F01_tip_effectsAreFinalBeforeTokenTransfer`, `test_F01_tip_reentrantTokenIsRejected` | F-01 |
| `test_F02_setGuardian_zeroDisablesPauseRole` | F-02 |
| `test_F03_claimSignature_staysValidUntilUsed` | F-03 |
| `test_F04_ownerCanRedirectEscrowThroughOracleRotationAndRelink`, `test_F04_nonOwnersCannotRelinkOrRotate` | F-04 |
| `test_F05_rescueToken_zeroBalanceRevertsNonZeroSucceeds` | F-05 |
| `test_F06_feeRoundsDownAndSumsConserve` (fuzz, 512 runs) | F-06 |
| `test_F07_escrowOnlyLeavesThroughClaim` | F-07 |
| `test_F08_pauseScope` | F-08 |

F-09 and F-10 are style and configuration items with no runtime behavior to test. The pre-existing suites continue to cover the solvency invariant, the EIP-712 rejection matrix (wrong chain, wrong contract, wrong signer, legacy packed signatures), nonce replay, wallet mismatch, the pause matrix, two-step ownership and the sweep bound.

## 4. Open items

| ID | Risk in plain language | Decision needed |
| --- | --- | --- |
| F-03 (Low, open) | A claim signature issued by the oracle never goes stale on its own. If a signature leaked, it could still only send that handle's balance to the wallet the handle owner chose, so no one else gains. | Whether the next contract version adds a `deadline` field to the claim message (changes the oracle signer and the web API; needs a redeploy and a migration plan for the three live instances). |
| F-04 (Medium, accepted) | The two co-founders who form a 2-of-3 on the Admin Safe could, acting together, point a registered handle's future claims at another wallet and sign claims with a new oracle key. Every step is on chain and emits events. | Whether to add a timelock (for example 48 hours) in front of `setOracleSigner` and `adminRelinkWallet` in the next version, trading recovery speed for a public warning window. |
| F-07 (Low, accepted) | Money sent to a handle that never signs in stays in the contract indefinitely. | Whether a future version lets a sender reclaim an unclaimed tip after a long timeout (a product change, not a security fix). |
| F-02, F-05, F-06, F-08, F-09, F-10 | Informational; behavior is intentional or a style choice. | None. |

## 5. Audit Provenance

| Field | Value |
| --- | --- |
| Reviewer | Claude Fable 5.1 (claude-fable-5-1) in Claude Code, operated by Panchanan Vijay Pal (XyloNet) |
| Method | Full manual read of every line of `PayXTipping.sol` with attacker modelling per role; Slither 0.11.6 with the project's remappings, dependencies excluded; Foundry 1.7.1 unit, fuzz (512 runs) and invariant (256 runs, depth 50) suites; new tests written per finding |
| Date | 2026-11-01 |
| Source commit (private working repo, before review) | `4e51ba0` |
| Public mirror | https://github.com/XyloNet/xylonet (the commit carrying this file is the one to scan) |
| Hash before / after | `6065e2cd…731d46` / `7e31f34b…61732f` (full values in section 1) |
| Slither | 7 results in 3 detectors: incorrect-equality (F-05, false positive), missing-zero-check (F-02, intentional), naming-convention ×5 (F-09, style) |
| Tests | `forge test --no-match-path "test/PayXTipping.fork.t.sol"`: 98 passed, 0 failed |
| Prior review | Internal pre-deployment audit 2026-09-15 (GO with fixes, all applied; 90 tests then, Slither clean apart from the items above) |
| Deployed bytecode | All three mainnet instances match the pre-review source; F-01 applies to the next deployment |
