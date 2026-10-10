import { handleDbError, jsonError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { deleteCustomTemplate } from '@/lib/design/custom-templates';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** Deletes one of this site's own templates (drafts and live designs made from it are not touched). */
export async function DELETE(request: Request, { params }: Context) {
  const { error } = await requireTab(request, 'design');
  if (error) return error;
  try {
    return (await deleteCustomTemplate((await params).id)) ? new Response(null, { status: 204 }) : jsonError('Template not found.', 404);
  } catch (err) {
    return handleDbError(err);
  }
}
