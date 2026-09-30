import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { ROLES, ownerId, requireAdmin } from '@/lib/auth/roles';
import { publicUser } from '@/lib/auth/session';
import { TAB_IDS } from '@/lib/auth/permissions';
import { setAccess } from '@/lib/auth/permissions-store';

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = 'User not found.';

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  name: z.string().trim().max(100).optional(),
  /** Tabs this user may use (non-admins). null = back to the default set. */
  permissions: z.union([z.array(z.enum(TAB_IDS)), z.null()]).optional(),
  /** Non-admins: can view the admin panel but not change anything. */
  readOnly: z.boolean().optional(),
}).strict();

/**
 * Changes another user's role, name, tab access or read-only flag. Admins only.
 * You can't change your own role (so you can't lock yourself out), and nobody can change the owner's.
 */
export async function PATCH(request: Request, { params }: Context) {
  const { user: me, error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Send role, name, permissions and/or readOnly.', 400);
  if (data.role && id === me.id) return jsonError('You can’t change your own role.', 400);
  try {
    if (data.role && id === (await ownerId())) return jsonError('The owner account’s role can’t be changed.', 403);
    const { permissions, readOnly, ...fields } = data;
    const user = Object.keys(fields).length
      ? await prisma.user.update({ where: { id }, data: fields })
      : await prisma.user.findUniqueOrThrow({ where: { id } });
    const access = await setAccess(id, { permissions, readOnly });
    return NextResponse.json(publicUser({ ...user, ...access }));
  } catch (err) {
    return handleDbError(err, NOT_FOUND);
  }
}

/** Removes a user and signs them out everywhere. Admins only; not yourself, and never the owner. */
export async function DELETE(request: Request, { params }: Context) {
  const { user: me, error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  if (me.id === id) return jsonError('You can’t remove your own account.', 400);
  try {
    if (id === (await ownerId())) return jsonError('The owner account can’t be removed.', 403);
    await prisma.user.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}
