import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { canUseTab } from '@/lib/auth/permissions';
import { addEvent, getApplication, saveApplication } from '@/lib/career/applications';
import { snapshotResume } from '@/lib/career/snapshot';
import { MAX_RESUMES, countResumes, createResume, getResume } from '@/lib/resume-builder/store';
import { contentFromPortfolio } from '@/lib/resume-builder/server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create') }).strict(),                                       // new resume from your profile, with this job's text
  z.object({ action: z.literal('link'), resumeId: z.number().int().positive() }).strict(),  // use an existing resume
  z.object({ action: z.literal('unlink') }).strict(),
  z.object({ action: z.literal('snapshot') }).strict(),                                     // (re)save the version that was sent
  z.object({ action: z.literal('restore') }).strict(),                                      // the sent version as a new resume to edit
]);

/** Links a resume to the application, or saves the version that was sent. */
export async function POST(request: Request, { params }: Context) {
  const { user, error: denied } = await requireTab(request, 'applications');
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  if (data.action !== 'unlink' && data.action !== 'snapshot' && !canUseTab(user, 'builder')) return jsonError('You need access to the Resume builder for this.', 403);
  try {
    const app = await getApplication(id);
    if (!app) return jsonError('Application not found.', 404);
    const title = [app.company, app.role].filter(Boolean).join(' – ') || 'Application';
    if (data.action === 'create' || data.action === 'restore') {
      if ((await countResumes()) >= MAX_RESUMES) return jsonError(`You can keep up to ${MAX_RESUMES} resumes. Delete one first.`, 400);
      if (data.action === 'restore' && !app.snapshot) return jsonError('No sent version saved yet.', 400);
      const resume = data.action === 'create'
        ? await createResume({ name: title.slice(0, 120), template: 'classic', data: await contentFromPortfolio(), jobDescription: app.jobDescription })
        : await createResume({ name: `${app.snapshot!.name} (sent version)`.slice(0, 120), template: app.snapshot!.template, data: app.snapshot!.data, code: app.snapshot!.code, jobDescription: app.jobDescription });
      app.resumeId = resume.id;
      addEvent(app, 'resume', data.action === 'create' ? `Created a resume for this job: “${resume.name}”` : `Restored the sent version as “${resume.name}”`);
    } else if (data.action === 'link') {
      const resume = await getResume(data.resumeId);
      if (!resume) return jsonError('That resume was not found.', 404);
      app.resumeId = resume.id;
      addEvent(app, 'resume', `Linked the resume “${resume.name}”`);
    } else if (data.action === 'unlink') {
      app.resumeId = null;
      addEvent(app, 'resume', 'Unlinked the resume');
    } else {
      if (!app.resumeId) return jsonError('Link a resume first.', 400);
      const snapshot = await snapshotResume(app.resumeId);
      if (!snapshot) return jsonError('The linked resume was not found.', 404);
      app.snapshot = snapshot;
      addEvent(app, 'resume', `Saved the sent version of “${snapshot.name}”`);
    }
    return NextResponse.json(await saveApplication(app));
  } catch (err) {
    return handleDbError(err);
  }
}
