import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { designProblem, discardDraft, getDraft, getHistory, getPublished, saveDraft } from '@/lib/design/store';
import { TEMPLATES, type DesignData } from '@/lib/design/templates';

export const dynamic = 'force-dynamic';

/** Design status for Admin → Design: the draft, what's live, recent versions, templates. Admins only. */
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const [draft, published, history] = await Promise.all([getDraft(), getPublished(), getHistory()]);
    return NextResponse.json({
      draft,
      published: published && { savedAt: published.savedAt, savedBy: published.savedBy },
      // True when the draft has changes that aren't live yet.
      unpublishedChanges: Boolean(draft && (!published || JSON.stringify(draft.data) !== JSON.stringify(published.data))),
      history: history.map(({ savedAt, savedBy }, index) => ({ index, savedAt, savedBy })),
      templates: TEMPLATES.map(({ id, name, description }) => ({ id, name, description })),
    });
  } catch (err) {
    return handleDbError(err);
  }
}

const draftSchema = z.object({ data: z.record(z.string(), z.unknown()) }).strict();

/** Saves the editor's work as the draft (not live). Body { data }. Admins only. */
export async function PUT(request: Request) {
  const { user, error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, draftSchema);
  if (error) return error;
  const problem = designProblem(data.data);
  if (problem) return jsonError(problem, 400);
  try {
    const draft = await saveDraft(data.data as DesignData, user.email);
    return NextResponse.json({ savedAt: draft.savedAt });
  } catch (err) {
    return handleDbError(err);
  }
}

/** "Revert to live": discards draft changes so the draft matches what visitors see. Admins only. */
export async function DELETE(request: Request) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  try {
    const published = await discardDraft();
    return NextResponse.json({ reverted: true, live: published ? 'custom' : 'classic' });
  } catch (err) {
    return handleDbError(err);
  }
}
