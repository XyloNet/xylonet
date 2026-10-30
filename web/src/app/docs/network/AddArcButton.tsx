'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChainLogo } from '@/components/ui/TokenLogos'
import { ARC_CHAIN_ID, getAddChainParams } from '@/config/wagmi'

type EthereumProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

/** Asks an injected wallet to add Arc mainnet. The only interactive bit of the network page. */
export function AddArcButton() {
  const [state, setState] = useState<'idle' | 'adding' | 'done' | 'error' | 'nowallet'>('idle')

  const addArc = async () => {
    const eth = typeof window !== 'undefined' ? (window as unknown as { ethereum?: EthereumProvider }).ethereum : undefined
    if (!eth) {
      setState('nowallet')
      return
    }
    const params = getAddChainParams(ARC_CHAIN_ID)
    if (!params) return
    try {
      setState('adding')
      await eth.request({ method: 'wallet_addEthereumChain', params: [params] })
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <div>
      <Button size="lg" onClick={addArc} disabled={state === 'adding'}>
        <ChainLogo chainId={ARC_CHAIN_ID} size={16} />
        {state === 'adding' ? 'Confirm in wallet…' : state === 'done' ? 'Arc added' : 'Add Arc mainnet'}
      </Button>
      {state === 'nowallet' && <p className="mt-3 text-[13px] text-warn">No injected wallet detected. Add the network manually using the details above.</p>}
      {state === 'error' && <p className="mt-3 text-[13px] text-warn">The wallet declined the request. You can add the network manually using the details above.</p>}
    </div>
  )
}
