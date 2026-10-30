'use client'

/**
 * Fire-and-forget record of a CCTP or Gateway action started on this site.
 * Nothing in the money flow waits on it, and a failure is silent by design.
 */
export function logBridgeStart(entry: { kind: 'cctp' | 'gateway_deposit' | 'gateway_spend'; wallet: string; amountUsd: number; fromChainId: number; toChainId: number; txHash?: string }): void {
  try {
    void fetch('/api/bridge/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry), keepalive: true }).catch(() => {})
  } catch {
    /* never surface */
  }
}
