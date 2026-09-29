import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { publicUser, userFromRequest } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  return user ? NextResponse.json(publicUser(user)) : jsonError('Not logged in.', 401);
}
