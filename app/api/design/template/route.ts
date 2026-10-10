import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { saveDraft } from '@/lib/design/store';
import { templatesFor } from '@/lib/design/templates';
import { scopeFromRequest } from '@/lib/design/scope';

/** Replaces the draft with a template (nothing goes live until Publish). Body { id }. Admins only. */
export async function POST(request: Request) {
  const { user, error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  const { data, error } = await parseBody(request, z.object({ id: z.string() }).strict());
  if (error) return error;
  const template = templatesFor(scope).find((t) => t.id === data.id);
  if (!template) return jsonError('Unknown template.', 404);
  try {
    const draft = await saveDraft(structuredClone(template.data), user.email, template.id, scope);
    return NextResponse.json({ savedAt: draft.savedAt, template: template.id });
  } catch (err) {
    return handleDbError(err);
  }
}
