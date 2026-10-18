import { createHash } from 'node:crypto';
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
 * Community → Free resources: anyone can add a link (no login). Signed-in members get a "member" mark with
 * their site, so people can tell who shared it. The founder's name is reserved for the platform owner.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError('Cross-site request blocked.', 403);
  const ip = clientIp(request);
  if (rateLimited(`resource:${ip}`, 10, 60 * 60 * 1000)) return jsonError('You’re adding links quickly. Please take a short break and try again.', 429);
  const { data, error } = await parseBody(request, resourceSchema);
  if (error) return error;
  if (data.website) return NextResponse.json({ ok: true }, { status: 201 }); // a bot filled in the hidden field
  try {
    const user = await userFromRequest(request).catch(() => null);
    let verified: { site: string; url: string } | null = null;
    let isOwner = false;
    if (user) {
      const { site, name, url } = await postingSite();
      verified = { site: name || site.name, url };
      isOwner = site.isMain && user.id === (await ownerId());
    }
    if (!isOwner && simple(data.name) === simple(BRAND.founder.name)) return jsonError('That name is reserved. Please use your own name.', 400);
    const sender = user ? `user:${verified?.url}:${user.id}` : createHash('sha256').update(`${process.env.AUTH_SECRET || 'kritipath'}|resource|${ip}`).digest('base64url').slice(0, 22);
    const resource = await addResource(data, sender, verified);
    return NextResponse.json(resource, { status: 201 });
  } catch (err) {
    if (err instanceof ResourceError) return jsonError(err.message, err.status);
    return handleDbError(err);
  }
}
