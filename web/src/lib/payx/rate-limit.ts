/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Best-effort only: Vercel functions are stateless per instance, so this is a
 * nuisance limiter against a single hot instance, not a security boundary.
 * Real abuse protection for the oracle is the OAuth session requirement.
 */

const windows = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    windows.set(key, hits);
    return false;
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > MAX_KEYS) windows.clear();
  return true;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
