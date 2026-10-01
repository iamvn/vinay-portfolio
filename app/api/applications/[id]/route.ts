import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { addEvent, deleteApplication, getApplication, saveApplication } from '@/lib/career/applications';
import { analyzeJob } from '@/lib/career/job';
import { resumeFor } from '@/lib/career/context';
import { careerEvidence } from '@/lib/career/profile';
import { snapshotResume } from '@/lib/career/snapshot';
import { KIT_KINDS, STATUSES, STATUS_LABELS, contactSchema } from '@/lib/career/types';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  company: z.string().trim().max(120),
  role: z.string().trim().max(160),
  location: z.string().trim().max(160),
  url: z.union([z.url().max(1000), z.literal('')]),
  status: z.enum(STATUSES),
  jobDescription: z.string().trim().max(30_000),
  notes: z.string().max(20_000),
  contacts: z.array(contactSchema).max(30),
  nextStep: z.string().trim().max(300),
  nextStepAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]),
  appliedAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.literal('')]),
  /** Your edits to generated documents. */
  kit: z.partialRecord(z.enum(KIT_KINDS), z.object({ text: z.string().max(8000), subject: z.string().max(300).optional() })),
  /** Your practice notes per interview question (by index). */
  interviewNotes: z.record(z.string().regex(/^\d+$/), z.string().max(5000)),
  /** A note added to the timeline. */
  timelineNote: z.string().trim().min(1).max(500),
}).partial().strict();

async function load(request: Request, params: Context['params']) {
  const { error } = await requireTab(request, 'applications');
  if (error) return { error };
  const id = parseId((await params).id);
  if (!id) return { error: jsonError('id must be a positive integer.', 400) };
  const app = await getApplication(id);
  if (!app) return { error: jsonError('Application not found.', 404) };
  return { app };
}

/** One application, with the resume it's judged against and your profile evidence (for the requirement map). */
export async function GET(request: Request, { params }: Context) {
  try {
    const { app, error } = await load(request, params);
    if (error) return error;
    const [resume, profile] = await Promise.all([resumeFor(app), careerEvidence().catch(() => [])]);
    return NextResponse.json({ application: app, resume: { label: resume.label, kind: resume.kind, data: resume.data }, profile });
  } catch (err) {
    return handleDbError(err);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { app, error: denied } = await load(request, params);
    if (denied) return denied;
    const { data, error } = await parseBody(request, patchSchema);
    if (error) return error;
    const { kit, interviewNotes, timelineNote, ...fields } = data;
    const before = { ...app };
    Object.assign(app, fields);
    if (fields.jobDescription !== undefined && fields.jobDescription !== before.jobDescription) {
      app.analysis = fields.jobDescription.length >= 50 ? analyzeJob({ text: fields.jobDescription, title: app.role, company: app.company }) : null;
    }
    if (fields.status && fields.status !== before.status) {
      addEvent(app, 'status', `Moved to ${STATUS_LABELS[fields.status]}`);
      if (fields.status === 'applied') {
        if (!app.appliedAt) app.appliedAt = new Date().toISOString().slice(0, 10);
        // Remember exactly which resume version went out (for interview prep and later comparison).
        if (app.resumeId && !app.snapshot) {
          const snapshot = await snapshotResume(app.resumeId);
          if (snapshot) { app.snapshot = snapshot; addEvent(app, 'resume', `Saved the sent version of “${snapshot.name}”`); }
        }
      }
    }
    if (kit) for (const [kind, item] of Object.entries(kit)) {
      const existing = app.kit[kind as keyof typeof app.kit];
      app.kit[kind as keyof typeof app.kit] = { ...existing, at: existing?.at ?? new Date().toISOString(), text: item.text, ...(item.subject !== undefined ? { subject: item.subject } : {}) };
    }
    if (interviewNotes && app.interview) {
      app.interview.questions = app.interview.questions.map((q, i) => (interviewNotes[String(i)] !== undefined ? { ...q, notes: interviewNotes[String(i)] } : q));
    }
    if (timelineNote) addEvent(app, 'note', timelineNote);
    return NextResponse.json(await saveApplication(app));
  } catch (err) {
    return handleDbError(err);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { app, error } = await load(request, params);
    if (error) return error;
    await deleteApplication(app.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}

