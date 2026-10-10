import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { questionBank, saveGeneralPrep, setPracticed } from '@/lib/career/prep';
import { prepSchema } from '@/lib/career/types';

export const dynamic = 'force-dynamic';

/** The question bank: your questions and prep links from every application, plus your general prep. */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'applications');
  if (error) return error;
  try {
    return NextResponse.json(await questionBank());
  } catch (err) {
    return handleDbError(err);
  }
}

/** Saves your general prep (questions, notes and links not tied to one job). Body: { prep }. */
export async function PUT(request: Request) {
  const { error: denied } = await requireTab(request, 'applications');
  if (denied) return denied;
  const { data, error } = await parseBody(request, z.object({ prep: prepSchema }).strict());
  if (error) return error;
  try {
    await saveGeneralPrep(data.prep);
    return NextResponse.json(await questionBank());
  } catch (err) {
    return handleDbError(err);
  }
}

/** Marks one question practised or not. Body: { appId: number | null, questionId, practiced }. */
export async function PATCH(request: Request) {
  const { error: denied } = await requireTab(request, 'applications');
  if (denied) return denied;
  const { data, error } = await parseBody(request, z.object({
    appId: z.number().int().positive().nullable(),
    questionId: z.string().regex(/^[\w-]{6,40}$/),
    practiced: z.boolean(),
  }).strict());
  if (error) return error;
  try {
    if (!(await setPracticed(data.appId, data.questionId, data.practiced))) return jsonError('That question no longer exists.', 404);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
