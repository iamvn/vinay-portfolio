import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { addEvent, getApplication, saveApplication } from '@/lib/career/applications';
import { CareerAiError, generateInterviewPrep } from '@/lib/career/ai';
import { careerContextFor } from '@/lib/career/context';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };

/** Interview prep from the resume that was sent (or the linked one) and the job. Replaces earlier questions. */
export async function POST(request: Request, { params }: Context) {
  const { error: denied } = await requireTab(request, 'applications');
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    const app = await getApplication(id);
    if (!app) return jsonError('Application not found.', 404);
    if (app.jobDescription.trim().length < 50) return jsonError('Add the job description first (Overview → Job text).', 400);
    const ctx = await careerContextFor(app);
    const { questions, provider } = await generateInterviewPrep(ctx);
    app.interview = { at: new Date().toISOString(), provider, basedOn: ctx.resumeLabel, questions };
    addEvent(app, 'interview', `Prepared ${questions.length} interview questions (from ${ctx.resumeLabel})`);
    return NextResponse.json(await saveApplication(app));
  } catch (err) {
    if (err instanceof CareerAiError) return jsonError(err.message, err.status);
    return handleDbError(err);
  }
}
