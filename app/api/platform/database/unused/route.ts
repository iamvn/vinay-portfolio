import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { requirePlatformOwner } from '@/lib/sites/platform';
import { deleteUnusedDatabase } from '@/lib/sites/database';
import { actorLabel, logActivity } from '@/lib/sites/activity';

export const dynamic = 'force-dynamic';

/** Platform owner only: deletes a Turso database no site uses. Body: { name, confirm: name }. */
export async function DELETE(request: Request) {
  const { user, site, error } = await requirePlatformOwner(request);
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, z.object({ name: z.string().regex(/^[a-z0-9-]{1,64}$/), confirm: z.string() }).strict());
  if (invalid) return invalid;
  if (data.confirm !== data.name) return jsonError(`Type "${data.name}" to confirm.`, 400);
  try {
    await deleteUnusedDatabase(data.name);
    await logActivity(site, actorLabel(user), 'data.cleaned', { what: 'Unused database', olderThan: '-', deleted: data.name, sites: 'none' }, { includeMain: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not delete the database.', 400);
  }
}
