import { jsonError } from '@/lib/api-utils';
import { requireAnyTab } from '@/lib/auth/roles';
import { deleteAsset, getAsset } from '@/lib/assets';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** Deletes an uploaded PDF. Blocks or projects that still show it fall back to "document not found". */
export async function DELETE(request: Request, { params }: Context) {
  const { error } = await requireAnyTab(request, ['design', 'projects']);
  if (error) return error;
  const { id } = await params;
  if (!(await getAsset(id))) return jsonError('Document not found.', 404);
  await deleteAsset(id);
  return new Response(null, { status: 204 });
}
