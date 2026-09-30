import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { ROLES, ownerId, requireAdmin } from '@/lib/auth/roles';
import { publicUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const newUserSchema = z.object({
  email: z.email('must be a valid email address').trim().toLowerCase(),
  name: z.string().trim().max(100).optional().default(''),
  password: z.string(),
  role: z.enum(ROLES).optional().default('editor'),
}).strict();

/** Lists all users. Admins only. */
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const [users, owner] = await Promise.all([prisma.user.findMany({ orderBy: { id: 'asc' } }), ownerId()]);
    return NextResponse.json(users.map((user) => ({ ...publicUser(user), owner: user.id === owner })));
  } catch (err) {
    return handleDbError(err);
  }
}

/** Adds a user. Admins only. Body: { email, name?, password, role? } — role is "editor" unless "admin" is given. */
export async function POST(request: Request) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, newUserSchema);
  if (error) return error;
  const problem = passwordProblem(data.password);
  if (problem) return jsonError(problem, 400);
  try {
    const user = await prisma.user.create({
      data: { email: data.email, name: data.name, role: data.role, passwordHash: await hashPassword(data.password), createdAt: new Date().toISOString() },
    });
    return NextResponse.json(publicUser(user), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
