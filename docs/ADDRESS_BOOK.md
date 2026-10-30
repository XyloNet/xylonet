# XyloNet Mainnet — Address Book (Arc, chain 5042)

Single source of truth for every XyloNet address on Arc mainnet. Update on every deploy.

## Multisig (deployed 2026-08-18)

| Name | Address | Details |
|---|---|---|
| **XyloNet Admin Safe** | `0xFD3A6DEE167C9B519fE7f646F91e9D80ba51Ed96` | Safe v1.4.1 (SafeL2), 2-of-3. Will own all contracts. Tx `0x474cced4ba86c071ccd591070284d91e43d31f5bced193e375df7e3ee345dd42`, block 16104800, saltNonce 20260818001 |
| **XyloNet Treasury Safe** | `0x7EF8Aa263E3Bb8a151702108bD29932e50409990` | Safe v1.4.1 (SafeL2), 2-of-3. All fee flows. Tx `0x0ca15615436a8188e266a60d1704975b650ecfaa655df231f88a5f0e136dfa5d`, block 16104822, saltNonce 20260818002 |

**Status:**
- **Admin Safe: ✅ REHEARSAL PASSED 2026-08-18** — 1 USDC → deployer, 2-of-3, exec tx `0x7a4e777f413153318d940b04a926e67e7eaa8a1c373316638e65ca172473253c` block 16125313. **Cleared to own contracts.**
- **Treasury Safe: ✅ REHEARSAL PASSED** — round 1 executed 2026-08-20 (`0x999fe5d3…2f96`), round 2 by the third signer (Safe nonce now 2, verified on-chain 2026-09-15). Cleared to receive fee flows.

## Safe owners (both Safes, threshold 2-of-3)

Three co-founder wallets, one each. Which wallet belongs to whom is deliberately not written down here.

| Wallet | Address |
|---|---|
| XYLO-SIGNER-1 | `0xdF06689771B15911e5197191d378381A1F5B8724` |
| XYLO-SIGNER-2 | `0xEe5395960fA7fbb8eEEd4437De012B29dFe65A68` |
| XYLO-SIGNER-3 | `0x39E5633988d95973Da3024F13416282eaa784a6B` |

## Operational EOAs

| Wallet | Address | Role |
|---|---|---|
| XYLO-DEPLOYER-01 | `0xCb4d137f4057cD522093aF706fe2f771F74DFC00` | Deploys + proposes. Never an owner. ~93.97 USDC |
| (burned, never reuse) | `0x94e0dc7AD29b94EC9819f6cEC3364DD34f41b3c6` | Old testnet EOA — dead |

## Canonical infrastructure (Circle/Safe — verified on-chain, not ours)

| Contract | Address |
|---|---|
| USDC (system predeploy, 6dp ERC-20) | `0x3600000000000000000000000000000000000000` |
| Safe SafeL2 singleton v1.4.1 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` |
| Safe ProxyFactory v1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| Safe CompatibilityFallbackHandler | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |
| Safe MultiSend / MultiSendCallOnly | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` / `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| CCTP v2 TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` |
| CCTP v2 MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |
| EURC | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` |
| CCTP v2 TokenMinterV2 | `0xfd78EE919681417d192449715b2594ab58f5D002` |
| Gateway Wallet / Minter | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` / `0x2222222d7164433c4C09B0b0D809a9b52C04C205` |
| LI.FI LiFiDiamond (Arc mainnet) | `0xA4072583658Fae592A3506A42431cb6316a8d40b` |
| LI.FI FeeForwarder (Arc mainnet) | `0xEDff4051B8286d2333149429F019dC10E23570da` |

## Product contracts

| Name | Address | Details |
|---|---|---|
| **PayXTipping v2** | `0x47d4164F2f65afc00c7ba932cbEC9858b5FDAf0A` | Deployed 2026-09-15, tx `0xb59022545c48bb7c086980dcb8126effb155c595f8a16e79d97015c11b08fd39`, block 20936229, solc 0.8.30 / 200 runs / cancun, commit 4d133c9. **owner = Admin Safe** (transferOwnership tx `0x93536ade…3df4ed` 2026-09-15; acceptOwnership executed by the Safe 2026-09-16, Safe nonce 1). Smoke test passed 2026-09-15: tip `0xcda900df4766209f02ebfdc8e23f7a53615a0fedef57ab19696916e01707c02f`, claim `0xfd3c6586fc5247e8a685c476ed10e83adbe12af8ef7d1ade4822befaa53e3738`; @panchu2605 linked to `0xBBAFfA47bB6cD34f0fB91Ed55C1b31e09B7c896a`. First-ever mainnet tip: 1 USDC → @samconnerone (block 20938428, unclaimed); feeRecipient Treasury Safe; 100 bps; minTip 100000; EIP-712 domainSeparator `0x85c2fa59cc6133afcf2b7613fdd76ac138b04cb7b0ad890282913e1644f420fc` |
| **PayXTipping v2 (EURC)** | `0xB9E6b729425DB5565E8caFCE6d35E820FaE7d1ca` | Deployed 2026-10-04, tx `0x3a5056b34207ef00bdc52c0185e4a364794e8a5406b36fc77ee89e7514e0a03e`, block 24213517. Escrow token EURC `0xbEf5…21c1`, minTip 0.1 EURC, 100 bps, feeRecipient Treasury Safe, oracle XYLO-ORACLE-01. **owner = Admin Safe** (acceptOwnership executed 2026-10-04, Safe nonce 2, safeTxHash `0xee26f420…af76`, tx `0xe80f6f7a54d6d165f7ae0d71353ec56c6f6136a90a9f4264e58a31972f470c5a`, block 24221353) |
| **PayXTipping v2 (cirBTC)** | `0x1de44961059A0E4516fF56379EB77B1c4Da62f87` | Deployed 2026-10-04, tx `0x2d73dddb179db49c95d0a9060abad3b2ce0249cbe40ddc46b0bee57ed556e4c5`, block 24213560. Escrow token cirBTC `0x171A…bAA0` (8dp), minTip 0.000001 cirBTC, 100 bps, feeRecipient Treasury Safe, oracle XYLO-ORACLE-01. **owner = Admin Safe** (same Safe batch, nonce 2, tx `0xe80f6f7a54d6d165f7ae0d71353ec56c6f6136a90a9f4264e58a31972f470c5a`) |
| XYLO-ORACLE-01 | `0x9e6D408256A3bDd0326C00df82136E843B7aDd97` | claim-signing EOA, never holds funds (key only in Vercel env) |
