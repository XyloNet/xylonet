'use client';

import { useCallback, useEffect, useState } from 'react';
import { PAYX_ASSETS, isPayXAssetKey, type PayXAssetKey } from '@/config/constants';

export interface RecentTipItem {
  id: string;
  /** Which PayX instance emitted the tip. */
  asset: PayXAssetKey;
  symbol: string;
  decimals: number;
  contract: string;
  handle: string;
  to: string;
  tipper: string;
  from: string;
  amount: string;
  amountRaw: string;
  fee: string;
  message: string;
  txHash: string;
  blockNumber: string;
  timestamp: number;
  timeAgo: string;
}

/** Poll /api/payx/recent-tips (on-chain TipSent events). */
export function useRecentTips(limit = 6, refreshMs = 15_000) {
  const [tips, setTips] = useState<RecentTipItem[]>([]);
  const [deployed, setDeployed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  /** true while the server could only do a shallow scan (feed still warming up) */
  const [partial, setPartial] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/payx/recent-tips', { cache: 'no-store' });
      const data = (await res.json()) as { tips?: Partial<RecentTipItem>[]; deployed?: boolean; partial?: boolean };
      // Older API responses (pre multi-asset) carry no asset tag: they were USDC.
      const normalized = (data.tips ?? []).map((t): RecentTipItem => {
        const asset: PayXAssetKey = isPayXAssetKey(t.asset) ? t.asset : 'USDC';
        const meta = PAYX_ASSETS[asset];
        return {
          id: t.id ?? `${t.txHash ?? ''}-${t.timestamp ?? 0}`,
          asset,
          symbol: t.symbol ?? meta.token.symbol,
          decimals: t.decimals ?? meta.token.decimals,
          contract: t.contract ?? meta.contract,
          handle: t.handle ?? '',
          to: t.to ?? (t.handle ? `@${t.handle}` : ''),
          tipper: t.tipper ?? '',
          from: t.from ?? '',
          amount: t.amount ?? '0',
          amountRaw: t.amountRaw ?? '0',
          fee: t.fee ?? '0',
          message: t.message ?? '',
          txHash: t.txHash ?? '',
          blockNumber: t.blockNumber ?? '0',
          timestamp: t.timestamp ?? 0,
          timeAgo: t.timeAgo ?? '',
        };
      });
      setTips(normalized.slice(0, limit));
      setDeployed(data.deployed ?? false);
      setPartial(!!data.partial);
    } catch {
      setTips([]);
      setPartial(true);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    if (refreshMs <= 0) return;
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  return { tips, deployed, loading, partial, refresh: load };
}
