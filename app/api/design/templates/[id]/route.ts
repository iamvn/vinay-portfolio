import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { deleteCustomTemplate, updateCustomTemplate } from '@/lib/design/custom-templates';
import { renameShared, unpublishShared } from '@/lib/design/shared-templates';
import { currentSite } from '@/lib/sites/context';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

const renameSchema = z.object({
  name: z.string().trim().min(1, 'Give it a name.').max(60),
  description: z.string().trim().max(300),
}).partial().strict();

/** Renames one of this site's templates (its published copy too, if any). Body { name?, description? }. */
export async function PATCH(request: Request, { params }: Context) {
  const { error } = await requireTab(request, 'design');
  if (error) return error;
  const { data, error: bad } = await parseBody(request, renameSchema);
  if (bad) return bad;
  try {
    const id = (await params).id;
    const next = await updateCustomTemplate(id, data);
    if (!next) return jsonError('Template not found.', 404);
    await renameShared((await currentSite()).slug, id, { name: next.name, description: next.description });
    return NextResponse.json(next);
  } catch (err) {
    return handleDbError(err);
  }
}

/** Deletes one of this site's own templates, and its published copy (drafts and live designs made from it stay). */
export async function DELETE(request: Request, { params }: Context) {
  const { error } = await requireTab(request, 'design');
  if (error) return error;
  try {
    const id = (await params).id;
    if (!(await deleteCustomTemplate(id))) return jsonError('Template not found.', 404);
    await unpublishShared((await currentSite()).slug, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
