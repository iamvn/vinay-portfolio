import { prisma } from '@/lib/prisma';
import { readToken, tokenFromRequest } from './token';

export type SessionUser = { id: number; email: string; name: string; role: string; tokenVersion: number };

/** Validates a token against the database: the user must exist and the token version must match. */
export async function userFromToken(token: string | null | undefined): Promise<SessionUser | null> {
  const claims = await readToken(token);
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: Number(claims.sub) },
    select: { id: true, email: true, name: true, role: true, tokenVersion: true },
  });
  return user && user.tokenVersion === claims.ver ? user : null;
}

export async function userFromRequest(request: Request) {
  return userFromToken(tokenFromRequest(request).token);
}

export const publicUser = (user: { id: number; email: string; name: string; role: string; createdAt?: string }) =>
  ({ id: user.id, email: user.email, name: user.name, role: user.role, ...(user.createdAt ? { createdAt: user.createdAt } : {}) });
