import 'server-only'
import { getAbiItem, type Log } from 'viem'
import { PayXTippingABI } from '@/config/abis/PayXTipping'
import { livePayXAssets, payXAssetByContract } from '@/config/constants'
import { getPayXPublicClient, isRpcConfigured } from '@/lib/payx/client'
import { loadPush } from './store'
import { dispatchTips, pushConfigured, type NewTip } from './send'

const WINDOW = 9_000n
const MAX_CATCHUP = 60_000n
let lastRun = 0

/**
 * Looks for TipSent events since the last dispatch and sends notifications.
 * Cheap enough to piggyback on the recent-tips feed; also wired to a cron.
 */
export async function dispatchFromChain(opts: { force?: boolean } = {}): Promise<{ sent: number; pruned: number; scanned: number } | null> {
  if (!pushConfigured() || !isRpcConfigured() || livePayXAssets().length === 0) return null
  if (!opts.force && Date.now() - lastRun < 45_000) return null
  lastRun = Date.now()
  const client = getPayXPublicClient()
  const head = await client.getBlockNumber()
  const state = await loadPush()
  if (Object.keys(state.subs).length === 0) return { sent: 0, pruned: 0, scanned: 0 }
  const live = livePayXAssets()
  const deployBlock = BigInt(Math.min(...live.map((a) => a.deploymentBlock || 0)))
  let from = state.lastDispatchedBlock > 0 ? BigInt(state.lastDispatchedBlock) + 1n : head - 2_000n
  if (from < deployBlock) from = deployBlock
  if (head - from > MAX_CATCHUP) from = head - MAX_CATCHUP
  if (from > head) return { sent: 0, pruned: 0, scanned: 0 }
  const event = getAbiItem({ abi: PayXTippingABI, name: 'TipSent' })
  const tips: NewTip[] = []
  let scanned = 0
  for (let start = from; start <= head; start += WINDOW + 1n) {
    const end = start + WINDOW > head ? head : start + WINDOW
    const logs = (await client.getLogs({ address: live.map((a) => a.contract), event, fromBlock: start, toBlock: end })) as Array<Log & { args: { handle?: string; amount?: bigint; message?: string } }>
    scanned += Number(end - start + 1n)
    for (const l of logs) {
      if (!l.args.handle || l.args.amount == null || !l.transactionHash || l.blockNumber == null) continue
      const asset = payXAssetByContract(l.address)
      tips.push({ handle: l.args.handle, amount: l.args.amount, symbol: asset?.token.symbol, decimals: asset?.token.decimals, message: l.args.message ?? '', txHash: l.transactionHash, blockNumber: Number(l.blockNumber) })
    }
  }
  const r = await dispatchTips(tips, Number(head))
  return { sent: r.sent, pruned: r.pruned, scanned }
}
