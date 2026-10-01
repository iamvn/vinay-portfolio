import { jsonError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { currentSite } from './context';
import { MAIN_SLUG, rootDomain, siteAddress } from './hosts';
import { siteBySlug, type Site } from './registry';
import { vercelApiConfigured } from './vercel';

type PlatformCheck =
  | { user: SessionUser; site: Site; error?: never }
  | { user?: never; site?: never; error: Response };

/**
 * Who may manage sites: the main site's admins (all sites), and admins of a site the main admin allowed to
 * create sites (Admin → Sites → Security), who only see and manage the sites they created.
 * The site's settings are read fresh, so switching the permission off applies at once.
 */
export async function requirePlatformAdmin(request: Request): Promise<PlatformCheck> {
  const current = await currentSite();
  const site = current.isMain ? current : await siteBySlug(current.slug, true);
  if (!site || (!site.isMain && !site.canAddSites)) return { error: jsonError('Creating sites is not enabled for this site. Ask the platform owner.', 403) };
  const { user, error } = await requireAdmin(request);
  if (error) return { error };
  return { user, site };
}

/** On sites other than the main one, adding users needs the main admin's permission (Admin → Sites → Security). */
export async function canAddUsersHere() {
  const current = await currentSite();
  if (current.isMain) return { site: current, allowed: true };
  const site = (await siteBySlug(current.slug, true)) ?? current; // fresh: switching it off applies at once
  return { site, allowed: site.canAddUsers };
}

/** The sites a manager sees: every site for the main site, only the ones it created otherwise. */
export const canSeeSite = (manager: Site, site: Site) => manager.isMain || site.createdBy === manager.slug;

/** Where a site can be opened: its subdomain/custom domain, or <slug>.localhost while developing. */
export function siteLink(site: Pick<Site, 'slug' | 'domain'>, request: Request) {
  const address = siteAddress(site);
  if (address) return address;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const local = host.match(/^(?:[\w-]+\.)?localhost(:\d+)?$/);
  if (local) return `http://${site.slug}.localhost${local[1] ?? ''}`;
  return null;
}

export const publicSite = (site: Site, request: Request) => ({
  slug: site.slug, name: site.name, ownerEmail: site.ownerEmail, domain: site.domain, status: site.status, createdAt: site.createdAt,
  url: siteLink(site, request), storage: site.dbName ? 'turso' : site.dbUrl.startsWith('file:') ? 'local file' : 'database',
  canAddUsers: site.canAddUsers, canAddSites: site.canAddSites, siteLimit: site.isMain ? null : site.siteLimit, createdBy: site.createdBy, createdByUser: site.createdByUser,
});

export const platformInfo = (request: Request, manager: Site, created = 0) => ({
  isMain: manager.isMain,
  // Other sites' admins: how many sites they may create, and how many they have (null = no limit, main site).
  siteLimit: manager.isMain ? null : manager.siteLimit,
  sitesCreated: created,
  rootDomain: rootDomain() || null,
  turso: Boolean(process.env.TURSO_API_TOKEN?.trim() && process.env.TURSO_ORG?.trim()),
  onVercel: Boolean(process.env.VERCEL),
  vercelApi: vercelApiConfigured(),
  exampleUrl: siteLink({ slug: 'savi-bharti', domain: null }, request),
  mainSlug: MAIN_SLUG,
});
