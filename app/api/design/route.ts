import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { designProblem, discardDraft, getDraft, getHistory, getPublished, saveDraft } from '@/lib/design/store';
import { templatesFor, type DesignData } from '@/lib/design/templates';
import { scopeFromRequest } from '@/lib/design/scope';

export const dynamic = 'force-dynamic';

/** Design status for Admin → Design: the draft, what's live, recent versions, templates. Admins only. */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'design');
  if (error) return error;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  try {
    const [draft, published, history] = await Promise.all([getDraft(scope), getPublished(scope), getHistory(scope)]);
    return NextResponse.json({
      draft,
      published: published && { savedAt: published.savedAt, savedBy: published.savedBy },
      // True when the draft has changes that aren't live yet.
      unpublishedChanges: Boolean(draft && (!published || JSON.stringify(draft.data) !== JSON.stringify(published.data))),
      history: history.map(({ savedAt, savedBy }, index) => ({ index, savedAt, savedBy })),
      templates: templatesFor(scope).map(({ id, name, description }) => ({ id, name, description })),
    });
  } catch (err) {
    return handleDbError(err);
  }
}

const draftSchema = z.object({ data: z.record(z.string(), z.unknown()) }).strict();

/** Saves the editor's work as the draft (not live). Body { data }. Admins only. */
export async function PUT(request: Request) {
  const { user, error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  const { data, error } = await parseBody(request, draftSchema);
  if (error) return error;
  const problem = designProblem(data.data, scope);
  if (problem) return jsonError(problem, 400);
  try {
    const draft = await saveDraft(data.data as DesignData, user.email, undefined, scope);
    return NextResponse.json({ savedAt: draft.savedAt });
  } catch (err) {
    return handleDbError(err);
  }
}

/** "Revert to live": discards draft changes so the draft matches what visitors see. Admins only. */
export async function DELETE(request: Request) {
  const { error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  try {
    const published = await discardDraft(scope);
    return NextResponse.json({ reverted: true, live: published ? 'custom' : 'classic' });
  } catch (err) {
    return handleDbError(err);
  }
}
