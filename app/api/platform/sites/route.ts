import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { passwordProblem } from '@/lib/auth/password';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/lib/sites/hosts';
import { insertSite, listSites, siteBySlug } from '@/lib/sites/registry';
import { createSiteDatabase, deleteSiteDatabase, prepareSiteDatabase } from '@/lib/sites/provision';
import { platformInfo, publicSite, requirePlatformAdmin } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const createSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, 'must be 3–40 lowercase letters, numbers or hyphens (e.g. "savi-bharti")'),
  name: z.string().trim().min(1, 'must not be empty').max(100),
  ownerEmail: z.email('must be a valid email address').trim().toLowerCase(),
  ownerPassword: z.string(),
}).strict();

/** All sites (main site admins only). */
export async function GET(request: Request) {
  const { error } = await requirePlatformAdmin(request);
  if (error) return error;
  const sites = await listSites();
  return NextResponse.json({ sites: sites.map((site) => publicSite(site, request)), platform: platformInfo(request) });
}

/**
 * Creates a site: its own database, a copy of the main site's portfolio content and design (with the
 * owner's name and email), and the owner's admin account. Body: { slug, name, ownerEmail, ownerPassword }.
 */
export async function POST(request: Request) {
  const { error: denied } = await requirePlatformAdmin(request);
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
    await prepareSiteDatabase(database, { name: data.name, email: data.ownerEmail, password: data.ownerPassword });
    const site = { slug: data.slug, name: data.name, ownerEmail: data.ownerEmail, domain: null, ...database, status: 'active' as const, createdAt: new Date().toISOString() };
    await insertSite(site);
    return NextResponse.json(publicSite({ ...site, isMain: false }, request), { status: 201 });
  } catch (err) {
    console.error('Creating site failed:', err);
    // Don't leave a half-made database behind.
    if (database) await deleteSiteDatabase({ ...database, slug: data.slug, isMain: false } as never).catch(() => null);
    return jsonError(err instanceof Error ? err.message : 'Could not create the site.', 502);
  }
}
