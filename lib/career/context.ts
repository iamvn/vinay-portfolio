import { getResume } from '@/lib/resume-builder/store';
import { contentFromPortfolio } from '@/lib/resume-builder/server';
import { careerEvidence } from './profile';
import type { CareerContext } from './ai';
import type { Application } from './types';

/**
 * Which resume an application is judged against: the version that was sent (snapshot), else the linked
 * resume as it is now, else your profile turned into a resume.
 */
export async function resumeFor(app: Application) {
  if (app.snapshot) return { label: `Sent version of “${app.snapshot.name}” (${new Date(app.snapshot.at).toLocaleDateString('en-GB')})`, data: app.snapshot.data, kind: 'sent' as const };
  const linked = app.resumeId ? await getResume(app.resumeId) : null;
  if (linked) return { label: `“${linked.name}” (current version)`, data: linked.data, kind: 'linked' as const };
  return { label: 'Your profile (no resume linked yet)', data: await contentFromPortfolio(), kind: 'profile' as const };
}

export async function careerContextFor(app: Application): Promise<CareerContext> {
  const [resume, profile] = await Promise.all([resumeFor(app), careerEvidence().catch(() => [])]);
  return { resume: resume.data, resumeLabel: resume.label, profile, job: { company: app.company, role: app.role, text: app.jobDescription, analysis: app.analysis } };
}
