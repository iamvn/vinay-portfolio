import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'portfolio_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type TokenClaims = { sub: string; ver: number };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is missing or shorter than 32 characters. Add it to .env (and to Vercel).');
  }
  return new TextEncoder().encode(secret);
}

/** Signed session token (JWT, HS256). `ver` must match the user's tokenVersion to stay valid. */
export async function createToken(userId: number, tokenVersion: number) {
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  const token = await new SignJWT({ ver: tokenVersion })
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
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null;
    return { sub: payload.sub, ver: payload.ver };
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

export const sessionCookie = (token: string) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_SECONDS,
});
