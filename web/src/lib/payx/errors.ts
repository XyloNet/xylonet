import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

/**
 * Turn viem / wallet errors from PayXTipping calls into copy a person can act on.
 * Custom error names come from the v2 ABI (the ABI includes the `error` entries,
 * so simulateContract / estimateGas surface `ContractFunctionRevertedError`
 * with `data.errorName`).
 */

/** Copy is built per asset so the symbol / minimum match the instance being used. */
export interface PayXErrorContext {
  /** Token symbol of the PayX instance (e.g. "USDC"). */
  symbol?: string;
  /** Human minimum tip for that instance (e.g. "0.1", "100"). */
  minTipHuman?: string;
}

const DEFAULT_CONTEXT: Required<PayXErrorContext> = { symbol: 'USDC', minTipHuman: '0.1' };

function buildCopy(ctx: Required<PayXErrorContext>): Record<string, string> {
  return {
  InvalidAmount: `That amount is below the ${ctx.minTipHuman} ${ctx.symbol} minimum tip.`,
  InvalidHandle: 'That handle is not valid. Use 1-15 letters, numbers or underscores.',
  MessageTooLong: 'Your message is too long. Keep it under 280 bytes.',
  EnforcedPause: 'PayX is paused right now. Please try again later.',
  WalletMismatch:
    'This handle is already linked to a different wallet. Connect the wallet you first claimed with, or contact support to relink.',
  NoTipsToClaim: 'There are no pending tips to claim for this handle.',
  NonceAlreadyUsed: 'This claim authorization was already used. Please request a fresh one.',
  InvalidSignature: 'The claim authorization was rejected by the contract. Please sign in again and retry.',
  ZeroAddress: 'Invalid wallet address.',
  NotAuthorized: 'You are not authorized to perform this action.',
  HandleNotRegistered: 'This handle has not claimed before.',
  SafeERC20FailedOperation: `${ctx.symbol} transfer failed. Check your balance and allowance.`,
  ReentrancyGuardReentrantCall: 'The contract rejected a re-entrant call. Please retry.',
  InvalidRecipient: 'That wallet cannot receive tips. Use a regular wallet address.',
  NothingToWithdraw: 'There are no fees to withdraw yet.',
  OwnershipCannotBeRenounced: 'Ownership of PayX cannot be renounced.',
  };
}

export interface FriendlyError {
  /** Short human-readable message. */
  message: string;
  /** Contract error name when one was decoded (e.g. "WalletMismatch"). */
  code?: string;
  /** True when the user dismissed the wallet prompt. */
  userRejected?: boolean;
}

function isUserRejection(err: unknown): boolean {
  if (err instanceof UserRejectedRequestError) return true;
  if (err instanceof BaseError && err.walk((e) => e instanceof UserRejectedRequestError)) return true;
  const anyErr = err as { code?: number; message?: string; cause?: { code?: number } };
  if (anyErr?.code === 4001 || anyErr?.cause?.code === 4001) return true;
  const msg = String(anyErr?.message ?? '');
  return /user rejected|user denied|rejected the request/i.test(msg);
}

export function friendlyPayXError(err: unknown, context: PayXErrorContext = {}): FriendlyError {
  const ctx: Required<PayXErrorContext> = { ...DEFAULT_CONTEXT, ...context };
  const CUSTOM_ERROR_COPY = buildCopy(ctx);
  if (isUserRejection(err)) {
    return { message: 'Transaction cancelled in your wallet.', userRejected: true };
  }

  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | null;
    if (reverted) {
      const name = reverted.data?.errorName ?? reverted.reason;
      if (name && CUSTOM_ERROR_COPY[name]) {
        return { message: CUSTOM_ERROR_COPY[name], code: name };
      }
      if (name) {
        return { message: `The contract rejected this transaction (${name}).`, code: name };
      }
    }

    // Some wallets return the raw selector inside the message — match by name text.
    const text = `${err.shortMessage ?? ''} ${err.message ?? ''}`;
    for (const name of Object.keys(CUSTOM_ERROR_COPY)) {
      if (text.includes(name)) return { message: CUSTOM_ERROR_COPY[name], code: name };
    }

    if (/insufficient funds/i.test(text)) {
      return { message: `Not enough ${ctx.symbol} (or USDC for gas) to cover this transaction.` };
    }
    if (/chain mismatch|does not match the target chain|wrong network/i.test(text)) {
      return { message: 'Your wallet is on the wrong network. Switch to Arc (chain 5042).' };
    }
    return { message: err.shortMessage || 'Transaction failed. Please try again.' };
  }

  const msg = (err as { message?: string })?.message;
  return { message: msg && msg.length < 200 ? msg : 'Something went wrong. Please try again.' };
}
