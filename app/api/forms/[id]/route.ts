import { handleDbError, jsonError, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { deleteSubmission } from '@/lib/forms';

export const dynamic = 'force-dynamic';

/** Deletes one form message. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireTab(request, 'insights');
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    return (await deleteSubmission(id)) ? new Response(null, { status: 204 }) : jsonError('Message not found.', 404);
  } catch (err) {
    return handleDbError(err);
  }
}
