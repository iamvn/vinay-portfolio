import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseId } from '@/lib/api-utils';
import { userFromRequest } from '@/lib/auth/session';

type Context = { params: Promise<{ id: string }> };

/** Removes an admin. You can't remove yourself (so there is always at least one admin). */
export async function DELETE(request: Request, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const me = await userFromRequest(request);
  if (!me) return jsonError('Not logged in.', 401);
  if (me.id === id) return jsonError('You can’t remove your own account.', 400);
  try {
    await prisma.user.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, 'User not found.');
  }
}
