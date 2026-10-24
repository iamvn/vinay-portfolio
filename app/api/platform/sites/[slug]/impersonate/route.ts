import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { createHandoff } from '@/lib/auth/token';
import { actorLabel, logActivity } from '@/lib/sites/activity';
import { requirePlatformOwner, siteLink } from '@/lib/sites/platform';
import { siteBySlug } from '@/lib/sites/registry';

export const dynamic = 'force-dynamic';

/**
 * Sites → "Log in as admin" (platform owner only): returns a link that signs the owner in to that site's
 * admin panel as its admin, for 2 hours, without knowing or changing their password. The link works once,
 * within 60 seconds. Recorded in Activity logs.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { user, error } = await requirePlatformOwner(request);
  if (error) return error;
  const site = await siteBySlug((await params).slug, true);
  if (!site || site.isMain) return jsonError('Site not found.', 404);
  if (site.status === 'suspended') return jsonError('This site is paused. Resume it first to open its admin.', 409);
  const address = siteLink(site, request);
  if (!address) return jsonError('This site has no address yet, so its admin can’t be opened.', 409);
  const by = actorLabel(user);
  const pass = await createHandoff(site.slug, by, randomBytes(16).toString('hex'));
  await logActivity(site, by, 'user.impersonated', { step: 'requested' }, { includeMain: true });
  return NextResponse.json({ url: `${address.replace(/\/+$/, '')}/api/auth/impersonate?pass=${encodeURIComponent(pass)}` });
}
