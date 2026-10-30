import { NextResponse } from 'next/server'
import { describeRules } from '@/lib/points/rules'

export const runtime = 'nodejs'

/** GET /api/points/rules — the published Season rules (static per deploy). */
export async function GET() {
  return NextResponse.json(describeRules(), {
    headers: { 'cache-control': 'public, max-age=300, s-maxage=3600' },
  })
}
