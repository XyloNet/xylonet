'use client'

import { useEffect, useState } from 'react'
import { explorerAddressUrl } from '@/config/wagmi'
import { AddressLink } from '../../_components/Doc'

/** The live oracle signer address, read from /api/payx/health after mount. */
export function OracleSigner() {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/payx/health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { oracleAddress?: string | null }) => setAddress(d.oracleAddress ?? null))
      .catch(() => setAddress(null))
  }, [])

  if (!address) return <span className="text-[13px] text-ink-3">published at launch (XYLO-ORACLE-01)</span>
  return <AddressLink address={address} href={explorerAddressUrl(address)} />
}
