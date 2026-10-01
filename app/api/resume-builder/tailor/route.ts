import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { TailorError, tailorResume } from '@/lib/resume-builder/tailor';
import { resumeDataSchema } from '@/lib/resume-builder/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  data: resumeDataSchema,
  jobDescription: z.string().trim().min(50, 'Paste the full job description (at least a few sentences).').max(20_000),
}).strict();

/** AI suggestions for one job description (nothing is changed until you apply them in the editor). */
export async function POST(request: Request) {
  const { error: denied } = await requireTab(request, 'builder');
  if (denied) return denied;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    return NextResponse.json(await tailorResume(data.data, data.jobDescription));
  } catch (err) {
    if (err instanceof TailorError) return jsonError(err.message, err.status);
    console.error(err);
    return jsonError('Could not tailor the resume.', 500);
  }
}
