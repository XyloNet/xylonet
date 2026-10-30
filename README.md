# XyloNet

The money app on [Arc](https://www.arc.network): pay anyone on X in USDC, exchange USDC and EURC, and move native USDC between chains. Live at [xylonet.xyz](https://www.xylonet.xyz).

This repository is the public mirror of XyloNet's mainnet code. It is updated automatically from the private working repository on every release; internal plans, audits and operations notes stay private.

## What is here

| Path | What it is |
| --- | --- |
| `web/` | The Next.js app behind xylonet.xyz: Pay (PayX), Exchange, Bridge, Points, Trust, docs, and the API routes they use. |
| `payx/contracts/` | `PayXTipping` v2, the escrow contract behind payments to X handles (Foundry project, tests included). |
| `payx/extension/` | The PayX Chrome extension. |
| `payx/tools/` | Deployment, smoke-test and status scripts for the PayX contracts. |
| `safe/` | Scripts that deployed and verified the two 2-of-3 Safes that own and receive fees from the contracts. |
| `web/scripts/reconcile.mjs` | Read-only reconciliation of PayX events and LI.FI integrator fees against token transfers on Arc. |
| `docs/ADDRESS_BOOK.md` | Every mainnet address XyloNet uses, verified on chain. |

## How it works

- Exchanges and any-token bridges are quoted and executed through [LI.FI](https://li.fi); XyloNet adds a 0.1% fee on routes that start on Arc, shown before you sign.
- Native USDC bridging uses Circle's CCTP v2 and Circle Gateway through the Circle App Kit.
- Payments to X handles sit in the `PayXTipping` contract under the handle until the owner signs in with X and claims. The contract is owned by a 2-of-3 Safe with no path to user escrow. Live solvency is published at [xylonet.xyz/trust](https://www.xylonet.xyz/trust).

## Running the app

```bash
cd web
npm install
cp .env.example .env.local   # fill in what you need; see the comments in the file
npm run dev
```

The contracts build and test with [Foundry](https://book.getfoundry.sh):

```bash
cd payx/contracts
forge test
```

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## License

MIT, see [LICENSE](LICENSE).
