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

/**
 * Your own interview notes ("Prep notes"): questions you were asked (or want to practise) with your answers,
 * free-form prep material, and links to notes kept elsewhere (Notion, Google Drive…). Per application, plus one
 * general set that isn't tied to a job (lib/career/prep.ts). All of it shows up in the question bank.
 */
export const PREP_ROUNDS = ['Recruiter screen', 'Online test', 'Technical', 'Coding', 'System design', 'Managerial', 'HR', 'Other'] as const;
const prepId = z.string().regex(/^[\w-]{6,40}$/);
export const prepQuestionSchema = z.object({
  id: prepId,
  kind: z.enum(['asked', 'practice']).default('asked'),
  question: z.string().trim().min(1, 'A question can’t be empty.').max(1000),
  answer: z.string().max(10_000).default(''),
  round: z.string().trim().max(60).default(''),
  date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).default(''),
  practiced: z.boolean().default(false),
}).strict();
export const prepLinkSchema = z.object({
  id: prepId,
  label: z.string().trim().max(120).default(''),
  url: z.url('must be a full link (https://…)').max(2000).refine((url) => /^https?:\/\//i.test(url), 'must start with http:// or https://'),
}).strict();
export const prepSchema = z.object({
  questions: z.array(prepQuestionSchema).max(300).default([]),
  notes: z.string().max(50_000).default(''),
  links: z.array(prepLinkSchema).max(60).default([]),
}).strict();
export type PrepQuestion = z.output<typeof prepQuestionSchema>;
export type PrepLink = z.output<typeof prepLinkSchema>;
export type Prep = z.output<typeof prepSchema>;
export const EMPTY_PREP: Prep = { questions: [], notes: '', links: [] };

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
  /** Your own notes: questions asked, prep material and links. */
  prep: Prep;
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
};

/** What the board needs (no job text, snapshot or generated documents). */
export type ApplicationSummary = Pick<Application, 'id' | 'company' | 'role' | 'location' | 'url' | 'status' | 'resumeId' | 'nextStep' | 'nextStepAt' | 'appliedAt' | 'createdAt' | 'updatedAt'> & {
  hasKit: boolean; hasInterview: boolean; sent: boolean; workMode: string | null;
  /** How many of your own questions and links it has (Prep notes). */
  prepQuestions: number; prepLinks: number;
};
