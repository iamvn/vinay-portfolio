import { jsonError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { currentSite } from './context';
import { MAIN_SLUG, rootDomain, siteAddress } from './hosts';
import type { Site } from './registry';

/** Managing sites is only possible on the main site, by its admins. */
export async function requirePlatformAdmin(request: Request) {
  const site = await currentSite();
  if (!site.isMain) return { error: jsonError('Not found.', 404) };
  return requireAdmin(request);
}

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
});

export const platformInfo = (request: Request) => ({
  rootDomain: rootDomain() || null,
  turso: Boolean(process.env.TURSO_API_TOKEN?.trim() && process.env.TURSO_ORG?.trim()),
  onVercel: Boolean(process.env.VERCEL),
  exampleUrl: siteLink({ slug: 'savi-bharti', domain: null }, request),
  mainSlug: MAIN_SLUG,
});
