import { z } from 'zod';
import type { JobAnalysis } from './job';
import type { ResumeData, TemplateId } from '@/lib/resume-builder/types';

/** Job applications (Admin → Applications): the pipeline, each with its job, resume, kit and interview prep. */

export const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'] as const;
export type ApplicationStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved', applied: 'Applied', interview: 'Interviewing', offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrawn',
};

export const contactSchema = z.object({
  name: z.string().trim().max(100).default(''),
  title: z.string().trim().max(100).default(''),
  email: z.string().trim().max(200).default(''),
  linkedin: z.string().trim().max(300).default(''),
}).strict();
export type Contact = z.output<typeof contactSchema>;

export type TimelineEvent = { at: string; kind: 'created' | 'status' | 'resume' | 'kit' | 'interview' | 'note'; text: string };

/** The resume exactly as it was when the application was sent (so interview prep knows what you claimed). */
export type ResumeSnapshot = { resumeId: number; name: string; template: TemplateId; data: ResumeData; code: string | null; at: string };

export const KIT_KINDS = ['coverLetter', 'recruiterMessage', 'linkedinMessage', 'applicationEmail'] as const;
export type KitKind = (typeof KIT_KINDS)[number];
export const KIT_LABELS: Record<KitKind, string> = {
  coverLetter: 'Cover letter', recruiterMessage: 'Recruiter message', linkedinMessage: 'LinkedIn connection note', applicationEmail: 'Application email',
};
export type KitItem = { text: string; subject?: string; at: string; provider?: string };
export type Kit = Partial<Record<KitKind, KitItem>>;

export const QUESTION_CATEGORIES = ['resume', 'job', 'gap', 'behavioral'] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];
export const QUESTION_LABELS: Record<QuestionCategory, string> = {
  resume: 'About what you claimed', job: 'About the job’s requirements', gap: 'About gaps', behavioral: 'Behavioural',
};
export type InterviewQuestion = {
  category: QuestionCategory;
  question: string;
  why: string;
  followUps: string[];
  tips: string[];
  evidence: string;
  notes?: string;
};
export type InterviewPrep = { at: string; provider?: string; basedOn: string; questions: InterviewQuestion[] };

export type Application = {
  id: number;
  company: string;
  role: string;
  location: string;
  url: string;
  status: ApplicationStatus;
  jobDescription: string;
  analysis: JobAnalysis | null;
  resumeId: number | null;
  snapshot: ResumeSnapshot | null;
  notes: string;
  contacts: Contact[];
  nextStep: string;
  nextStepAt: string;
  appliedAt: string;
  kit: Kit;
  interview: InterviewPrep | null;
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
};

/** What the board needs (no job text, snapshot or generated documents). */
export type ApplicationSummary = Pick<Application, 'id' | 'company' | 'role' | 'location' | 'url' | 'status' | 'resumeId' | 'nextStep' | 'nextStepAt' | 'appliedAt' | 'createdAt' | 'updatedAt'> & {
  hasKit: boolean; hasInterview: boolean; sent: boolean; workMode: string | null;
};
