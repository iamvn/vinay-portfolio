import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { MAX_SOURCE_LENGTH } from '@/lib/resume-builder/compile';
import { deleteResume, getResume, updateResume } from '@/lib/resume-builder/store';
import { toTypst } from '@/lib/resume-builder/typst';
import { TEMPLATE_IDS, resumeDataSchema } from '@/lib/resume-builder/types';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = 'Resume not found.';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  template: z.enum(TEMPLATE_IDS),
  data: resumeDataSchema,
  code: z.string().max(MAX_SOURCE_LENGTH).nullable(), // null = generate from the form again
  jobDescription: z.string().max(20_000),
}).partial().strict();

/** One resume, plus the code generated from its form content (what "Regenerate" would produce). */
export async function GET(request: Request, { params }: Context) {
  const { error } = await requireTab(request, 'builder');
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    const resume = await getResume(id);
    if (!resume) return jsonError(NOT_FOUND, 404);
    return NextResponse.json({ ...resume, generated: toTypst(resume.data, resume.template, resume.name) });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Saves changes (the editor autosaves). */
export async function PUT(request: Request, { params }: Context) {
  const { error: denied } = await requireTab(request, 'builder');
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;
  try {
    const resume = await updateResume(id, data);
    return resume ? NextResponse.json({ id: resume.id, updatedAt: resume.updatedAt }) : jsonError(NOT_FOUND, 404);
  } catch (err) {
    return handleDbError(err);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const { error } = await requireTab(request, 'builder');
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    return (await deleteResume(id)) ? new Response(null, { status: 204 }) : jsonError(NOT_FOUND, 404);
  } catch (err) {
    return handleDbError(err);
  }
}
