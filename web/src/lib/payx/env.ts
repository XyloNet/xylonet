import { isAddress, type Hex } from 'viem';
import type { PayXAssetKey } from '@/config/constants';

/**
 * Server-side PayX env accessors. Never log or return the private key.
 */

const ZERO = '0x0000000000000000000000000000000000000000';

export function getOraclePrivateKey(): Hex | null {
  const k = process.env.ORACLE_PRIVATE_KEY;
  return k && /^0x[0-9a-fA-F]{64}$/.test(k) ? (k as Hex) : null;
}

function validAddress(v: string | undefined): `0x${string}` | null {
  if (!v || !isAddress(v) || v.toLowerCase() === ZERO) return null;
  return v as `0x${string}`;
}

/** USDC PayX instance for server code: server env first, then the public one. */
export function getServerPayXAddress(): `0x${string}` | null {
  return validAddress(process.env.PAYX_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_PAYX_CONTRACT_ADDRESS);
}

/**
 * PayX instance for a given tipping asset (server env first, then public).
 * Returns null while that asset's instance is not deployed/configured.
 * Add one case per registry asset — the env vars must be read by their literal
 * names so Next.js can inline the NEXT_PUBLIC_* values.
 */
export function getServerPayXAddressFor(asset: PayXAssetKey): `0x${string}` | null {
  switch (asset) {
    case 'USDC':
      return getServerPayXAddress();
    case 'EURC':
      return validAddress(process.env.PAYX_EURC_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_PAYX_EURC_CONTRACT_ADDRESS);
    case 'CIRBTC':
      return validAddress(process.env.PAYX_CIRBTC_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_PAYX_CIRBTC_CONTRACT_ADDRESS);
    default:
      return null;
  }
}

export function isTwitterConfigured(): boolean {
  return !!process.env.TWITTER_CLIENT_ID && !!process.env.TWITTER_CLIENT_SECRET;
}

export function getTwitterCallbackUrl(): string {
  const explicit = process.env.TWITTER_CALLBACK_URL;
  if (explicit) return explicit;
  const app = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '');
  return `${app}/payx/api/auth/callback/twitter`;
}
