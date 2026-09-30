import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { clearLoginFailures, loginLockedFor, recordLoginFailure } from '@/lib/auth/rate-limit';
import { publicUser } from '@/lib/auth/session';
import { findSessionUser } from '@/lib/auth/permissions-store';
import { createToken, sessionCookie } from '@/lib/auth/token';

const loginSchema = z.object({ email: z.string().trim().toLowerCase().min(1), password: z.string().min(1) }).strict();

// Used to spend the same time on unknown emails, so response times don't reveal which emails exist.
let dummyHash: Promise<string> | null = null;

/** Body: { email, password }. Sets the session cookie; admins also get a Bearer token for API use. */
export async function POST(request: Request) {
  const { data, error } = await parseBody(request, loginSchema);
  if (error) return error;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const key = `${ip}|${data.email}`;
  const minutes = loginLockedFor(key);
  if (minutes) return jsonError(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 429);

  try {
    // Only the columns every database has; access settings are read below (and added first if missing).
    const user = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true, email: true, name: true, role: true, passwordHash: true, tokenVersion: true } });
    dummyHash ??= hashPassword('not-a-real-password');
    const valid = await verifyPassword(data.password, user?.passwordHash ?? (await dummyHash));
    if (!user || !valid) {
      recordLoginFailure(key);
      return jsonError('Incorrect email or password.', 401);
    }
    clearLoginFailures(key);
    const { token, expiresAt } = await createToken(user.id, user.tokenVersion);
    // Only admins get the token in the body (for curl/scripts); editors use the session cookie only.
    const apiToken = user.role === 'admin' ? { token, expiresAt: expiresAt.toISOString() } : {};
    const response = NextResponse.json({ user: publicUser((await findSessionUser(user.id)) ?? user), ...apiToken });
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (err) {
    return handleDbError(err);
  }
}
