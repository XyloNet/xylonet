import { receiptCardResponse } from '@/lib/og/receiptCard'
import { OG_SIZE } from '@/lib/og/assets'

export const runtime = 'nodejs'
export const alt = 'XyloNet payment receipt'
export const size = OG_SIZE
export const contentType = 'image/png'

/** Share card for a payment, rendered from chain data so it cannot be forged. */
export default async function Image({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params
  return receiptCardResponse(tx)
}
