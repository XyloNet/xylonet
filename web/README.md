# XyloNet — web (Arc mainnet)

The app behind [xylonet.xyz](https://www.xylonet.xyz), on **Arc mainnet (chain 5042)**.

- **Pay** — pay any X handle or address in USDC (PayX); recipients claim with an X sign-in (`/pay`, `/pay/creator`, `/to/<handle>`)
- **Exchange** — USDC and EURC on Arc, any other token via LI.FI (`/exchange`)
- **Bridge** — native USDC via Circle CCTP v2 and Circle Gateway, any token via LI.FI (`/bridge`)
- **Points**, **Trust**, **Docs** (`/points`, `/trust`, `/docs`)
- **Admin** — private team analytics behind an X sign-in allowlist (`/admin`)

## Stack

Next.js 16 (App Router) · React 18 · TypeScript · Tailwind 4 · wagmi 2 / viem 2 · RainbowKit 2 · LI.FI widget and API · Circle App Kit

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values — see comments in .env.example
npm run dev
```

Every variable is documented in `.env.example`. Secrets (RPC credentials, the oracle signing key, the session secret, X OAuth, store tokens) exist only in the host's environment; never commit `.env.local`.

## Chain hygiene

This app targets Arc mainnet only. Chain, RPC and explorer configuration live in `src/config/wagmi.ts`; contract addresses in `src/config/constants.ts`. Credentialed RPC URLs never appear in client code: browser reads go through the same-origin proxy at `/api/rpc`, which allowlists origins and methods.

## Layout

```
src/app            routes: /, /pay/**, /to/[handle], /exchange, /bridge, /points, /dashboard, /activity, /trust, /docs/**, /admin, /api/**
src/components     shell/*, home/*, pay/*, exchange/*, bridge/*, unified/*, wallet/*, xylo/* (design system), ui/*
src/config         wagmi.ts (chains + transports), constants.ts (addresses), abis/
src/lib            payx (oracle, sessions, feeds), points (derived ledger), admin, bridge, unified, lifi, push, trust, og
```

## Checks

`npm run typecheck`, `npm run lint`, and `npm run build` (which also runs the design-token lint in `scripts/check-tokens.mjs`).

## Points (Season 1)

`/points` shows a derived ledger: 1 point per $1 exchanged, bridged or paid, plus activity and first-time bonuses (rules in `src/lib/points/rules.ts`). Data comes from LI.FI transfer records for the `xylonet` integrator and PayX contract events on Arc; nothing is stored that cannot be rebuilt. The public API never exposes platform totals: `GET /api/points/leaderboard` (top 100), `GET /api/points/wallet/:address`, `GET /api/points/rules`.
