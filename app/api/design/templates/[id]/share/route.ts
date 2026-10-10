import { NextResponse } from 'next/server';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { getCustomTemplate } from '@/lib/design/custom-templates';
import { SharedLimitError, publishShared, sharedFor, unpublishShared } from '@/lib/design/shared-templates';
import { actorLabel, logActivity } from '@/lib/sites/activity';
import { currentSite } from '@/lib/sites/context';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/**
 * Publishes one of this site's templates to every site's template list, credited to the person publishing it
 * (their name, else the site's). Publishing again refreshes the shared copy.
 */
export async function POST(request: Request, { params }: Context) {
  const { user, error } = await requireTab(request, 'design');
  if (error) return error;
  try {
    const template = await getCustomTemplate((await params).id);
    if (!template) return jsonError('Template not found.', 404);
    const site = await currentSite();
    const siteName = site.isMain ? 'Main site' : site.name;
    const shared = await publishShared({
      site: site.slug, siteName, source: template.id, kind: template.kind, name: template.name, description: template.description,
      theme: template.theme, blocks: template.blocks, author: user.name.trim() || siteName, data: template.data,
    });
    await logActivity(site, actorLabel(user), 'design.shared', { name: shared.name, kind: shared.kind === 'home' ? 'homepage' : 'project page' }, { includeMain: true });
    return NextResponse.json(shared, { status: 201 });
  } catch (err) {
    if (err instanceof SharedLimitError) return jsonError(err.message, 400);
    return handleDbError(err);
  }
}

/** Stops sharing it (pages already made from it are not affected). */
export async function DELETE(request: Request, { params }: Context) {
  const { user, error } = await requireTab(request, 'design');
  if (error) return error;
  try {
    const site = await currentSite();
    const id = (await params).id;
    const shared = await sharedFor(site.slug, id);
    if (!shared || !(await unpublishShared(site.slug, id))) return jsonError('That template isn’t published.', 404);
    await logActivity(site, actorLabel(user), 'design.unshared', { name: shared.name }, { includeMain: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
