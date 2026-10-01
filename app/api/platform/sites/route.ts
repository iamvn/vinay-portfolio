import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { passwordProblem } from '@/lib/auth/password';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/lib/sites/hosts';
import { insertSite, listSites, siteBySlug } from '@/lib/sites/registry';
import { createSiteDatabase, deleteSiteDatabase, prepareSiteDatabase } from '@/lib/sites/provision';
import { canSeeSite, platformInfo, publicSite, requirePlatformAdmin } from '@/lib/sites/platform';
import { actorLabel, listActivity, logActivity } from '@/lib/sites/activity';
import { rootDomain } from '@/lib/sites/hosts';
import { addProjectDomain, vercelApiConfigured } from '@/lib/sites/vercel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const createSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, 'must be 3–40 lowercase letters, numbers or hyphens (e.g. "savi-bharti")'),
  name: z.string().trim().min(1, 'must not be empty').max(100),
  ownerEmail: z.email('must be a valid email address').trim().toLowerCase(),
  ownerPassword: z.string(),
}).strict();

/**
 * The sites this admin manages: every site for the main site's admins (plus what other sites' admins did),
 * only their own sites for an admin of a site that's allowed to create sites.
 */
export async function GET(request: Request) {
  const { site: manager, error } = await requirePlatformAdmin(request);
  if (error) return error;
  const sites = (await listSites()).filter((site) => canSeeSite(manager, site));
  const activity = manager.isMain ? await listActivity() : [];
  return NextResponse.json({ sites: sites.map((site) => publicSite(site, request)), platform: platformInfo(request, manager), activity });
}

/**
 * Creates a site: its own database, a copy of the main site's portfolio content and design (with the
 * owner's name and email), and the owner's admin account. Body: { slug, name, ownerEmail, ownerPassword }.
 */
export async function POST(request: Request) {
  const { user, site: manager, error: denied } = await requirePlatformAdmin(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, createSchema);
  if (error) return error;
  if (RESERVED_SLUGS.has(data.slug)) return jsonError(`"${data.slug}" is reserved. Pick another address.`, 400);
  const problem = passwordProblem(data.ownerPassword);
  if (problem) return jsonError(problem, 400);
  if (await siteBySlug(data.slug)) return jsonError(`A site called "${data.slug}" already exists.`, 409);

  let database: Awaited<ReturnType<typeof createSiteDatabase>> | null = null;
  try {
    database = await createSiteDatabase(data.slug);
    // The new site starts as a copy of the site it was created from.
    await prepareSiteDatabase(database, { name: data.name, email: data.ownerEmail, password: data.ownerPassword }, manager.isMain ? undefined : manager);
    // No domain of your own yet: give the site a free <address>.vercel.app on this project (when the Vercel API is set up).
    let domain: string | null = null;
    let note: string | undefined;
    if (!rootDomain() && vercelApiConfigured()) {
      const free = `${data.slug}.vercel.app`;
      const added = await addProjectDomain(free);
      if (added.ok) domain = free;
      else note = `${added.message} You can set another address under the site's custom domain.`;
    }
    const site = {
      slug: data.slug, name: data.name, ownerEmail: data.ownerEmail, domain, ...database, status: 'active' as const, createdAt: new Date().toISOString(),
      createdBy: manager.isMain ? '' : manager.slug, createdByUser: actorLabel(user),
    };
    await insertSite(site);
    await logActivity(manager, actorLabel(user), 'site.created', { slug: site.slug, name: site.name, ownerEmail: site.ownerEmail, ...(domain ? { domain } : {}) });
    return NextResponse.json({ ...publicSite({ ...site, isMain: false, canAddUsers: false, canAddSites: false }, request), note }, { status: 201 });
  } catch (err) {
    console.error('Creating site failed:', err);
    // Don't leave a half-made database behind.
    if (database) await deleteSiteDatabase({ ...database, slug: data.slug, isMain: false } as never).catch(() => null);
    return jsonError(err instanceof Error ? err.message : 'Could not create the site.', 502);
  }
}
