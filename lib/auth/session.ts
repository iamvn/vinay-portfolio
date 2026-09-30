import { readToken, tokenFromRequest } from './token';
import { allowedTabs, isReadOnly, parsePermissions } from './permissions';
import { findSessionUser } from './permissions-store';

export type SessionUser = { id: number; email: string; name: string; role: string; tokenVersion: number; permissions: string; readOnly: boolean };

/** Validates a token against the database: the user must exist and the token version must match. */
export async function userFromToken(token: string | null | undefined): Promise<SessionUser | null> {
  const claims = await readToken(token);
  if (!claims) return null;
  const user = await findSessionUser(Number(claims.sub));
  return user && user.tokenVersion === claims.ver ? user : null;
}

export async function userFromRequest(request: Request) {
  return userFromToken(tokenFromRequest(request).token);
}

/**
 * Safe to send to the browser. `permissions`: the chosen tabs (null = role default); `tabs`: what they can use;
 * `readOnly`: the read-only flag as set; `viewOnly`: whether it applies (never for admins).
 */
export const publicUser = (user: { id: number; email: string; name: string; role: string; permissions?: string | null; readOnly?: boolean | null; createdAt?: string }) => ({
  id: user.id, email: user.email, name: user.name, role: user.role,
  permissions: parsePermissions(user.permissions),
  tabs: allowedTabs(user),
  readOnly: Boolean(user.readOnly),
  viewOnly: isReadOnly(user),
  ...(user.createdAt ? { createdAt: user.createdAt } : {}),
});
