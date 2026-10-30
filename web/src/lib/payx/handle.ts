/**
 * X handle helpers shared by the client pages, the API routes and the oracle.
 * Mirrors PayXTipping._normalizeHandle: lowercase, a-z 0-9 _ only, 1–15 chars.
 */

export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
export const NORMALIZED_HANDLE_RE = /^[a-z0-9_]{1,15}$/;

/** Strip a leading @ and surrounding whitespace (does not lowercase). */
export function stripHandle(input: string): string {
  return input.trim().replace(/^@+/, '');
}

/** True when the (stripped) handle would be accepted by the contract. */
export function isValidHandle(input: string): boolean {
  return HANDLE_RE.test(stripHandle(input));
}

/**
 * Normalize exactly like the contract does. Returns null when the handle
 * would be rejected on-chain (InvalidHandle).
 */
export function normalizeHandle(input: string): string | null {
  const stripped = stripHandle(input);
  if (!HANDLE_RE.test(stripped)) return null;
  const lower = stripped.toLowerCase();
  return NORMALIZED_HANDLE_RE.test(lower) ? lower : null;
}
