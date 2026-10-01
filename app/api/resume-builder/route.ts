import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { MAX_RESUMES, countResumes, createResume, getResume, listResumes } from '@/lib/resume-builder/store';
import { contentFromPortfolio } from '@/lib/resume-builder/server';
import { TEMPLATE_IDS } from '@/lib/resume-builder/types';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1, 'must not be empty').max(120),
  template: z.enum(TEMPLATE_IDS).optional().default('classic'),
  copyFrom: z.number().int().positive().optional(), // duplicate an existing resume instead of starting from the portfolio
}).strict();

/** Lists resumes (newest first), without their full content. */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'builder');
  if (error) return error;
  try {
    const resumes = await listResumes();
    return NextResponse.json(resumes.map(({ data, code, jobDescription, ...rest }) => ({
      ...rest, customCode: code !== null, hasJob: jobDescription.trim().length > 0, sections: data.experience.length,
    })));
  } catch (err) {
    return handleDbError(err);
  }
}

/** Creates a resume, filled from the portfolio (or copied from another resume with copyFrom). */
export async function POST(request: Request) {
  const { error: denied } = await requireTab(request, 'builder');
  if (denied) return denied;
  const { data, error } = await parseBody(request, createSchema);
  if (error) return error;
  try {
    if ((await countResumes()) >= MAX_RESUMES) return jsonError(`You can keep up to ${MAX_RESUMES} resumes. Delete one first.`, 400);
    if (data.copyFrom) {
      const source = await getResume(data.copyFrom);
      if (!source) return jsonError('The resume to copy was not found.', 404);
      return NextResponse.json(await createResume({ ...source, name: data.name }), { status: 201 });
    }
    return NextResponse.json(await createResume({ name: data.name, template: data.template, data: await contentFromPortfolio() }), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
