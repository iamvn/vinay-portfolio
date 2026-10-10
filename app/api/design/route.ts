import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { designProblem, discardDraft, getDraft, getHistory, getPublished, saveDraft } from '@/lib/design/store';
import { templatesFor, type DesignData } from '@/lib/design/templates';
import { scopeFromRequest } from '@/lib/design/scope';
import { listCustomTemplates } from '@/lib/design/custom-templates';
import { kindOf } from '@/lib/design/ai-template';
import { hasFeature } from '@/lib/sites/require-feature';
import { listShared } from '@/lib/design/shared-templates';
import { seedOwnerTemplates } from '@/lib/design/owner-seed';
import { currentSite } from '@/lib/sites/context';

export const dynamic = 'force-dynamic';

/** Design status for Admin → Design: the draft, what's live, recent versions, templates. Admins only. */
export async function GET(request: Request) {
  const { user, error } = await requireTab(request, 'design');
  if (error) return error;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  try {
    // The platform owner's ready-made templates arrive in the main site's "Your templates" (private until published).
    if ((await currentSite()).isMain) await seedOwnerTemplates().catch((err) => console.error('Owner templates:', err));
    const [draft, published, history, custom, aiTemplates, shared, site] = await Promise.all([getDraft(scope), getPublished(scope), getHistory(scope), listCustomTemplates(kindOf(scope)), hasFeature('aiTemplates'), listShared(kindOf(scope)), currentSite()]);
    const sharedSources = new Map(shared.filter((t) => t.site === site.slug).map((t) => [t.source, t.updatedAt]));
    return NextResponse.json({
      draft,
      published: published && { savedAt: published.savedAt, savedBy: published.savedBy },
      // True when the draft has changes that aren't live yet.
      unpublishedChanges: Boolean(draft && (!published || JSON.stringify(draft.data) !== JSON.stringify(published.data))),
      history: history.map(({ savedAt, savedBy }, index) => ({ index, savedAt, savedBy })),
      templates: templatesFor(scope).map(({ id, name, description }) => ({ id, name, description })),
      // This site's own templates (Create a template with AI), newest first.
      customTemplates: custom.map((t) => ({ ...t, publishedAt: sharedSources.get(t.id) ?? null })),
      // Templates people on every site published, credited to their author; mine/canRemove for the buttons.
      sharedTemplates: shared.map(({ source: _source, site: from, ...t }) => ({ ...t, mine: from === site.slug, canRemove: from === site.slug || (site.isMain && user.role === 'admin') })), // eslint-disable-line @typescript-eslint/no-unused-vars
      // Create a template with AI: only when the platform owner turned it on for this site.
      aiTemplates,
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
