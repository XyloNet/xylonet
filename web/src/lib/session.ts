import type { SessionOptions } from 'iron-session';

export interface SessionData {
  twitterState?: string;
  twitterCodeVerifier?: string;
  twitterHandle?: string;
  twitterId?: string;
  twitterName?: string;
  twitterProfileImage?: string;
  isLoggedIn: boolean;
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export const SESSION_COOKIE_NAME = 'payx_session';
const MIN_SECRET_LENGTH = 32;

/**
 * Resolve the iron-session password lazily so `next build` (which evaluates
 * route modules without runtime env) never crashes, but any real request
 * without a proper SESSION_SECRET fails loudly instead of silently using a
 * weak default (threat model A-5: no hardcoded fallback password).
 */
function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters. ` +
        'Generate one with `openssl rand -base64 48` and set it in the environment.'
    );
  }
  return secret;
}

export function isSessionConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return !!secret && secret.length >= MIN_SECRET_LENGTH;
}

/**
 * iron-session options. `password` is a getter so the secret is only read
 * (and validated) when a request actually opens the session.
 */
export const sessionOptions: SessionOptions = {
  get password() {
    return resolveSessionSecret();
  },
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  },
};
