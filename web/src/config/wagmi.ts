import { http, fallback, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { type Chain } from 'viem'
import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  avalanche,
  linea,
  unichain,
  worldchain,
  sonic,
  sei,
  xdc,
  ink,
  plumeMainnet,
  monad,
  morph,
  codex,
} from 'viem/chains'

// ─────────────────────────────────────────────────────────────────────────────
// ARC MAINNET (chain 5042) — the only Arc chain in this app. Testnet must never
// appear here (mainnet-conventions: chain hygiene).
//
// RPC strategy:
//   1. NEXT_PUBLIC_ARC_RPC_URL — Circle's public mainnet RPC once published
//      (set in Vercel env and redeploy; no code change needed).
//   2. /api/rpc — our own same-origin proxy that fronts the credentialed
//      Alchemy/QuickNode endpoints server-side (key never reaches the browser).
//      Wallets that need an absolute URL for wallet_addEthereumChain get
//      NEXT_PUBLIC_APP_URL + /api/rpc.
// ─────────────────────────────────────────────────────────────────────────────

export const ARC_CHAIN_ID = 5042

// The proxy is addressed by ABSOLUTE URL everywhere: wallets reject relative
// URLs in wallet_addEthereumChain, and wagmi passes the chain definition's RPC
// to that call. In the browser we use the current origin (works on previews and
// on the production domain alike); on the server, the configured app URL.
const APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

export const ARC_PROXY_RPC_URL = `${APP_URL}/api/rpc`

const CONFIGURED_PUBLIC_RPC =
  process.env.NEXT_PUBLIC_ARC_RPC_URL && !/alchemy\.com|quiknode\.pro|quicknode\.com/i.test(process.env.NEXT_PUBLIC_ARC_RPC_URL)
    ? process.env.NEXT_PUBLIC_ARC_RPC_URL
    : undefined

/** Public RPC (Circle) if configured; otherwise our proxy (absolute). Never a credentialed URL. */
export const ARC_PUBLIC_RPC_URL = CONFIGURED_PUBLIC_RPC ?? ARC_PROXY_RPC_URL

/** Absolute URL handed to wallets when adding chain 5042. */
export const ARC_WALLET_RPC_URL = CONFIGURED_PUBLIC_RPC ?? ARC_PROXY_RPC_URL

export const ARC_EXPLORER_URL =
  (process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://explorer.arc.io').replace(/\/$/, '')

export const arcMainnet: Chain = {
  id: ARC_CHAIN_ID,
  name: 'Arc',
  nativeCurrency: {
    decimals: 18, // native interface is 18dp; the ERC-20 interface at 0x3600… is 6dp
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: [ARC_PUBLIC_RPC_URL] },
    public: { http: [ARC_PUBLIC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: ARC_EXPLORER_URL },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
  testnet: false,
}

/** Explorer URL helpers (single place to change when Circle's explorer goes public). */
export const explorerTxUrl = (hash: string) => `${ARC_EXPLORER_URL}/tx/${hash}`
export const explorerAddressUrl = (addr: string) => `${ARC_EXPLORER_URL}/address/${addr}`

// Explicit primary RPC per bridge chain (public endpoints only — never credentialed)
export const CHAIN_RPC_URLS: Record<number, string> = {
  [arcMainnet.id]: ARC_PUBLIC_RPC_URL,
  [mainnet.id]: 'https://ethereum-rpc.publicnode.com',
  [arbitrum.id]: 'https://arb1.arbitrum.io/rpc',
  [base.id]: 'https://mainnet.base.org',
  [optimism.id]: 'https://mainnet.optimism.io',
  [polygon.id]: 'https://polygon-bor-rpc.publicnode.com',
  [avalanche.id]: 'https://api.avax.network/ext/bc/C/rpc',
  [linea.id]: 'https://rpc.linea.build',
  [unichain.id]: 'https://mainnet.unichain.org',
  [worldchain.id]: 'https://worldchain-mainnet.g.alchemy.com/public',
  [sonic.id]: 'https://rpc.soniclabs.com',
  [sei.id]: 'https://evm-rpc.sei-apis.com',
  [xdc.id]: 'https://rpc.xdcrpc.com',
  [ink.id]: 'https://rpc-gel.inkonchain.com',
  [plumeMainnet.id]: 'https://rpc.plume.org',
  [monad.id]: 'https://rpc.monad.xyz',
  [morph.id]: 'https://rpc.morphl2.io',
  [codex.id]: 'https://rpc.codex.xyz',
}

// Secondary RPCs for chains with known reliability issues
export const CHAIN_FALLBACK_RPCS: Partial<Record<number, string[]>> = {
  [arcMainnet.id]: [ARC_PROXY_RPC_URL],
  [mainnet.id]: ['https://eth.llamarpc.com', 'https://cloudflare-eth.com'],
  [base.id]: ['https://base-rpc.publicnode.com'],
  [arbitrum.id]: ['https://arbitrum-one-rpc.publicnode.com'],
  [optimism.id]: ['https://optimism-rpc.publicnode.com'],
  [polygon.id]: ['https://polygon.drpc.org'],
  [avalanche.id]: ['https://avalanche-c-chain-rpc.publicnode.com'],
}

// All chains the wallet may be asked to switch to (Arc first, always)
export const bridgeChains = [
  arcMainnet,
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  avalanche,
  linea,
  unichain,
  worldchain,
  sonic,
  sei,
  xdc,
  ink,
  plumeMainnet,
  monad,
  morph,
  codex,
] as const

function transportFor(chainId: number) {
  const primary = CHAIN_RPC_URLS[chainId]
  const extras = CHAIN_FALLBACK_RPCS[chainId] ?? []
  const urls = [primary, ...extras].filter((u, i, arr) => !!u && arr.indexOf(u) === i)
  return urls.length > 1 ? fallback(urls.map((u) => http(u))) : http(urls[0])
}

export const transports = Object.fromEntries(bridgeChains.map((c) => [c.id, transportFor(c.id)])) as Record<
  (typeof bridgeChains)[number]['id'],
  ReturnType<typeof transportFor>
>

/**
 * The wagmi config. Ships with the injected (EIP-6963) connector only, so the
 * shell carries no wallet SDKs. The RainbowKit wallet list (WalletConnect,
 * Coinbase, Safe, mobile wallets) is added at runtime by the wallet island
 * (src/components/wallet/WalletIsland.tsx) through wagmi's connector registry.
 */
export const config = createConfig({
  chains: bridgeChains,
  transports,
  connectors: [injected()],
  ssr: true,
})

// Dev only: lets the browser console inspect the live connector registry.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __xyloWagmi?: unknown }).__xyloWagmi = config
}

export { APP_URL }

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

// Build wallet_addEthereumChain params from viem chain definitions.
// For Arc we always hand the wallet an absolute https URL.
export function getAddChainParams(chainId: number) {
  const chain = bridgeChains.find((c) => c.id === chainId)
  if (!chain) return null
  return {
    chainId: '0x' + chainId.toString(16),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [chainId === ARC_CHAIN_ID ? ARC_WALLET_RPC_URL : CHAIN_RPC_URLS[chainId]],
    blockExplorerUrls: chain.blockExplorers?.default?.url
      ? [chain.blockExplorers.default.url]
      : undefined,
  }
}
