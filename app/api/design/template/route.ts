import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { saveDraft } from '@/lib/design/store';
import { templatesFor } from '@/lib/design/templates';
import { scopeFromRequest } from '@/lib/design/scope';
import { getCustomTemplate, isCustomId } from '@/lib/design/custom-templates';
import { getShared, isSharedId } from '@/lib/design/shared-templates';
import { kindOf } from '@/lib/design/ai-template';

/** Replaces the draft with a template, built-in or one of the site's own (nothing goes live until Publish). Body { id }. */
export async function POST(request: Request) {
  const { user, error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  const { data, error } = await parseBody(request, z.object({ id: z.string() }).strict());
  if (error) return error;
  try {
    // Built-in templates, or one this site made (Create a template with AI) for this kind of page.
    // …or one someone published for every site.
    const custom = isCustomId(data.id) ? await getCustomTemplate(data.id) : isSharedId(data.id) ? await getShared(data.id) : null;
    const template = custom && custom.kind === kindOf(scope) ? custom : templatesFor(scope).find((t) => t.id === data.id);
    if (!template) return jsonError('Unknown template.', 404);
    const draft = await saveDraft(structuredClone(template.data), user.email, template.id, scope);
    return NextResponse.json({ savedAt: draft.savedAt, template: template.id });
  } catch (err) {
    return handleDbError(err);
  }
}
