/**
 * Keep wallet interactions on the classic path: one approve, then one swap.
 *
 * Why: MetaMask advertises EIP-5792/EIP-7702 "atomic batch" capability. The
 * LI.FI SDK then bundles approve+swap into a single `wallet_sendCalls`, which
 * makes MetaMask offer a "smart account" upgrade and lets its Blockaid scanner
 * evaluate the whole bundle as one high-risk action ("deceptive request") on
 * amounts above roughly $500. Other wallets lack the capability, so they get
 * the plain two-transaction flow and never show the banner.
 *
 * How: the SDK only batches when `wallet_getCapabilities` reports atomic
 * support. We intercept that probe (and the batch methods) on every injected
 * provider — window.ethereum and EIP-6963 announced providers — and answer
 * "unsupported method", which is exactly what a wallet without batching says.
 * Everything else passes through untouched. Idempotent; safe to call often.
 */

type Eip1193Request = (args: { method: string; params?: unknown }) => Promise<unknown>
type Eip1193Provider = { request: Eip1193Request; __xyloNoBatch?: boolean }

const BLOCKED = new Set(['wallet_getCapabilities', 'wallet_sendCalls', 'wallet_getCallsStatus', 'wallet_showCallsStatus'])

function patch(provider: unknown) {
  const p = provider as Eip1193Provider | undefined
  if (!p || typeof p.request !== 'function' || p.__xyloNoBatch) return
  const original = p.request.bind(p)
  p.request = (args) => {
    if (args && BLOCKED.has(args.method)) {
      const err = Object.assign(new Error(`${args.method} is not supported on this site`), { code: 4200 })
      return Promise.reject(err)
    }
    return original(args)
  }
  p.__xyloNoBatch = true
}

let installed = false

export function disableWalletBatching() {
  if (typeof window === 'undefined' || installed) return
  installed = true
  const w = window as unknown as { ethereum?: unknown; addEventListener: Window['addEventListener']; dispatchEvent: Window['dispatchEvent'] }
  patch(w.ethereum)
  // EIP-6963: wallets announce provider objects; patch each as it arrives.
  w.addEventListener('eip6963:announceProvider', (event: Event) => {
    const detail = (event as CustomEvent<{ provider?: unknown }>).detail
    patch(detail?.provider)
  })
  w.dispatchEvent(new Event('eip6963:requestProvider'))
}
