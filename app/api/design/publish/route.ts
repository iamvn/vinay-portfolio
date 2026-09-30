import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { designProblem, getDraft, publish, unpublish } from '@/lib/design/store';
import type { DesignData } from '@/lib/design/templates';

export const dynamic = 'force-dynamic';

const publishSchema = z.object({ data: z.record(z.string(), z.unknown()).optional() }).strict();

/** Makes a design live. Body { data } publishes that design; an empty body publishes the saved draft. Admins only. */
export async function POST(request: Request) {
  const { user, error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const { data: body, error } = await parseBody(request, publishSchema);
  if (error) return error;
  try {
    const data = body.data ?? (await getDraft())?.data;
    if (!data) return jsonError('There is no draft to publish yet. Pick a template first.', 400);
    const problem = designProblem(data);
    if (problem) return jsonError(problem, 400);
    const published = await publish(data as DesignData, user.email);
    revalidatePath('/');
    return NextResponse.json({ publishedAt: published.savedAt });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Switches the homepage back to the classic built-in design. The draft is kept. Admins only. */
export async function DELETE(request: Request) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  try {
    await unpublish();
    revalidatePath('/');
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
