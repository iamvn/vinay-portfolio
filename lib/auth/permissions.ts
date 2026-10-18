/**
 * Per-user access to admin tabs.
 *
 * The platform owner chooses which tabs each site may use at all (Sites → Security → Admin tabs); that
 * limits everyone on the site, its own admins included. Within that, admins (and the owner) have every tab. For other users an admin ticks which tabs they may use
 * (Users & security → Access). The same list is enforced on the server: proxy.ts blocks API calls for
 * tabs a user doesn't have, so hiding a tab is never the only protection.
 *
 * "Users & security" is special: everyone sees it as "My account" (to change their own password), but
 * managing users and API tokens stays admin-only.
 */
export const TAB_IDS = ['profile', 'links', 'experience', 'skills', 'projects', 'copy', 'design', 'resume', 'builder', 'applications', 'progress', 'community', 'insights', 'ai', 'backup'] as const;
export type TabId = (typeof TAB_IDS)[number];

export const TAB_LABELS: Record<TabId, string> = {
  profile: 'Profile', links: 'Link card', experience: 'Experience', skills: 'Skills', projects: 'Projects', copy: 'Site text',
  design: 'Design', resume: 'Resume', builder: 'Resume builder', applications: 'Applications', progress: 'Progress tracker', community: 'Community', insights: 'Insights', ai: 'AI assistant', backup: 'Backup',
};

/** What an editor gets when no admin has chosen tabs for them (the access editors always had). */
export const EDITOR_DEFAULT_TABS: TabId[] = ['profile', 'links', 'experience', 'skills', 'projects', 'copy', 'resume', 'progress', 'backup'];

type Who = { role: string; permissions?: string | null; readOnly?: boolean | null; siteTabs?: string | null };

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

/** The tabs a whole site may use, as stored on the site ('' = all tabs, '-' = none). null = no limit. */
export const parseSiteTabs = (raw: string | null | undefined): TabId[] | null => parsePermissions(raw);

/** Stores a site's tab list: every tab → '' (no limit, so tabs added later are included too). */
export const serializeSiteTabs = (tabs: readonly string[]) => (TAB_IDS.every((tab) => tabs.includes(tab)) ? '' : serializePermissions(tabs));

export function allowedTabs(user: Who): TabId[] {
  const own = user.role === 'admin' ? [...TAB_IDS] : parsePermissions(user.permissions) ?? EDITOR_DEFAULT_TABS;
  const site = parseSiteTabs(user.siteTabs);
  return site ? own.filter((tab) => site.includes(tab)) : own;
}

export const canUseTab = (user: Who, tab: TabId) => allowedTabs(user).includes(tab);

/**
 * Read-only users (never admins) can open their tabs and look at everything, but can't change anything.
 * The only things they may still do are signing out and changing their own password.
 */
export const isReadOnly = (user: Who) => user.role !== 'admin' && Boolean(user.readOnly);
// Signing out, your own password, the resume builder's live preview (it only reads), and asking the platform
// owner for help or access (Support tab), and their own Progress tracker (personal, not site content).
const READ_ONLY_ALLOWED = /^\/api\/(auth\/(logout|password)|resume-builder\/compile|support|progress(\/.*)?)$/;
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
  [/^\/api\/insights(\/.*)?$/, 'insights'],
  [/^\/api\/forms(\/.*)?$/, 'insights'], // reading/deleting form messages (sending is public)
  [/^\/api\/ai(\/.*)?$/, 'ai'],
  [/^\/api\/resume-builder(\/.*)?$/, 'builder'],
  [/^\/api\/applications(\/.*)?$/, 'applications'],
  [/^\/api\/community(\/.*)?$/, 'community'],
  [/^\/api\/progress(\/.*)?$/, 'progress'],
  [/^\/api\/linkcard$/, 'links'],
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
