// ─────────────────────────────────────────────────────────────────────────────
// ARC MAINNET (chain 5042) — verified on-chain address book.
// Source of truth: ../../docs/ADDRESS_BOOK.md (mainnet workspace).
// Testnet addresses differ and must NEVER be pasted here.
// ─────────────────────────────────────────────────────────────────────────────

const ZERO = '0x0000000000000000000000000000000000000000' as const

function toAddress(v: string | undefined, fallbackValue: `0x${string}` = ZERO): `0x${string}` {
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : fallbackValue
}

export const CONTRACTS = {
  // Stablecoins (Circle)
  USDC: '0x3600000000000000000000000000000000000000' as `0x${string}`, // system predeploy, 6dp ERC-20
  EURC: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1' as `0x${string}`,
  // Circle wrapped Bitcoin (FiatTokenProxy, 8dp). Source: docs.arc.io contract addresses, verified onchain 2026-10-04.
  CIRBTC: '0x171A4217b86A807A64eB94757Db6849fb4bDbAA0' as `0x${string}`,

  // CCTP v2 (Arc domain 26)
  TOKEN_MESSENGER_V2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d' as `0x${string}`,
  MESSAGE_TRANSMITTER_V2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64' as `0x${string}`,
  TOKEN_MINTER_V2: '0xfd78EE919681417d192449715b2594ab58f5D002' as `0x${string}`,

  // Gateway
  GATEWAY_WALLET: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE' as `0x${string}`,
  GATEWAY_MINTER: '0x2222222d7164433c4C09B0b0D809a9b52C04C205' as `0x${string}`,

  // StableFX
  FX_ESCROW: '0xe2E5F173576B513d994073CCbDaCBE027d43DFe6' as `0x${string}`,

  // Common
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11' as `0x${string}`,

  // XyloNet governance (Safe v1.4.1, 2-of-3)
  ADMIN_SAFE: '0xFD3A6DEE167C9B519fE7f646F91e9D80ba51Ed96' as `0x${string}`,
  TREASURY_SAFE: '0x7EF8Aa263E3Bb8a151702108bD29932e50409990' as `0x${string}`,

  // XyloNet product contracts (PayX v2). NOTE: the env var MUST be read by its
  // literal name — Next.js only inlines NEXT_PUBLIC_* into client bundles for
  // literal `process.env.NAME` accesses, never for `process.env[name]`.
  PAYX: toAddress(process.env.NEXT_PUBLIC_PAYX_CONTRACT_ADDRESS),
  PAYX_EURC: toAddress(process.env.NEXT_PUBLIC_PAYX_EURC_CONTRACT_ADDRESS),
  PAYX_CIRBTC: toAddress(process.env.NEXT_PUBLIC_PAYX_CIRBTC_CONTRACT_ADDRESS),

  // LI.FI (Arc mainnet)
  LIFI_DIAMOND: '0xA4072583658Fae592A3506A42431cb6316a8d40b' as `0x${string}`,
  LIFI_FEE_FORWARDER: '0xEDff4051B8286d2333149429F019dC10E23570da' as `0x${string}`,
} as const

export const ZERO_ADDRESS = ZERO
/** True when the USDC PayX instance is configured (legacy name — see isPayXAssetLive for the others). */
export const isPayXDeployed = () => CONTRACTS.PAYX !== ZERO

// Token information (Arc mainnet)
export const TOKENS = {
  USDC: {
    address: CONTRACTS.USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: '/tokens/usdc.svg',
  },
  EURC: {
    address: CONTRACTS.EURC,
    symbol: 'EURC',
    name: 'Euro Coin',
    decimals: 6,
    logo: '/tokens/eurc.png',
  },
  CIRBTC: {
    address: CONTRACTS.CIRBTC,
    symbol: 'cirBTC',
    name: 'Circle Wrapped Bitcoin',
    decimals: 8,
    logo: '/tokens/cirbtc.svg',
  },
} as const

export type TokenInfo = (typeof TOKENS)[keyof typeof TOKENS]

// ─────────────────────────────────────────────────────────────────────────────
// PayX assets. Each tipping asset has its OWN PayXTipping v2 instance (the
// escrow token is immutable per contract), its own EIP-712 domain and its own
// claims. Everything in the app is keyed off this registry — never hardcode
// decimals or the USDC address in shared PayX code.
// ─────────────────────────────────────────────────────────────────────────────

export type PayXAssetKey = 'USDC' | 'EURC' | 'CIRBTC'

export interface PayXAsset {
  key: PayXAssetKey
  token: TokenInfo
  /** PayXTipping v2 instance escrowing this token (zero address until deployed). */
  contract: `0x${string}`
  /** Fallback minimum tip in human units (the live value is read from minTipAmount()). */
  minTipHuman: string
  /** Fallback fee in bps (the live value is read from platformFeeBps()). */
  feeBpsFallback: bigint
  quickPicks: readonly string[]
  /** Default amount preselected in the tip form. */
  defaultAmount: string
  /** Display: "$" prefix for dollar-denominated assets, none otherwise. */
  currencyPrefix: string
  /** Display: min/max fraction digits when formatting amounts. */
  fractionDigits: { min: number; max: number }
  /** Block the instance was deployed at (bounds event scans; 0 = unknown). */
  deploymentBlock: number
}

export const PAYX_ASSET_KEYS: readonly PayXAssetKey[] = ['USDC', 'EURC', 'CIRBTC'] as const

