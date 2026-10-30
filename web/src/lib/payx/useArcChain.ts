'use client';

import { useCallback, useState } from 'react';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { ARC_CHAIN_ID, getAddChainParams } from '@/config/wagmi';

/**
 * Make sure the connected wallet is on Arc mainnet (5042) before writing.
 * Tries wallet_switchEthereumChain via wagmi; on 4902 (chain unknown to the
 * wallet) adds it with wallet_addEthereumChain using our public RPC/explorer.
 */
export function useArcChain() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const [switching, setSwitching] = useState(false);

  const onArc = isConnected && chainId === ARC_CHAIN_ID;

  const ensureArc = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    if (chainId === ARC_CHAIN_ID) return true;
    setSwitching(true);
    try {
      try {
        await switchChainAsync({ chainId: ARC_CHAIN_ID });
        return true;
      } catch (err) {
        const code =
          (err as { code?: number })?.code ??
          (err as { cause?: { code?: number } })?.cause?.code;
        const msg = String((err as { message?: string })?.message ?? '');
        const unrecognized = code === 4902 || /unrecognized chain|not been added|4902/i.test(msg);
        if (!unrecognized || !walletClient) throw err;

        const params = getAddChainParams(ARC_CHAIN_ID);
        if (!params) throw err;
        await walletClient.request({
          method: 'wallet_addEthereumChain',
          params: [params],
        });
        await switchChainAsync({ chainId: ARC_CHAIN_ID });
        return true;
      }
    } finally {
      setSwitching(false);
    }
  }, [isConnected, chainId, switchChainAsync, walletClient]);

  return { onArc, chainId, switching, ensureArc };
}
