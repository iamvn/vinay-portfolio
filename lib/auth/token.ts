import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'portfolio_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * `site`: which site the login belongs to (tokens from before multi-site have none = the main site).
 * `imp`: set when the platform owner signed in to this site's admin with "Log in as admin" (who did it).
 */
export type TokenClaims = { sub: string; ver: number; site: string; imp?: string };

/** Super admin sessions ("Log in as admin") are short: they're for checking and fixing, not for living in. */
export const IMPERSONATION_SECONDS = 2 * 60 * 60;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is missing or shorter than 32 characters. Add it to .env (and to Vercel).');
  }
  return new TextEncoder().encode(secret);
}

/** Signed session token (JWT, HS256). `ver` must match the user's tokenVersion to stay valid. */
export async function createToken(userId: number, tokenVersion: number, site: string, impersonatedBy?: string) {
  const expiresAt = new Date(Date.now() + (impersonatedBy ? IMPERSONATION_SECONDS : SESSION_SECONDS) * 1000);
  const token = await new SignJWT({ ver: tokenVersion, site, ...(impersonatedBy ? { imp: impersonatedBy } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
  return { token, expiresAt };
}

/** Returns the claims of a valid, unexpired token, or null. */
export async function readToken(token: string | undefined | null): Promise<TokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number' || payload.purpose) return null;
    return { sub: payload.sub, ver: payload.ver, site: typeof payload.site === 'string' ? payload.site : 'main', ...(typeof payload.imp === 'string' ? { imp: payload.imp } : {}) };
  } catch {
    return null;
  }
}

/** Token from "Authorization: Bearer …" or the session cookie. */
export function tokenFromRequest(request: Request): { token: string | null; viaCookie: boolean } {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return { token: header.slice(7).trim(), viaCookie: false };
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return { token: cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : null, viaCookie: Boolean(cookie) };
}

/**
 * "Log in as admin": a one-time pass, valid for 60 seconds, that the platform owner's browser carries to the
 * other site's address, where it's swapped for a session (cookies can't be set for another site's address).
 */
export async function createHandoff(site: string, by: string, jti: string) {
  return new SignJWT({ purpose: 'impersonate', site, by })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secretKey());
}

export async function readHandoff(token: string | null): Promise<{ site: string; by: string; jti: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (payload.purpose !== 'impersonate' || typeof payload.site !== 'string' || typeof payload.by !== 'string' || typeof payload.jti !== 'string') return null;
    return { site: payload.site, by: payload.by, jti: payload.jti };
  } catch {
    return null;
  }
}

export const sessionCookie = (token: string, maxAge = SESSION_SECONDS) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});
