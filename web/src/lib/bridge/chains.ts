// Bridge chain table: Arc mainnet plus Bridge Kit's mainnet definitions that
// our wagmi config can switch to. Imported only by the lazily loaded bridge
// module (Bridge Kit's chain table is large).
import type { ChainDefinition } from '@circle-fin/bridge-kit'
import {
  Arc,
  Ethereum,
  Arbitrum,
  Base,
  Optimism,
  Polygon,
  Avalanche,
  Linea,
  Unichain,
  WorldChain,
  Sonic,
  Sei,
  XDC,
  Ink,
  Plume,
  Monad,
  Morph,
  Codex,
} from '@circle-fin/bridge-kit/chains'
import { bridgeChains } from '@/config/wagmi'

/**
 * Bridge Kit ships Arc mainnet natively (with Circle's Forwarding Service as a
 * destination). Set NEXT_PUBLIC_ARC_FORWARDER_SUPPORTED=false to force the
 * classic approve → burn → attest → mint flow into Arc.
 */
const ARC_FORWARDER_SUPPORTED = process.env.NEXT_PUBLIC_ARC_FORWARDER_SUPPORTED !== 'false'

export interface BridgeChain {
  id: string
  name: string
  chainId: number
  def: ChainDefinition
  /** Native gas token symbol on this chain. */
  gasSymbol: string
  /** Standard-only sources (CCTP fast transfer unavailable). */
  standardOnly?: boolean
}

const WAGMI_IDS = new Set<number>(bridgeChains.map((c) => c.id))
const COUNTERPARTIES: readonly ChainDefinition[] = [Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea, Unichain, WorldChain, Sonic, Sei, XDC, Ink, Plume, Monad, Morph, Codex]
// Per Circle: fast transfer is unavailable from these sources.
const STANDARD_ONLY = new Set([43114, 137, 1329, 50])

function toEntry(def: ChainDefinition): BridgeChain | null {
  if (def.type !== 'evm' || def.isTestnet || !def.cctp?.contracts.v2 || !def.usdcAddress) return null
  if (!WAGMI_IDS.has(def.chainId)) return null
  return {
    id: String(def.chain),
    name: def.name,
    chainId: def.chainId,
    def,
    gasSymbol: def.nativeCurrency?.symbol ?? 'ETH',
    standardOnly: STANDARD_ONLY.has(def.chainId),
  }
}

export const ARC: BridgeChain = {
  id: String(Arc.chain),
  name: 'Arc',
  chainId: Arc.chainId,
  def: Arc,
  gasSymbol: 'USDC',
}

export const COUNTERPARTY_CHAINS: readonly BridgeChain[] = COUNTERPARTIES.map(toEntry).filter((e): e is BridgeChain => e !== null)

export const ALL_BRIDGE_CHAINS: readonly BridgeChain[] = [ARC, ...COUNTERPARTY_CHAINS]

export function chainByChainId(chainId: number): BridgeChain | undefined {
  return ALL_BRIDGE_CHAINS.find((c) => c.chainId === chainId)
}

export function explorerTx(def: ChainDefinition, hash: string): string {
  return def.explorerUrl.replace('{hash}', hash)
}

/** Explorer base (without the /tx/{hash} suffix) for the Address component. */
export function explorerBase(def: ChainDefinition): string {
  return def.explorerUrl.replace(/\/tx\/\{hash\}$/, '')
}

export function canUseForwarder(dest: BridgeChain): boolean {
  if (!ARC_FORWARDER_SUPPORTED) return false
  return dest.def.cctp?.forwarderSupported?.destination === true
}

/** Honest time expectations per Circle's published attestation behaviour. */
export function expectedTime(source: BridgeChain, dest: BridgeChain, speed: 'FAST' | 'SLOW'): string {
  if (source.chainId === ARC.chainId) return speed === 'FAST' ? 'seconds' : 'about a minute'
  if (speed === 'SLOW') return source.chainId === 1 ? 'about 15 minutes' : 'about 15 minutes'
  return dest.chainId === ARC.chainId ? 'under a minute' : 'about a minute'
}
