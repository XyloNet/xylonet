import 'server-only'
import { decodeEventLog, type Address, type Hex } from 'viem'
import { PayXTippingABI } from '@/config/abis/PayXTipping'
import { PAYX_ASSETS, PAYX_ASSET_KEYS, type PayXAssetKey } from '@/config/constants'
import { getServerPayXAddressFor } from './env'
import { getPayXPublicClient, isRpcConfigured } from './client'

const ASSET = PAYX_ASSETS.USDC

export interface HandleInfo {
  handle: string
  pendingBalance: bigint
  linkedWallet: Address
  isRegistered: boolean
  totalReceived: bigint
  totalClaimed: bigint
  tipCount: bigint
}

/** Server read of a handle's escrow state. Null when the RPC is not configured. */
export async function readHandleInfo(handle: string): Promise<HandleInfo | null> {
  if (!isRpcConfigured()) return null
  const client = getPayXPublicClient()
  const r = await client.readContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'getHandleInfo', args: [handle] })
  return { handle, ...r }
}

export interface TipReceipt {
  /** Which PayX instance (asset) the payment went through. */
  asset: PayXAssetKey
  symbol: string
  decimals: number
  txHash: Hex
  blockNumber: bigint
  timestamp: number
  tipper: Address
  handle: string
  amount: bigint
  fee: bigint
  net: bigint
  message: string
}

/** Decodes the TipSent event out of a transaction receipt. Null if it is not a PayX payment. */
export async function readTipReceipt(txHash: Hex): Promise<TipReceipt | null> {
  if (!isRpcConfigured()) return null
  const client = getPayXPublicClient()
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null)
  if (!receipt || receipt.status !== 'success') return null
  const instances = new Map<string, PayXAssetKey>()
  for (const key of PAYX_ASSET_KEYS) {
    const addr = getServerPayXAddressFor(key)
    if (addr) instances.set(addr.toLowerCase(), key)
  }
  for (const log of receipt.logs) {
    const assetKey = instances.get(log.address.toLowerCase())
    if (!assetKey) continue
    try {
      const ev = decodeEventLog({ abi: PayXTippingABI, data: log.data, topics: log.topics })
      if (ev.eventName !== 'TipSent') continue
      const a = ev.args as unknown as Record<string, unknown>
      // PayX v2 emits the amount AFTER the fee (what the handle receives), so
      // what the payer sent is that plus the fee.
      const net = BigInt((a.amount ?? a.netAmount ?? 0n) as bigint)
      const fee = BigInt((a.fee ?? a.platformFee ?? 0n) as bigint)
      const amount = net + fee
      const block = await client.getBlock({ blockNumber: receipt.blockNumber })
      return {
        asset: assetKey,
        symbol: PAYX_ASSETS[assetKey].token.symbol,
        decimals: PAYX_ASSETS[assetKey].token.decimals,
        txHash,
        blockNumber: receipt.blockNumber,
        timestamp: Number(block.timestamp),
        tipper: (a.tipper ?? a.from ?? receipt.from) as Address,
        handle: String(a.handle ?? a.recipientHandle ?? ''),
        amount,
        fee,
        net,
        message: String(a.message ?? ''),
      }
    } catch {
      /* not a TipSent log */
    }
  }
  return null
}
