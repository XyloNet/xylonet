'use client'

import Link from 'next/link'
import { useUnifiedBalance } from '@/lib/unified/useUnifiedBalance'
import { formatAmount } from '@/lib/format'

/** "One balance" figure on the dashboard; only rendered once something is deposited. */
export function UnifiedLine() {
  const unified = useUnifiedBalance({ balancesOnly: true })
  const total = unified.balances.data?.total ?? 0
  if (total <= 0) return null
  return (
    <Link href="/bridge?tab=unified" className="inline-flex items-center gap-1.5 hover:text-foreground">
      One balance <span className="font-mono text-foreground" data-numeric>{formatAmount(total)}</span>
    </Link>
  )
}
