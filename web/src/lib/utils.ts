export { cn } from 'cn'
import { explorerTxUrl, explorerAddressUrl } from '@/config/wagmi'

// Legacy helpers kept for pages not yet rebuilt (swap/bridge). New code uses
// src/lib/format.ts. Delete when A1 lands.
export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)
}

export function formatUSD(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === '') return BigInt(0)
  const [whole, fraction = ''] = amount.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, '0')
  const whole = str.slice(0, -decimals) || '0'
  const fraction = str.slice(-decimals)
  const trimmedFraction = fraction.replace(/0+$/, '')
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

export function getExplorerUrl(txHash: string): string {
  return explorerTxUrl(txHash)
}

export function getAddressExplorerUrl(address: string): string {
  return explorerAddressUrl(address)
}
