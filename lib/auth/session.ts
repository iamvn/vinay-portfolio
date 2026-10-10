import { readToken, tokenFromRequest } from './token';
import { TAB_IDS, allowedTabs, isReadOnly, parsePermissions, parseSiteTabs } from './permissions';
import { findSessionUser } from './permissions-store';
import { currentSite } from '@/lib/sites/context';

/** `siteTabs`: the tabs this site may use at all (set by the platform owner; '' = all). */
export type SessionUser = { id: number; email: string; name: string; role: string; tokenVersion: number; permissions: string; readOnly: boolean; siteTabs: string };

/** Validates a token against the database: the user must exist and the token version must match. */
export async function userFromToken(token: string | null | undefined): Promise<SessionUser | null> {
  const claims = await readToken(token);
  if (!claims) return null;
  // A login only works on the site it was made on (each site has its own users with their own ids).
  const site = await currentSite();
  if (claims.site !== site.slug) return null;
  const user = await findSessionUser(Number(claims.sub));
  return user && user.tokenVersion === claims.ver ? { ...user, siteTabs: site.tabs } : null;
}

/** The current site's tab limit, to combine with users read from the database. */
export const currentSiteTabs = async () => (await currentSite()).tabs;

export async function userFromRequest(request: Request) {
  return userFromToken(tokenFromRequest(request).token);
}

/**
 * Safe to send to the browser. `permissions`: the chosen tabs (null = role default); `tabs`: what they can use;
 * `readOnly`: the read-only flag as set; `viewOnly`: whether it applies (never for admins).
 */
export const publicUser = (user: { id: number; email: string; name: string; role: string; permissions?: string | null; readOnly?: boolean | null; siteTabs?: string | null; createdAt?: string }) => ({
  id: user.id, email: user.email, name: user.name, role: user.role,
  permissions: parsePermissions(user.permissions),
  tabs: allowedTabs(user),
  /** Tabs the site may use at all: an admin can only give users these. */
  siteTabs: parseSiteTabs(user.siteTabs) ?? [...TAB_IDS],
  readOnly: Boolean(user.readOnly),
  viewOnly: isReadOnly(user),
  ...(user.createdAt ? { createdAt: user.createdAt } : {}),
});
