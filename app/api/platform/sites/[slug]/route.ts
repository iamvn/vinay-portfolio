import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { removeSite, siteBySlug, updateSite } from '@/lib/sites/registry';
import { deleteSiteDatabase } from '@/lib/sites/provision';
import { publicSite, requirePlatformAdmin } from '@/lib/sites/platform';
import { addProjectDomain, removeProjectDomain, vercelApiConfigured } from '@/lib/sites/vercel';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ slug: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  status: z.enum(['active', 'suspended']),
  // Optional custom domain, e.g. "savibharti.com" (it must also be added to the Vercel project).
  domain: z.union([z.string().trim().toLowerCase().regex(/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, 'must be a domain like savibharti.com'), z.literal(''), z.null()]),
}).partial().strict();

/** Rename, suspend/resume, or set a custom domain. */
export async function PATCH(request: Request, { params }: Context) {
  const { error: denied } = await requirePlatformAdmin(request);
  if (denied) return denied;
  const { slug } = await params;
  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;
  try {
    const before = await siteBySlug(slug);
    if (!before || before.isMain) return jsonError('Site not found.', 404);
    const nextDomain = data.domain === undefined ? undefined : data.domain || null;
    // With the Vercel API set up, the domain is added to (and the old one removed from) the Vercel project too.
    if (nextDomain && nextDomain !== before.domain && vercelApiConfigured()) {
      const added = await addProjectDomain(nextDomain);
      if (!added.ok) return jsonError(added.message ?? 'Vercel could not add that domain.', 400);
    }
    const site = await updateSite(slug, { ...data, ...(nextDomain !== undefined ? { domain: nextDomain } : {}) });
    if (site && nextDomain !== undefined && before.domain && before.domain !== nextDomain && vercelApiConfigured()) await removeProjectDomain(before.domain);
    return site ? NextResponse.json(publicSite(site, request)) : jsonError('Site not found.', 404);
  } catch (err) {
    if (String(err).includes('UNIQUE')) return jsonError('Another site already uses that domain.', 409);
    console.error(err);
    return jsonError('Could not update the site.', 500);
  }
}

/** Deletes a site and its database permanently. Body: { confirm: "<slug>" }. */
export async function DELETE(request: Request, { params }: Context) {
  const { error: denied } = await requirePlatformAdmin(request);
  if (denied) return denied;
  const { slug } = await params;
  const { data, error } = await parseBody(request, z.object({ confirm: z.string() }).strict());
  if (error) return error;
  if (data.confirm !== slug) return jsonError(`Type the site address "${slug}" to confirm.`, 400);
  const site = await siteBySlug(slug);
  if (!site || site.isMain) return jsonError('Site not found.', 404);
  try {
    await deleteSiteDatabase(site);
    await removeSite(slug);
    if (site.domain && vercelApiConfigured()) await removeProjectDomain(site.domain);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return jsonError(err instanceof Error ? err.message : 'Could not delete the site.', 502);
  }
}
