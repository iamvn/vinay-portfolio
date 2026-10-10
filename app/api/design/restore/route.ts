import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { getHistory, saveDraft } from '@/lib/design/store';
import { scopeFromRequest } from '@/lib/design/scope';

/** Loads a previously published version into the draft (publish it to make it live). Body { index }. Admins only. */
export async function POST(request: Request) {
  const { user, error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  const { data, error } = await parseBody(request, z.object({ index: z.number().int().min(0) }).strict());
  if (error) return error;
  try {
    const version = (await getHistory(scope))[data.index];
    if (!version) return jsonError('That version no longer exists.', 404);
    const draft = await saveDraft(version.data, user.email, undefined, scope);
    return NextResponse.json({ savedAt: draft.savedAt });
  } catch (err) {
    return handleDbError(err);
  }
}