export const PAYX_ASSETS: Record<PayXAssetKey, PayXAsset> = {
  USDC: {
    key: 'USDC',
    token: TOKENS.USDC,
    contract: CONTRACTS.PAYX,
    minTipHuman: '0.1',
    feeBpsFallback: 100n,
    quickPicks: ['1', '5', '10', '25'],
    defaultAmount: '5',
    currencyPrefix: '$',
    fractionDigits: { min: 2, max: 2 },
    deploymentBlock: Number(process.env.NEXT_PUBLIC_PAYX_DEPLOYMENT_BLOCK ?? 0) || 0,
  },
  EURC: {
    key: 'EURC',
    token: TOKENS.EURC,
    contract: CONTRACTS.PAYX_EURC,
    minTipHuman: '0.1',
    feeBpsFallback: 100n,
    quickPicks: ['1', '5', '10', '25'],
    defaultAmount: '5',
    currencyPrefix: '€',
    fractionDigits: { min: 2, max: 2 },
    deploymentBlock: Number(process.env.NEXT_PUBLIC_PAYX_EURC_DEPLOYMENT_BLOCK ?? 0) || 0,
  },
  CIRBTC: {
    key: 'CIRBTC',
    token: TOKENS.CIRBTC,
    contract: CONTRACTS.PAYX_CIRBTC,
    // 100 sats; with the 1% fee that is the smallest tip whose fee is a whole satoshi.
    minTipHuman: '0.000001',
    feeBpsFallback: 100n,
    quickPicks: ['0.00001', '0.00005', '0.0001', '0.001'],
    defaultAmount: '0.00005',
    currencyPrefix: '',
    fractionDigits: { min: 0, max: 8 },
    deploymentBlock: Number(process.env.NEXT_PUBLIC_PAYX_CIRBTC_DEPLOYMENT_BLOCK ?? 0) || 0,
  },
}

export function isPayXAssetKey(v: unknown): v is PayXAssetKey {
  return typeof v === 'string' && (PAYX_ASSET_KEYS as readonly string[]).includes(v)
}

/** Parse a user-supplied asset key (query string, JSON body); null when unknown. */
export function parsePayXAssetKey(v: unknown): PayXAssetKey | null {
  if (typeof v !== 'string') return null
  const upper = v.trim().toUpperCase()
  return isPayXAssetKey(upper) ? upper : null
}

/** True when this asset's PayX instance is configured (non-zero contract). */
export const isPayXAssetLive = (key: PayXAssetKey) => PAYX_ASSETS[key].contract !== ZERO

/** Alias requested by the product spec. */
export const isAssetLive = isPayXAssetLive

/** Assets whose PayX instance is live, in display order (USDC first). */
export const livePayXAssets = (): PayXAsset[] => PAYX_ASSET_KEYS.filter(isPayXAssetLive).map((k) => PAYX_ASSETS[k])

/** "A", "A and B", "A, B and C" — for copy that lists things. */
function joinList(items: readonly string[], conjunction: 'and' | 'or'): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`
}

/** Symbols of the tipping assets for copy: "USDC" today, "USDC and EURC" once EURC is in the registry. */
export const payXAssetSymbolList = (conjunction: 'and' | 'or' = 'and', keys: readonly PayXAssetKey[] = PAYX_ASSET_KEYS): string =>
  joinList(keys.map((k) => PAYX_ASSETS[k].token.symbol), conjunction)

/** Minimum tips for copy: "0.1 USDC" today, "0.1 USDC or 10 EURC" later. */
export const payXMinTipList = (conjunction: 'and' | 'or' = 'or', keys: readonly PayXAssetKey[] = PAYX_ASSET_KEYS): string =>
  joinList(keys.map((k) => `${PAYX_ASSETS[k].minTipHuman} ${PAYX_ASSETS[k].token.symbol}`), conjunction)

/** Resolve an asset from a PayX contract address (for event logs). */
export function payXAssetByContract(address: string): PayXAsset | null {
  const lower = address.toLowerCase()
  for (const key of PAYX_ASSET_KEYS) {
    const a = PAYX_ASSETS[key]
    if (a.contract !== ZERO && a.contract.toLowerCase() === lower) return a
  }
  return null
}

// CCTP domains (for display / analytics — App Kit manages the actual routing)
export const SUPPORTED_CHAINS = [
  { id: 5042, name: 'Arc', domain: 26, logo: '/chains/5042.png' },
  { id: 1, name: 'Ethereum', domain: 0, logo: '/chains/1.svg' },
  { id: 42161, name: 'Arbitrum', domain: 3, logo: '/chains/42161.svg' },
  { id: 8453, name: 'Base', domain: 6, logo: '/chains/8453.svg' },
  { id: 10, name: 'OP Mainnet', domain: 2, logo: '/chains/10.svg' },
  { id: 137, name: 'Polygon', domain: 7, logo: '/chains/137.svg' },
  { id: 43114, name: 'Avalanche', domain: 1, logo: '/chains/43114.svg' },
] as const

// Arc Network Info
export const ARC_NETWORK = {
  chainId: 5042,
  name: 'Arc',
  explorer: (process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://explorer.arc.io').replace(/\/$/, ''),
  docs: 'https://docs.arc.io',
} as const

// LI.FI integration (partner integration — fees route to the Treasury Safe via LI.FI's FeeForwarder)
export const LIFI = {
  integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || 'xylonet',
  /** Fraction, e.g. 0.001 = 0.1%. Only applied once the integrator is registered in portal.li.fi. */
  // Fee fraction (0.001 = 0.1%). Applied only to routes that START on Arc — see
  // src/lib/lifi/config.ts (calculateFee). Off on other source chains until the
  // fee receiver there is a wallet-scanner-recognised address.
  fee: process.env.NEXT_PUBLIC_LIFI_FEE ? Number(process.env.NEXT_PUBLIC_LIFI_FEE) : 0.001,
} as const
