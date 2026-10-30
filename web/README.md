# XyloNet — web (Arc mainnet)

Front-end for XyloNet, the Stablecoin SuperExchange on **Arc mainnet (chain 5042)**.

- **Swap** — any token, any chain, routed by LI.FI (`/swap`)
- **Bridge** — native USDC via Circle CCTP v2 (Arc domain 26) + any-token routes via LI.FI (`/bridge`)
- **PayX** — tip any X handle in USDC; recipients claim with an X login (`/payx`, `/payx/tip`, `/payx/claim`)
- **Docs** — network, contracts, integration (`/docs`)

## Stack

Next.js 16 (App Router) · React 18 · TypeScript · Tailwind 4 · wagmi 2 / viem 2 · RainbowKit 2

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values — see comments in .env.example
npm run dev
```

Key environment variables (see `.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `ARC_RPC_URL`, `ARC_RPC_FALLBACK_URL` | Server-only credentialed RPC upstreams, fronted by `/api/rpc` |
| `RPC_ALLOWED_ORIGINS` | Optional extra web origins granted the full `/api/rpc` method set (our domains, Vercel previews and same-host are always trusted; extensions and no-Origin wallets get a minimal method set; other origins are refused) |
| `NEXT_PUBLIC_ARC_RPC_URL` | Optional public Arc RPC (Circle). Leave empty to use `/api/rpc` |
| `NEXT_PUBLIC_ARC_EXPLORER_URL` | Explorer base URL (default `https://explorer.arc.io`) |
| `NEXT_PUBLIC_PAYX_CONTRACT_ADDRESS` | PayX v2 address, set after deployment |
| `NEXT_PUBLIC_LIFI_INTEGRATOR`, `NEXT_PUBLIC_LIFI_FEE` | LI.FI integrator id and optional fee |
| `TWITTER_*`, `SESSION_SECRET`, `ORACLE_PRIVATE_KEY` | PayX X-login and claim signing (server-only) |

Never commit `.env.local`; `.gitignore` ignores every `.env*` except `.env.example`.

## Chain hygiene

This app targets Arc mainnet only. Chain, RPC and explorer configuration live in `src/config/wagmi.ts`;
contract addresses live in `src/config/constants.ts`. Credentialed RPC URLs must never appear in client code.

## Layout

```
src/app            routes: /, /swap, /bridge, /payx/**, /docs/**, /privacy, /terms, /api/rpc, /api/payx/**
src/components     Header, Footer, landing/*, swap/*, bridge/*, ui/*
src/config         wagmi.ts (chain + transports), constants.ts (addresses), abis/
src/lib            payx helpers, session, utils
```

## Deploy

Vercel. Set the environment variables above in the project settings and deploy `main`.

## Points (Season 1)

`/points` shows a derived loyalty ledger: 1 point per $1 swapped, bridged or tipped, plus activity and
first-time bonuses (rules in `src/lib/points/rules.ts`). Data comes from LI.FI transfer records for the
`xylonet` integrator and PayX contract events on Arc; nothing is stored that cannot be rebuilt.

- Snapshot store: `.data/points/` locally (gitignored); Upstash Redis on Vercel when
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set; memory otherwise.
- Full backfill (once per fresh store, ~3 min against Circle's public RPC):
  `curl -X POST "http://localhost:3100/api/points/sync?mode=full"` (protected by `POINTS_ADMIN_KEY` outside dev).
- API: `GET /api/points/leaderboard`, `GET /api/points/wallet/:address`, `GET /api/points/rules`.
