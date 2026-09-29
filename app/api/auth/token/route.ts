import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { userFromRequest } from '@/lib/auth/session';
import { createToken } from '@/lib/auth/token';

/** Issues a Bearer token (valid 7 days) for the logged-in user, for use with curl/scripts. */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return jsonError('Not logged in.', 401);
  const { token, expiresAt } = await createToken(user.id, user.tokenVersion);
  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
}
