import { jsonError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { userFromRequest, type SessionUser } from './session';
import { TAB_LABELS, canUseTab, type TabId } from './permissions';

/**
 * admin  – everything, including adding, removing and changing the role of users.
 * editor – can edit all portfolio content and their own password (admin panel only), but can't manage
 *          users or use API tokens.
 *
 * The owner is the first admin account (the one created during setup). Nobody — not even
 * another admin — can remove the owner or change the owner's role.
 */
export const ROLES = ['admin', 'editor'] as const;
export type Role = (typeof ROLES)[number];

export const isAdmin = (user: { role: string } | null | undefined) => user?.role === 'admin';

type AdminCheck = { user: SessionUser; error?: never } | { user?: never; error: Response };

/** The signed-in user if they are an admin; otherwise a ready 401/403 response. */
export async function requireAdmin(request: Request): Promise<AdminCheck> {
  const user = await userFromRequest(request);
  if (!user) return { error: jsonError('Not logged in.', 401) };
  if (!isAdmin(user)) return { error: jsonError('Only admins can do this.', 403) };
  return { user };
}

/** The signed-in user if they may use this admin tab (admins always can); otherwise a ready 401/403 response. */
export async function requireTab(request: Request, tab: TabId): Promise<AdminCheck> {
  const user = await userFromRequest(request);
  if (!user) return { error: jsonError('Not logged in.', 401) };
  if (!canUseTab(user, tab)) return { error: jsonError(`You don't have access to ${TAB_LABELS[tab]}. Ask an admin to enable it for you.`, 403) };
  return { user };
}

/** Like requireTab, for things several tabs use (e.g. uploaded PDFs: Projects and Design). */
export async function requireAnyTab(request: Request, tabs: TabId[]): Promise<AdminCheck> {
  const user = await userFromRequest(request);
  if (!user) return { error: jsonError('Not logged in.', 401) };
  if (!tabs.some((tab) => canUseTab(user, tab))) return { error: jsonError(`You need access to ${tabs.map((t) => TAB_LABELS[t]).join(' or ')} for this.`, 403) };
  return { user };
}

/** Id of the owner: the oldest admin account. Stable, because the owner can't be demoted or removed. */
export async function ownerId(): Promise<number | null> {
  const owner = await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { id: 'asc' }, select: { id: true } });
  return owner?.id ?? null;
}
