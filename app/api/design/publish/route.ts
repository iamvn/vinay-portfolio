import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { designProblem, getDraft, publish, removeScope, unpublish } from '@/lib/design/store';
import type { DesignData } from '@/lib/design/templates';
import { pathsFor, scopeFromRequest } from '@/lib/design/scope';

export const dynamic = 'force-dynamic';

const publishSchema = z.object({ data: z.record(z.string(), z.unknown()).optional() }).strict();

/** Makes a design live. Body { data } publishes that design; an empty body publishes the saved draft. Admins only. */
export async function POST(request: Request) {
  const { user, error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  const { data: body, error } = await parseBody(request, publishSchema);
  if (error) return error;
  try {
    const data = body.data ?? (await getDraft(scope))?.data;
    if (!data) return jsonError('There is no draft to publish yet. Pick a template first.', 400);
    const problem = designProblem(data, scope);
    if (problem) return jsonError(problem, 400);
    const published = await publish(data as DesignData, user.email, scope);
    for (const path of pathsFor(scope)) revalidatePath(path, path.includes('[') ? 'page' : undefined);
    return NextResponse.json({ publishedAt: published.savedAt });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Switches the page back to its built-in design (project pages: the shared design, else built-in). The draft is kept. */
export async function DELETE(request: Request) {
  const { error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  try {
    // ?forget=1 on a project's own design: drop it altogether, so the page uses the shared design again.
    if (scope.startsWith('project:') && new URL(request.url).searchParams.get('forget') === '1') await removeScope(scope);
    else await unpublish(scope);
    for (const path of pathsFor(scope)) revalidatePath(path, path.includes('[') ? 'page' : undefined);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
