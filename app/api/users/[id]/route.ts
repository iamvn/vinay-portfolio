import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { ROLES, ownerId, requireAdmin } from '@/lib/auth/roles';
import { publicUser } from '@/lib/auth/session';
import { TAB_IDS } from '@/lib/auth/permissions';
import { permissionsById, setPermissions } from '@/lib/auth/permissions-store';

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = 'User not found.';

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  name: z.string().trim().max(100).optional(),
  /** Tabs this user may use (non-admins). null = back to the default set. */
  permissions: z.union([z.array(z.enum(TAB_IDS)), z.null()]).optional(),
}).strict();

/**
 * Changes another user's role, name or tab access. Admins only.
 * You can't change your own role (so you can't lock yourself out), and nobody can change the owner's.
 */
export async function PATCH(request: Request, { params }: Context) {
  const { user: me, error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Send role, name and/or permissions.', 400);
  if (data.role && id === me.id) return jsonError('You can’t change your own role.', 400);
  try {
    if (data.role && id === (await ownerId())) return jsonError('The owner account’s role can’t be changed.', 403);
    const { permissions, ...fields } = data;
    const user = Object.keys(fields).length
      ? await prisma.user.update({ where: { id }, data: fields })
      : await prisma.user.findUniqueOrThrow({ where: { id } });
    if (permissions !== undefined) await setPermissions(id, permissions);
    return NextResponse.json(publicUser({ ...user, permissions: (await permissionsById()).get(id) ?? '' }));
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
