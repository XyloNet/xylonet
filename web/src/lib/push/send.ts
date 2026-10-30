import 'server-only'
import webpush from 'web-push'
import { formatUnits } from 'viem'
import { loadPush, savePush, type PushSub } from './store'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

function configure() {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:forgelabs@xylonet.xyz', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
}

export interface NewTip {
  handle: string
  amount: bigint
  /** Token symbol and decimals of the PayX instance that emitted the tip (USDC, 6 when omitted). */
  symbol?: string
  decimals?: number
  message: string
  txHash: string
  blockNumber: number
}

/**
 * Sends "you got paid" notifications for tips newer than the last dispatch.
 * Idempotent per block: the cursor moves forward only after a run. Dead
 * subscriptions (410/404) are pruned.
 */
export async function dispatchTips(tips: NewTip[], headBlock: number): Promise<{ sent: number; pruned: number; skipped: number }> {
  if (!pushConfigured()) return { sent: 0, pruned: 0, skipped: tips.length }
  configure()
  const state = await loadPush()
  const fresh = tips.filter((t) => t.blockNumber > state.lastDispatchedBlock)
  let sent = 0
  let pruned = 0
  for (const t of fresh) {
    const subs = state.subs[t.handle]
    if (!subs?.length) continue
    const decimals = t.decimals ?? 6
    const symbol = t.symbol ?? 'USDC'
    const amount = Number(formatUnits(t.amount, decimals)).toLocaleString('en-US', decimals === 6 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: decimals })
    const payload = JSON.stringify({
      title: `You were paid ${symbol === 'USDC' ? '$' : ''}${amount} ${symbol}`,
      body: t.message ? `“${t.message.slice(0, 120)}”` : `A payment to @${t.handle} just settled on Arc. Claim it any time.`,
      url: `${APP_URL}/pay/creator`,
      tag: t.txHash,
    })
    const keep: PushSub[] = []
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 60 * 60 * 24 })
        sent++
        keep.push(sub)
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) pruned++
        else keep.push(sub)
      }
    }
    if (keep.length) state.subs[t.handle] = keep
    else delete state.subs[t.handle]
  }
  state.lastDispatchedBlock = Math.max(state.lastDispatchedBlock, headBlock)
  await savePush(state)
  return { sent, pruned, skipped: tips.length - fresh.length }
}
