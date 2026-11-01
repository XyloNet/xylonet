# PayX contracts (Arc mainnet)

`PayXTipping` v2 is the escrow behind "pay anyone on X": a sender pays an X handle in a Circle stablecoin, the amount waits in this contract under the handle, and the handle's owner claims it later after signing in with X. One contract instance per escrow token; all three share one audited source.

| Instance | Address (Arc, chain 5042) | Deployed |
| --- | --- | --- |
| USDC | `0x47d4164F2f65afc00c7ba932cbEC9858b5FDAf0A` | 2026-09-15, block 20936229 |
| EURC | `0xB9E6b729425DB5565E8caFCE6d35E820FaE7d1ca` | 2026-10-04, block 24213517 |
| cirBTC | `0x1de44961059A0E4516fF56379EB77B1c4Da62f87` | 2026-10-04, block 24213560 |

Compiler: Solidity 0.8.30, optimizer 200 runs, EVM `cancun`. Dependencies: OpenZeppelin Contracts 5.1.0 (pinned in `lib/`). Build and test with [Foundry](https://book.getfoundry.sh): `forge build`, `forge test` (the fork suite needs `ARC_MAINNET_RPC_URL`).

## How it works

1. `tip(handle, amount, message)`: the sender's tokens move into the contract; `platformFeeBps` (1%) is set aside as fee, the rest is credited to the handle's `pendingBalance`. Handles are normalised on chain (lower-case, `a-z 0-9 _`, 1 to 15 characters). Minimum tip and a 280-byte message cap apply.
2. Off chain, the handle's owner signs in with X on xylonet.xyz and picks a wallet. The XyloNet oracle (`XYLO-ORACLE-01`) signs an EIP-712 `Claim(handle, wallet, nonce)` bound to this chain and this contract address.
3. `claimTips(handle, wallet, nonce, signature)`: anyone may submit it; the contract checks the signature against `oracleSigner`, burns the nonce, pays the whole pending balance to `wallet`, and on the first claim links that wallet to the handle for good. Later claims must name the same wallet.

## Roles and what each one can do

| Role | Who | Can | Cannot |
| --- | --- | --- | --- |
| Owner | Admin Safe, 2-of-3 (`0xFD3A6DEE167C9B519fE7f646F91e9D80ba51Ed96`) | rotate the oracle, set the guardian, set fee (max 5%) and minimum tip, set the fee recipient, pause and unpause, relink a registered handle to a new wallet, withdraw fees, sweep tokens sent outside `tip()`, rescue non-escrow tokens | move or reduce any handle's pending balance; renounce ownership (disabled) |
| Guardian | an EOA the owner sets (may be unset) | pause | unpause, move funds, change anything |
| Fee recipient | Treasury Safe, 2-of-3 (`0x7EF8Aa263E3Bb8a151702108bD29932e50409990`) | withdraw accrued fees to itself | anything else |
| Oracle signer | `0x9e6D408256A3bDd0326C00df82136E843B7aDd97`, key only in the web host's environment | authorise claims | hold or move funds |

## Invariants the design rests on

- `balanceOf(this) >= totalPending + totalFeesCollected` at all times. `sweepExcessUSDC` can only move what is above that sum.
- A handle's pending balance leaves the contract only through `claimTips` with a valid oracle signature; there is no owner function that moves escrow.
- Every nonce is single use; signatures are bound to name `PayX`, version `2`, chain 5042 and the instance address, so a signature for one instance is useless on another.
- `platformFeeBps <= 500`; `minTipAmount > 0`; the fee recipient and claim wallet are never this contract.

## Patterns that look risky and are intentional

- **Owner can relink a registered handle (`adminRelinkWallet`) and rotate the oracle.** This is the recovery path for a lost wallet or a sold handle, deliberately kept behind the 2-of-3 Safe with an event trail. Combined, the two powers could redirect a handle's future claims; that is the trust placed in the Safe and documented as an accepted risk.
- **Claim signatures do not expire.** A signature is valid until its nonce is used. It can only ever pay the wallet named in it, so a stale signature cannot be turned against the handle owner.
- **No refund or expiry for unclaimed tips.** By design a payment waits indefinitely for its handle.
- **`setGuardian(address(0))`** is the documented way to disable the guardian role.
- **`tip()` writes state before the token transfer** (checks-effects-interactions); `nonReentrant` guards every function that moves tokens.
- The escrow tokens are Circle's native assets on Arc (USDC is a system precompile), trusted and not fee-on-transfer. `rescueToken` refuses the escrow token.

## Prior review

Pre-deployment internal audit on 2026-09-15 (GO with fixes, all applied before deployment: ownership renounce disabled, zero-value fee withdrawal rejected, minimum tip never zero, self-recipient guards, history pagination saturates). Suites: unit, fuzz (512 runs), handler-based invariants (256 runs, depth 50, fail on revert), mainnet fork checks. Slither clean apart from items classified in `OLYMPIX_SUBMISSION.md` at the repository root, which also holds the Olympix pre-audit findings and their tests (`test/PayXTipping.olympix.t.sol`).

The deployed bytecode of all three instances matches the audited build; post-review source changes apply to the next deployment and are listed in the submission file.
