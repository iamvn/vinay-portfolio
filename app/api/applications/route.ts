import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { MAX_APPLICATIONS, countApplications, createApplication, listApplications, toSummary } from '@/lib/career/applications';
import { analyzeJob } from '@/lib/career/job';
import { STATUSES } from '@/lib/career/types';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  company: z.string().trim().max(120).default(''),
  role: z.string().trim().max(160).default(''),
  location: z.string().trim().max(160).default(''),
  url: z.union([z.url('must be a full link (https://…)').max(1000), z.literal('')]).default(''),
  jobDescription: z.string().trim().max(30_000).default(''),
  status: z.enum(STATUSES).optional(),
  // Fields read from the job page (title/company…), used to analyse the text.
  hints: z.object({ title: z.string().optional(), company: z.string().optional(), location: z.string().optional(), remote: z.boolean().optional(), employmentType: z.string().optional() }).partial().optional(),
}).strict();

/** The pipeline (newest activity first), without job texts or generated documents. */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'applications');
  if (error) return error;
  try {
    return NextResponse.json((await listApplications()).map(toSummary));
  } catch (err) {
    return handleDbError(err);
  }
}

/** Saves a job: company/role are taken from the job text when not given. */
export async function POST(request: Request) {
  const { error: denied } = await requireTab(request, 'applications');
  if (denied) return denied;
  const { data, error } = await parseBody(request, createSchema);
  if (error) return error;
  if (!data.company && !data.role && !data.jobDescription) return jsonError('Add the job text, or at least the company and role.', 400);
  try {
    if ((await countApplications()) >= MAX_APPLICATIONS) return jsonError(`You can keep up to ${MAX_APPLICATIONS} applications. Delete old ones first.`, 400);
    const analysis = data.jobDescription.length >= 50 ? analyzeJob({ text: data.jobDescription, ...data.hints }) : null;
    const app = await createApplication({
      company: data.company || analysis?.company || '',
      role: data.role || analysis?.title || '',
      location: data.location || analysis?.location || '',
      url: data.url,
      jobDescription: data.jobDescription,
      analysis,
      status: data.status,
    });
    return NextResponse.json(app, { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
