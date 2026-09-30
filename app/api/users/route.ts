import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { ROLES, ownerId, requireAdmin } from '@/lib/auth/roles';
import { publicUser } from '@/lib/auth/session';
import { TAB_IDS } from '@/lib/auth/permissions';
import { accessById, setAccess } from '@/lib/auth/permissions-store';

export const dynamic = 'force-dynamic';

const newUserSchema = z.object({
  email: z.email('must be a valid email address').trim().toLowerCase(),
  name: z.string().trim().max(100).optional().default(''),
  password: z.string(),
  role: z.enum(ROLES).optional().default('editor'),
  permissions: z.array(z.enum(TAB_IDS)).optional(), // tabs a non-admin may use; omit for the default set
  readOnly: z.boolean().optional(), // non-admins: view only, no changes
}).strict();

/** Lists all users. Admins only. */
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const [users, owner, access] = await Promise.all([prisma.user.findMany({ orderBy: { id: 'asc' } }), ownerId(), accessById()]);
    return NextResponse.json(users.map((user) => ({ ...publicUser({ ...user, ...access.get(user.id) }), owner: user.id === owner })));
  } catch (err) {
    return handleDbError(err);
  }
}

/** Adds a user. Admins only. Body: { email, name?, password, role?, permissions?, readOnly? } — role is "editor" unless "admin" is given. */
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
    const access = data.role === 'admin'
      ? { permissions: '', readOnly: false }
      : await setAccess(user.id, { permissions: data.permissions, readOnly: data.readOnly ?? false });
    return NextResponse.json(publicUser({ ...user, ...access }), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
