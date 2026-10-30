import { randomBytes } from 'node:crypto';
import { getAddress, isAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CLAIM_TYPES, PAYX_EIP712_DOMAIN } from '@/config/abis/PayXTipping';
import { normalizeHandle } from '@/lib/payx/handle';

/**
 * PayX oracle signer (XYLO-ORACLE-01).
 *
 * Produces the EIP-712 `Claim(string handle,address wallet,bytes32 nonce)`
 * authorization that PayXTipping.claimTips verifies against `oracleSigner()`.
 * The domain is bound to name "PayX", version "2", the Arc mainnet chain id
 * and the deployed contract, so a signature can never be replayed on another
 * chain or another deployment (threat model S-1 / A-1).
 *
 * Pure: no env access, no logging. The private key is passed in and never
 * echoed back.
 */

export interface SignClaimParams {
  privateKey: Hex;
  contract: `0x${string}`;
  chainId: number;
  handle: string;
  wallet: string;
}

export interface SignedClaim {
  /** Normalized lowercase handle — exactly what the contract hashes. */
  handle: string;
  /** EIP-55 checksummed wallet address. */
  wallet: `0x${string}`;
  /** 32 random bytes, hex, single-use on-chain. */
  nonce: Hex;
  signature: Hex;
  oracleAddress: `0x${string}`;
}

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

function assertPrivateKey(privateKey: string): asserts privateKey is Hex {
  if (!PRIVATE_KEY_RE.test(privateKey)) {
    throw new Error('Oracle private key must be a 0x-prefixed 32-byte hex string');
  }
}

export function getOracleAddress(privateKey: Hex): `0x${string}` {
  assertPrivateKey(privateKey);
  return privateKeyToAccount(privateKey).address;
}

export function generateClaimNonce(): Hex {
  return (`0x${randomBytes(32).toString('hex')}`) as Hex;
}

export async function signClaim(params: SignClaimParams): Promise<SignedClaim> {
  const { privateKey, contract, chainId, handle, wallet } = params;

  assertPrivateKey(privateKey);

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error('Invalid chain id');
  }
  if (!isAddress(contract) || /^0x0{40}$/i.test(contract)) {
    throw new Error('Invalid PayX contract address');
  }

  const normalized = normalizeHandle(handle);
  if (!normalized) {
    throw new Error('Invalid handle: expected 1-15 characters of a-z, 0-9 or _');
  }

  if (!isAddress(wallet) || /^0x0{40}$/i.test(wallet)) {
    throw new Error('Invalid wallet address');
  }
  const checksummedWallet = getAddress(wallet);

  const account = privateKeyToAccount(privateKey);
  const nonce = generateClaimNonce();

  const signature = await account.signTypedData({
    domain: PAYX_EIP712_DOMAIN(getAddress(contract), chainId),
    types: CLAIM_TYPES,
    primaryType: 'Claim',
    message: {
      handle: normalized,
      wallet: checksummedWallet,
      nonce,
    },
  });

  return {
    handle: normalized,
    wallet: checksummedWallet,
    nonce,
    signature,
    oracleAddress: account.address,
  };
}
