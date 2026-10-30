import type { NextRequest } from 'next/server'
import { receiptCardResponse } from '@/lib/og/receiptCard'

export const runtime = 'nodejs'

/** The receipt card as a downloadable image. `?note=0` leaves the payer's note off. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params
  return receiptCardResponse(tx, { showNote: request.nextUrl.searchParams.get('note') !== '0' })
}
