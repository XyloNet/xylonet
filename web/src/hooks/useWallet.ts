'use client'

import { useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ARC_CHAIN_ID } from '@/config/wagmi'
import { useArcChain } from '@/lib/payx/useArcChain'
import { walletStore } from '@/lib/wallet/store'

/**
 * The one wallet hook pages use. Connect opens the lazily loaded modal;
 * `ensureArc` switches (or adds) Arc only when an action needs it.
 */
export function useWallet() {
  const { address, isConnected, chainId, status } = useAccount()
  const { ensureArc, switching } = useArcChain()
  const { disconnect } = useDisconnect()
  const openConnect = useCallback(() => walletStore.requestConnect(), [])
  return {
    address,
    isConnected,
    status,
    chainId,
    onArc: isConnected && chainId === ARC_CHAIN_ID,
    ensureArc,
    switching,
    openConnect,
    disconnect,
  }
}
