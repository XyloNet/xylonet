/**
 * Number, currency, address and time formatting for the whole app.
 * One place, Intl-based, so locale work later is a config change.
 */

const LOCALE = 'en-US'

export function shortAddress(address: string, left = 6, right = 4): string {
  if (!address) return ''
  if (address.length <= left + right + 2) return address
  return `${address.slice(0, left)}…${address.slice(-right)}`
}

export function shortHash(hash: string): string {
  return shortAddress(hash, 8, 6)
}

export type AmountFormat = {
  /** minimum fraction digits (default 2 for stablecoins) */
  min?: number
  /** maximum fraction digits (default 2; 6 for "exact") */
  max?: number
  /** compact notation for large numbers (1.2M) */
  compact?: boolean
}

export function formatAmount(value: number | bigint | null | undefined, opts: AmountFormat = {}): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const n = typeof value === 'bigint' ? Number(value) : value
  const { min = 2, max = 2, compact = false } = opts
  if (compact && Math.abs(n) >= 100_000) {
    return new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  }
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max }).format(n)
}

/** "$0.004" style for fees: shows enough digits to be honest about cents. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value !== 0 && Math.abs(value) < 0.01) {
    return `$${new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 3, maximumFractionDigits: 4 }).format(value)}`
  }
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD' }).format(value)
}

export function formatPercent(fraction: number, max = 2): string {
  return new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: max }).format(fraction)
}

/** Split "1,240.00" into ["1,240", ".00"] for the display style where cents are smaller. */
export function splitDecimals(formatted: string): [string, string] {
  const i = formatted.lastIndexOf('.')
  if (i < 0) return [formatted, '']
  return [formatted.slice(0, i), formatted.slice(i)]
}

export function timeAgo(date: Date | number | string): string {
  const t = typeof date === 'number' ? date : new Date(date).getTime()
  const diff = Math.round((t - Date.now()) / 1000)
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
  if (abs < 60) return rtf.format(diff, 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' }).format(t)
}

export function formatDateTime(date: Date | number | string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

/** Seconds with the precision the settle stamp needs: 0.41 s, 2.3 s, 47 s, 1 m 12 s. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(2)} s`
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m} m ${s} s`
}
