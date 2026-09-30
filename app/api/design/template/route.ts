import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { saveDraft } from '@/lib/design/store';
import { templateById } from '@/lib/design/templates';

/** Replaces the draft with a template (nothing goes live until Publish). Body { id }. Admins only. */
export async function POST(request: Request) {
  const { user, error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, z.object({ id: z.string() }).strict());
  if (error) return error;
  const template = templateById(data.id);
  if (!template) return jsonError('Unknown template.', 404);
  try {
    const draft = await saveDraft(structuredClone(template.data), user.email, template.id);
    return NextResponse.json({ savedAt: draft.savedAt, template: template.id });
  } catch (err) {
    return handleDbError(err);
  }
}
