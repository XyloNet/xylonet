import { formatUnits, parseUnits } from 'viem';
import { PAYX_ASSETS, type PayXAsset, type PayXAssetKey } from '@/config/constants';

/**
 * Raw token bigint -> localized human string using the token's decimals.
 * `minFraction`/`maxFraction` control the displayed fraction digits.
 */
export function formatTokenAmount(
  raw: bigint | undefined | null,
  decimals: number,
  maxFraction = 2,
  minFraction = Math.min(2, maxFraction)
): string {
  const n = raw === undefined || raw === null ? 0 : Number(formatUnits(raw, decimals));
  return n.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(minFraction, maxFraction),
    maximumFractionDigits: maxFraction,
  });
}

/** Human string -> raw bigint for a token with `decimals`; null on bad input. */
export function parseTokenAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  const re = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);
  if (!re.test(trimmed)) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

function resolve(asset: PayXAsset | PayXAssetKey): PayXAsset {
  return typeof asset === 'string' ? PAYX_ASSETS[asset] : asset;
}

/** Format an amount of a PayX asset ("12.34" for USDC; whole-number assets use their own fractionDigits). */
export function formatAssetAmount(raw: bigint | undefined | null, asset: PayXAsset | PayXAssetKey, maxFraction?: number): string {
  const a = resolve(asset);
  return formatTokenAmount(raw, a.token.decimals, maxFraction ?? a.fractionDigits.max, a.fractionDigits.min);
}

/** Parse a human amount of a PayX asset with that asset's decimals. */
export function parseAssetAmount(input: string, asset: PayXAsset | PayXAssetKey): bigint | null {
  return parseTokenAmount(input, resolve(asset).token.decimals);
}

/**
 * Full display label: "$5.00 USDC" for dollar assets, "500 <SYMBOL>" otherwise.
 * `withSymbol=false` drops the symbol ("$5.00" / "500").
 */
export function displayAssetAmount(raw: bigint | undefined | null, asset: PayXAsset | PayXAssetKey, withSymbol = true): string {
  const a = resolve(asset);
  const body = `${a.currencyPrefix}${formatAssetAmount(raw, a)}`;
  return withSymbol ? `${body} ${a.token.symbol}` : body;
}

/** Same as displayAssetAmount but from an already-formatted decimal string (API responses). */
export function displayAssetString(amount: string, asset: PayXAsset | PayXAssetKey, withSymbol = true): string {
  const a = resolve(asset);
  const n = Number(amount);
  const body = `${a.currencyPrefix}${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: a.fractionDigits.min,
    maximumFractionDigits: a.fractionDigits.max,
  })}`;
  return withSymbol ? `${body} ${a.token.symbol}` : body;
}

/** 6-decimal USDC bigint -> "12.34" (USDC-only convenience; shared code should use formatAssetAmount). */
export function formatUsdc(raw: bigint | undefined | null, maxFraction = 2): string {
  return formatTokenAmount(raw, PAYX_ASSETS.USDC.token.decimals, maxFraction);
}

/** "12.34" -> 12340000n ; returns null on bad input (USDC-only convenience). */
export function parseUsdc(input: string): bigint | null {
  return parseTokenAmount(input, PAYX_ASSETS.USDC.token.decimals);
}

export function shortenAddress(addr: string | undefined | null): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeAgo(tsSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - tsSeconds));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** UTF-8 byte length (contract caps message at 280 bytes, not chars). */
export function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}
