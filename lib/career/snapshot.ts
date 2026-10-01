import { getResume } from '@/lib/resume-builder/store';
import type { ResumeSnapshot } from './types';

/** A frozen copy of a resume as it is right now (what was sent with an application). */
export async function snapshotResume(resumeId: number): Promise<ResumeSnapshot | null> {
  const resume = await getResume(resumeId);
  if (!resume) return null;
  return { resumeId, name: resume.name, template: resume.template, data: resume.data, code: resume.code, at: new Date().toISOString() };
}
