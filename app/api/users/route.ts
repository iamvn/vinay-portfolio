import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { publicUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const newUserSchema = z.object({
  email: z.email('must be a valid email address').trim().toLowerCase(),
  name: z.string().trim().max(100).optional().default(''),
  password: z.string(),
}).strict();

export async function GET() {
  try {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(users.map(publicUser));
  } catch (error) {
    return handleDbError(error);
  }
}

/** Adds an admin. Body: { email, name?, password }. The new admin can change their password after logging in. */
export async function POST(request: Request) {
  const { data, error } = await parseBody(request, newUserSchema);
  if (error) return error;
  const problem = passwordProblem(data.password);
  if (problem) return jsonError(problem, 400);
  try {
    const user = await prisma.user.create({
      data: { email: data.email, name: data.name, role: 'admin', passwordHash: await hashPassword(data.password), createdAt: new Date().toISOString() },
    });
    return NextResponse.json(publicUser(user), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
