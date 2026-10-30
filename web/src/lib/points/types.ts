/**
 * XyloNet Points — shared types.
 *
 * Everything in the points system is DERIVED from public data (LI.FI transfer
 * records for the `xylonet` integrator + PayX contract events on Arc). The
 * snapshot is a cache of normalized events plus sync cursors; deleting it and
 * re-syncing reproduces the exact same ledger.
 */

export type PointsEventKind = 'swap' | 'bridge' | 'tip_sent' | 'tip_received'

export interface PointsEvent {
  /** Globally unique: `lifi:<transactionId>` or `payx:<txHash>:<logIndex>`. */
  id: string
  kind: PointsEventKind
  /** Lower-cased EOA that performed the action (tipper, swapper, bridger, claimer). */
  wallet: string
  /** USD value of the action at execution time (LI.FI amountUSD; USDC = 1). */
  usd: number
  /** Unix seconds. */
  ts: number
  txHash: string
  /** Source chain for swaps/bridges; 5042 for PayX. */
  chainId: number
  /** Destination chain for bridges. */
  toChainId?: number
  /** PayX: the X handle tipped / claimed. */
  handle?: string
  /** LI.FI tool key (kyberswap, across, ...). */
  tool?: string
  fromSymbol?: string
  toSymbol?: string
  /** XyloNet's fee on this action, in USD (LI.FI fee legs to the Treasury Safe; PayX platform fee). Absent on events ingested before fee tracking. */
  feeUsd?: number
  /** Token the fee was taken in (USDC, EURC, cirBTC, ...). */
  feeSymbol?: string
  /** Fee in token units (human, not base units). */
  feeAmount?: number
}

export interface SyncCursors {
  /** Unix seconds up to which LI.FI transfers have been ingested. */
  lifiSyncedTo: number
  /** Last Arc block whose PayX logs have been ingested (contiguous from deployment). */
  payxSyncedBlock: number
  /** false while a budgeted request-time scan has not yet reached the chain head. */
  payxComplete: boolean
}

export interface PointsSnapshot {
  version: number
  events: PointsEvent[]
  /** wallet (lowercase) -> X handle linked through a PayX claim. */
  handles: Record<string, string>
  cursors: SyncCursors
  /** Unix ms of the last successful sync attempt. */
  updatedAt: number
  /** Unix ms of the last time the LI.FI source was refreshed successfully. */
  lifiUpdatedAt: number
  /** Unix ms of the last time the PayX source was refreshed successfully. */
  payxUpdatedAt: number
}

export interface PointsBreakdown {
  swap: number
  bridge: number
  tipsSent: number
  tipsReceived: number
  activity: number
  bonuses: number
  /** Extra points contributed by time-boxed boosts (already included in total). */
  boost: number
}

export interface VolumeBreakdown {
  swap: number
  bridge: number
  tipsSent: number
  tipsReceived: number
  total: number
}

export interface CountBreakdown {
  swap: number
  bridge: number
  tipsSent: number
  tipsReceived: number
  total: number
}

export interface ScoredEvent extends PointsEvent {
  points: number
  /** Human labels for the components that made up `points` (for the activity feed). */
  parts: string[]
}

export interface WalletScore {
  wallet: string
  handle: string | null
  points: number
  breakdown: PointsBreakdown
  volumeUsd: VolumeBreakdown
  counts: CountBreakdown
  firstActiveAt: number | null
  lastActiveAt: number | null
  activeDays: number
  rank: number | null
  tier: string
}

export interface LedgerTotals {
  wallets: number
  points: number
  volumeUsd: number
  transactions: number
  swaps: number
  bridges: number
  tipsSent: number
  tipsClaimed: number
}

export interface Ledger {
  /** Sorted by points desc, rank assigned, excluded wallets removed. */
  entries: WalletScore[]
  byWallet: Map<string, WalletScore>
  totals: LedgerTotals
  /** Snapshot.updatedAt this ledger was computed from. */
  computedFrom: number
}
