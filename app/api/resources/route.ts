import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { userFromRequest } from '@/lib/auth/session';
import { ownerId } from '@/lib/auth/roles';
import { postingSite } from '@/lib/community/author';
import { resourceSchema } from '@/lib/community/resource-types';
import { ResourceError, addResource } from '@/lib/community/resources';
import { BRAND } from '@/lib/brand';
import { clientIp, rateLimited } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host')); } catch { return false; }
};
const simple = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Community → Free resources: people signed in to a site on the platform add links (reading is open to all).
 * The name shown is the account's own, so nobody can post as someone else; the founder's name is reserved
 * for the platform owner.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError('Cross-site request blocked.', 403);
  const user = await userFromRequest(request).catch(() => null);
  if (!user) return jsonError('Sign in to your site to share a resource.', 401);
  if (rateLimited(`resource:${user.id}:${clientIp(request)}`, 10, 60 * 60 * 1000)) return jsonError('You’re adding links quickly. Please take a short break and try again.', 429);
  const { data, error } = await parseBody(request, resourceSchema);
  if (error) return error;
  try {
    const { site, name: siteName, url } = await postingSite();
    const isOwner = site.isMain && user.id === (await ownerId());
    const name = (user.name?.trim() || siteName || site.name).slice(0, 60);
    if (!isOwner && simple(name) === simple(BRAND.founder.name)) return jsonError('That name is reserved. Change the name on your account to share.', 400);
    const resource = await addResource({ ...data, name }, `user:${site.slug}:${user.id}`, { site: siteName || site.name, url });
    return NextResponse.json(resource, { status: 201 });
  } catch (err) {
    if (err instanceof ResourceError) return jsonError(err.message, err.status);
    return handleDbError(err);
  }
}
