import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password';
import { userFromRequest } from '@/lib/auth/session';
import { createToken, sessionCookie } from '@/lib/auth/token';

const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string() }).strict();

/**
 * Changes the logged-in user's password. Every other session and token for this user stops
 * working; this browser gets a fresh session cookie (and the response includes a new token).
 */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return jsonError('Not logged in.', 401);
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  const problem = passwordProblem(data.newPassword);
  if (problem) return jsonError(problem, 400);

  try {
    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(data.currentPassword, record.passwordHash))) return jsonError('Current password is incorrect.', 400);
    if (await verifyPassword(data.newPassword, record.passwordHash)) return jsonError('The new password must be different.', 400);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword), tokenVersion: { increment: 1 } },
    });
    const { token, expiresAt } = await createToken(updated.id, updated.tokenVersion);
    const response = NextResponse.json({ ok: true, token, expiresAt: expiresAt.toISOString() });
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (err) {
    return handleDbError(err);
  }
}
