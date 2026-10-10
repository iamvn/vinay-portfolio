import { handleDbError, jsonError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { getShared, removeShared } from '@/lib/design/shared-templates';
import { actorLabel, logActivity } from '@/lib/sites/activity';
import { currentSite } from '@/lib/sites/context';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** Removes a shared template: its own site may, and so may the platform owner (moderation). */
export async function DELETE(request: Request, { params }: Context) {
  const { user, error } = await requireTab(request, 'design');
  if (error) return error;
  try {
    const shared = await getShared((await params).id);
    if (!shared) return jsonError('Template not found.', 404);
    const site = await currentSite();
    const owner = site.isMain && user.role === 'admin';
    if (shared.site !== site.slug && !owner) return jsonError('Only the site that published it (or the platform owner) can remove it.', 403);
    await removeShared(shared.id);
    await logActivity(site, actorLabel(user), 'design.unshared', { name: shared.name, from: shared.siteName }, { includeMain: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
