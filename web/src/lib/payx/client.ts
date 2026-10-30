import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { arcMainnet } from '@/config/wagmi';

/**
 * SERVER-ONLY viem public client for Arc mainnet (chain 5042).
 *
 * Talks directly to the credentialed upstreams (ARC_RPC_URL, ARC_RPC_FALLBACK_URL)
 * which live only in server env. Import this from API routes only — never from
 * a "use client" module (the URLs would be inlined into the browser bundle).
 */

let cached: PublicClient | null = null;

export function getServerRpcUrls(): string[] {
  return [process.env.ARC_RPC_URL, process.env.ARC_RPC_FALLBACK_URL].filter(
    (u): u is string => !!u && /^https?:\/\//.test(u)
  );
}

export function isRpcConfigured(): boolean {
  return getServerRpcUrls().length > 0;
}

export function getPayXPublicClient(): PublicClient {
  if (cached) return cached;
  const urls = getServerRpcUrls();
  if (urls.length === 0) {
    throw new Error('ARC_RPC_URL is not configured');
  }
  const transports = urls.map((u) =>
    http(u, { timeout: 15_000, retryCount: 1, batch: true })
  );
  cached = createPublicClient({
    chain: arcMainnet,
    transport: transports.length > 1 ? fallback(transports, { rank: false }) : transports[0],
  });
  return cached;
}
