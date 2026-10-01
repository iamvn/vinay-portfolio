import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { addEvent, getApplication, saveApplication } from '@/lib/career/applications';
import { CareerAiError, checkClaims, generateKit } from '@/lib/career/ai';
import { careerContextFor } from '@/lib/career/context';
import { KIT_KINDS, KIT_LABELS } from '@/lib/career/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  kinds: z.array(z.enum(KIT_KINDS)).max(KIT_KINDS.length).default([]),
  tone: z.enum(['professional', 'warm', 'concise']).default('professional'),
  recipient: z.string().trim().max(100).default(''),
}).strict();

const TONES = { professional: 'professional and confident', warm: 'warm and personable, still professional', concise: 'very concise and direct' };

/** Writes the application kit (all documents, or the ones in `kinds`) from your resume, profile and the job. */
export async function POST(request: Request, { params }: Context) {
  const { error: denied } = await requireTab(request, 'applications');
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    const app = await getApplication(id);
    if (!app) return jsonError('Application not found.', 404);
    if (app.jobDescription.trim().length < 50) return jsonError('Add the job description first (Overview → Job text).', 400);
    const ctx = await careerContextFor(app);
    const { items, provider } = await generateKit(ctx, data.kinds, { tone: TONES[data.tone], recipient: data.recipient });
    const at = new Date().toISOString();
    for (const [kind, item] of Object.entries(items)) app.kit[kind as keyof typeof items] = { ...item, at, provider };
    addEvent(app, 'kit', `Wrote ${Object.keys(items).map((k) => KIT_LABELS[k as keyof typeof KIT_LABELS].toLowerCase()).join(', ')} (from ${ctx.resumeLabel})`);
    const saved = await saveApplication(app);
    // Truth guard: skills and numbers in the new text that your resume/profile never mention.
    const issues = Object.fromEntries(Object.entries(items).map(([kind, item]) => [kind, checkClaims(`${item.subject ?? ''}\n${item.text}`, ctx)]));
    return NextResponse.json({ application: saved, issues, provider, basedOn: ctx.resumeLabel });
  } catch (err) {
    if (err instanceof CareerAiError) return jsonError(err.message, err.status);
    return handleDbError(err);
  }
}
