/**
 * Per-user access to admin tabs.
 *
 * Admins (and the owner) always have every tab. For other users an admin ticks which tabs they may use
 * (Users & security → Access). The same list is enforced on the server: proxy.ts blocks API calls for
 * tabs a user doesn't have, so hiding a tab is never the only protection.
 *
 * "Users & security" is special: everyone sees it as "My account" (to change their own password), but
 * managing users and API tokens stays admin-only.
 */
export const TAB_IDS = ['profile', 'experience', 'skills', 'projects', 'copy', 'design', 'resume', 'insights', 'ai', 'backup'] as const;
export type TabId = (typeof TAB_IDS)[number];

export const TAB_LABELS: Record<TabId, string> = {
  profile: 'Profile', experience: 'Experience', skills: 'Skills', projects: 'Projects', copy: 'Site text',
  design: 'Design', resume: 'Resume', insights: 'Insights', ai: 'AI assistant', backup: 'Backup',
};

/** What an editor gets when no admin has chosen tabs for them (the access editors always had). */
export const EDITOR_DEFAULT_TABS: TabId[] = ['profile', 'experience', 'skills', 'projects', 'copy', 'resume', 'backup'];

type Who = { role: string; permissions?: string | null; readOnly?: boolean | null };

/** Stored as a comma-separated list; empty means "role default". Unknown names are ignored. */
export function parsePermissions(raw: string | null | undefined): TabId[] | null {
  if (!raw || !raw.trim()) return null;
  if (raw.trim() === '-') return []; // explicitly no content tabs
  return raw.split(',').map((item) => item.trim()).filter((item): item is TabId => (TAB_IDS as readonly string[]).includes(item));
}

export const serializePermissions = (tabs: readonly string[]) => {
  const valid = TAB_IDS.filter((tab) => tabs.includes(tab));
  return valid.length ? valid.join(',') : '-';
};

export function allowedTabs(user: Who): TabId[] {
  if (user.role === 'admin') return [...TAB_IDS];
  return parsePermissions(user.permissions) ?? EDITOR_DEFAULT_TABS;
}

export const canUseTab = (user: Who, tab: TabId) => allowedTabs(user).includes(tab);

/**
 * Read-only users (never admins) can open their tabs and look at everything, but can't change anything.
 * The only things they may still do are signing out and changing their own password.
 */
export const isReadOnly = (user: Who) => user.role !== 'admin' && Boolean(user.readOnly);
const READ_ONLY_ALLOWED = /^\/api\/auth\/(logout|password)$/;
export const blockedForReadOnly = (method: string, path: string) =>
  !['GET', 'HEAD', 'OPTIONS'].includes(method) && !READ_ONLY_ALLOWED.test(path);

const WRITE_GATED: [RegExp, TabId][] = [
  [/^\/api\/profile(-image)?$/, 'profile'],
  [/^\/api\/experience(\/.*)?$/, 'experience'],
  [/^\/api\/skills(\/.*)?$/, 'skills'],
  [/^\/api\/projects(\/.*)?$/, 'projects'],
  [/^\/api\/copy$/, 'copy'],
  [/^\/api\/resume$/, 'resume'],
];
const ALWAYS_GATED: [RegExp, TabId][] = [
  [/^\/api\/portfolio$/, 'backup'],
  [/^\/api\/design(\/.*)?$/, 'design'],
  [/^\/api\/insights$/, 'insights'],
  [/^\/api\/ai(\/.*)?$/, 'ai'],
];

/**
 * The tab an API request belongs to, or null when it isn't tied to one. Reading content (GET) is open to
 * any signed-in user because several tabs show it; changing it needs that content's tab.
 */
export function tabForRequest(method: string, path: string): TabId | null {
  for (const [pattern, tab] of ALWAYS_GATED) if (pattern.test(path)) return tab;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;
  for (const [pattern, tab] of WRITE_GATED) if (pattern.test(path)) return tab;
  return null;
}
