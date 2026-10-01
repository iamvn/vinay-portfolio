import { NextResponse } from 'next/server';
import { currentSite } from '@/lib/sites/context';
import { jsonError } from '@/lib/api-utils';
import { isAdmin } from '@/lib/auth/roles';
import { userFromRequest } from '@/lib/auth/session';
import { createToken } from '@/lib/auth/token';

/** Issues a Bearer token (valid 7 days) for curl/scripts. Admins only. */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return jsonError('Not logged in.', 401);
  if (!isAdmin(user)) return jsonError('API tokens are only available to admins.', 403);
  const { token, expiresAt } = await createToken(user.id, user.tokenVersion, (await currentSite()).slug);
  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
}
