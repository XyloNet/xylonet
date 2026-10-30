// ─────────────────────────────────────────────────────────────────────────────
// LI.FI widget configuration for XyloNet (Arc mainnet, chain 5042).
//
// LI.FI has Arc registered (chain key `arc`, id 5042, LiFiDiamond
// 0xA4072583658Fae592A3506A42431cb6316a8d40b). Routing to/from Arc opens with
// the public mainnet launch; the widget is wired for Arc today and the UI
// states honestly when no route exists yet.
// ─────────────────────────────────────────────────────────────────────────────

import type { WidgetConfig } from '@lifi/widget'
import { lifiTheme } from './theme'
import { walletStore } from '@/lib/wallet/store'
import type { StaticToken } from '@lifi/sdk'
import { CONTRACTS, LIFI, TOKENS } from '@/config/constants'
import { ARC_CHAIN_ID, ARC_PUBLIC_RPC_URL, ARC_EXPLORER_URL, bridgeChains } from '@/config/wagmi'

export type LiFiMode = 'swap' | 'bridge'

/** Every chain the app's wagmi config knows about (Arc first). */
export const LIFI_ALLOWED_CHAIN_IDS: number[] = bridgeChains.map((c) => c.id)

/** Number of chains LI.FI can route across in this app. */
export const LIFI_CHAIN_COUNT = LIFI_ALLOWED_CHAIN_IDS.length

/** Default "from" chain for the bridge tab — Base (largest USDC venue among our chains). */
export const LIFI_BRIDGE_DEFAULT_FROM_CHAIN = 8453

/** Absolute logo URLs (the widget renders them from any origin). */
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

/**
 * Circle stablecoins on Arc as LI.FI static tokens (pinned in the widget's
 * token list). `chainId` is cast because `@lifi/types`' ChainId enum does not
 * list Arc yet.
 */
const LIFI_USDC_STATIC: StaticToken = {
  chainId: ARC_CHAIN_ID as StaticToken['chainId'],
  address: TOKENS.USDC.address,
  symbol: TOKENS.USDC.symbol,
  name: TOKENS.USDC.name,
  decimals: TOKENS.USDC.decimals,
  logoURI: `${SITE_ORIGIN}/tokens/usdc.svg`,
}

const LIFI_EURC_STATIC: StaticToken = {
  chainId: ARC_CHAIN_ID as StaticToken['chainId'],
  address: TOKENS.EURC.address,
  symbol: TOKENS.EURC.symbol,
  name: TOKENS.EURC.name,
  decimals: TOKENS.EURC.decimals,
  logoURI: `${SITE_ORIGIN}/tokens/eurc.png`,
}

/** Tokens pinned at the top of the widget's Arc token list. */
export const LIFI_ARC_TOKENS: NonNullable<WidgetConfig['tokens']> = {
  featured: [LIFI_USDC_STATIC, LIFI_EURC_STATIC],
  popular: [LIFI_USDC_STATIC, LIFI_EURC_STATIC],
}

export { lifiTheme } from './theme'

/** Preset destination tokens on Arc for the swap / bridge deep links. */
export type LiFiArcTarget = 'EURC' | 'USDC'

export const LIFI_ARC_TARGET_ADDRESS: Record<LiFiArcTarget, `0x${string}`> = {
  USDC: TOKENS.USDC.address,
  EURC: TOKENS.EURC.address,
}

/**
 * Build the widget config for a given mode.
 * - swap:   same-chain on Arc (5042 → 5042), USDC → EURC by default.
 * - bridge: any token on any chain → USDC on Arc, from Base by default.
 */
export function buildLiFiConfig(
  mode: LiFiMode,
  overrides: Partial<WidgetConfig> = {},
  appearance: 'light' | 'dark' = 'light',
): WidgetConfig {
  const base: WidgetConfig = {
    integrator: LIFI.integrator,
    variant: 'compact',
    subvariant: 'default',
    appearance,
    theme: lifiTheme,
    // Fees are visible before signing, always.
    defaultUI: { transactionDetailsExpanded: true },
    // The widget's connect button opens our (lazily loaded) wallet modal.
    walletConfig: { onConnect: () => walletStore.requestConnect() },
    // Only chains our WagmiProvider can switch to. The widget reuses our wagmi
    // context automatically, so every allowed chain must exist in wagmi config.
    // All allowed ids are EVM chains, so no `types` filter is needed.
    chains: {
      allow: LIFI_ALLOWED_CHAIN_IDS,
    },
    hiddenUI: ['appearance', 'language', 'walletMenu', 'poweredBy'],
    tokens: LIFI_ARC_TOKENS,
    // Arc reads go through our public RPC / same-origin proxy — never a
    // credentialed URL in client code.
    // `@lifi/types`' ChainId enum does not list Arc yet (the widget resolves the
    // live chain list from the LI.FI API at runtime, where Arc is registered),
    // so the numeric key is cast to the SDK's rpcUrls map type.
    sdkConfig: {
      rpcUrls: {
        [ARC_CHAIN_ID]: [ARC_PUBLIC_RPC_URL],
      } as unknown as NonNullable<NonNullable<WidgetConfig['sdkConfig']>['rpcUrls']>,
      // Classic approve → swap only. The EIP-2612/Permit2 signature path reverted
      // on Arc ("Call failed" via Permit2Proxy) and permits are one more thing
      // for wallet scanners to misread. Batching is disabled separately
      // (see disableWalletBatching.ts).
      executionOptions: {
        disableMessageSigning: true,
      },
    },
    explorerUrls: {
      [ARC_CHAIN_ID]: [{ url: ARC_EXPLORER_URL, txPath: 'tx', addressPath: 'address' }],
    },
    // Partner fee only once the integrator is registered in portal.li.fi.
    // Integrator fee — ONLY when the transaction starts on Arc. On Arc the LI.FI
    // fee receiver is the Treasury Safe (a contract with history); on other chains
    // it is a plain EOA that MetaMask/Blockaid flags as "untrusted" on large
    // amounts, so cross-chain routes into Arc stay fee-free until that is solved.
    ...(LIFI.fee !== undefined
      ? {
          feeConfig: {
            name: 'XyloNet',
            showFeePercentage: true,
            calculateFee: async ({ fromChain }) => (fromChain.id === ARC_CHAIN_ID ? LIFI.fee : 0),
          },
        }
      : {}),
  }

  const modeConfig: Partial<WidgetConfig> =
    mode === 'swap'
      ? {
          fromChain: ARC_CHAIN_ID,
          toChain: ARC_CHAIN_ID,
          fromToken: CONTRACTS.USDC,
          toToken: CONTRACTS.EURC,
        }
      : {
          fromChain: LIFI_BRIDGE_DEFAULT_FROM_CHAIN,
          toChain: ARC_CHAIN_ID,
          toToken: CONTRACTS.USDC,
        }

  return { ...base, ...modeConfig, ...overrides }
}
