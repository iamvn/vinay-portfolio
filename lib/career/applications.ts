import { prisma } from '@/lib/prisma';
import { STATUSES, STATUS_LABELS, type Application, type ApplicationStatus, type ApplicationSummary, type TimelineEvent } from './types';

/**
 * Job applications, stored per site in the JobApplication table (plain SQL, like the resume builder, so it
 * works before and after `prisma generate`). Structured parts (analysis, contacts, kit…) are JSON columns.
 */
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS JobApplication (id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'saved', jobDescription TEXT NOT NULL DEFAULT '', analysis TEXT NOT NULL DEFAULT '', resumeId INTEGER, snapshot TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', contacts TEXT NOT NULL DEFAULT '[]', nextStep TEXT NOT NULL DEFAULT '', nextStepAt TEXT NOT NULL DEFAULT '', appliedAt TEXT NOT NULL DEFAULT '', kit TEXT NOT NULL DEFAULT '{}', interview TEXT NOT NULL DEFAULT '', timeline TEXT NOT NULL DEFAULT '[]', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`;
export const MAX_APPLICATIONS = 500;

let ready: Promise<unknown> | null = null;
const ensureTable = () => (ready ??= prisma.$executeRawUnsafe(CREATE_TABLE).catch((error) => { ready = null; throw error; }));

type Row = Record<keyof Omit<Application, 'id' | 'resumeId'>, string> & { id: number | bigint; resumeId: number | bigint | null };

const parse = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

function toApplication(row: Row): Application {
  return {
    id: Number(row.id),
    company: row.company, role: row.role, location: row.location, url: row.url,
    status: (STATUSES as readonly string[]).includes(row.status) ? (row.status as ApplicationStatus) : 'saved',
    jobDescription: row.jobDescription,
    analysis: parse(row.analysis, null),
    resumeId: row.resumeId === null ? null : Number(row.resumeId),
    snapshot: parse(row.snapshot, null),
    notes: row.notes,
    contacts: parse(row.contacts, []),
    nextStep: row.nextStep, nextStepAt: row.nextStepAt, appliedAt: row.appliedAt,
    kit: parse(row.kit, {}),
    interview: parse(row.interview, null),
    timeline: parse(row.timeline, []),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export const toSummary = (app: Application): ApplicationSummary => ({
  id: app.id, company: app.company, role: app.role, location: app.location, url: app.url, status: app.status, resumeId: app.resumeId,
  nextStep: app.nextStep, nextStepAt: app.nextStepAt, appliedAt: app.appliedAt, createdAt: app.createdAt, updatedAt: app.updatedAt,
  hasKit: Object.keys(app.kit).length > 0, hasInterview: Boolean(app.interview?.questions.length), sent: Boolean(app.snapshot),
  workMode: app.analysis?.workMode ?? null,
});

export async function listApplications(): Promise<Application[]> {
  await ensureTable();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM JobApplication ORDER BY updatedAt DESC`;
  return rows.map(toApplication);
}

export async function getApplication(id: number): Promise<Application | null> {
  await ensureTable();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM JobApplication WHERE id = ${id}`;
  return rows[0] ? toApplication(rows[0]) : null;
}

export async function countApplications() {
  await ensureTable();
  const rows = await prisma.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM JobApplication`;
  return Number(rows[0]?.n ?? 0);
}

const event = (kind: TimelineEvent['kind'], text: string): TimelineEvent => ({ at: new Date().toISOString(), kind, text });

export async function createApplication(input: Pick<Application, 'company' | 'role' | 'location' | 'url' | 'jobDescription' | 'analysis'> & { status?: ApplicationStatus }) {
  await ensureTable();
  const now = new Date().toISOString();
  const status = input.status ?? 'saved';
  const timeline = [event('created', input.url ? 'Job saved from its link' : 'Job saved')];
  if (status !== 'saved') timeline.push(event('status', `Marked ${STATUS_LABELS[status]}`));
  const rows = await prisma.$queryRaw<Row[]>`INSERT INTO JobApplication (company, role, location, url, status, jobDescription, analysis, timeline, appliedAt, createdAt, updatedAt)
    VALUES (${input.company}, ${input.role}, ${input.location}, ${input.url}, ${status}, ${input.jobDescription}, ${input.analysis ? JSON.stringify(input.analysis) : ''},
      ${JSON.stringify(timeline)}, ${status === 'applied' ? now : ''}, ${now}, ${now})
    RETURNING *`;
  return toApplication(rows[0]);
}

/** Saves the whole record (the API merges changes and adds timeline events before calling this). */
export async function saveApplication(app: Application): Promise<Application> {
  const next = { ...app, updatedAt: new Date().toISOString(), timeline: app.timeline.slice(-200) };
  await prisma.$executeRaw`UPDATE JobApplication SET company = ${next.company}, role = ${next.role}, location = ${next.location}, url = ${next.url},
    status = ${next.status}, jobDescription = ${next.jobDescription}, analysis = ${next.analysis ? JSON.stringify(next.analysis) : ''},
    resumeId = ${next.resumeId}, snapshot = ${next.snapshot ? JSON.stringify(next.snapshot) : ''}, notes = ${next.notes},
    contacts = ${JSON.stringify(next.contacts)}, nextStep = ${next.nextStep}, nextStepAt = ${next.nextStepAt}, appliedAt = ${next.appliedAt},
    kit = ${JSON.stringify(next.kit)}, interview = ${next.interview ? JSON.stringify(next.interview) : ''}, timeline = ${JSON.stringify(next.timeline)},
    updatedAt = ${next.updatedAt} WHERE id = ${next.id}`;
  return next;
}

export const addEvent = (app: Application, kind: TimelineEvent['kind'], text: string) => { app.timeline = [...app.timeline, event(kind, text)]; };

export async function deleteApplication(id: number) {
  await ensureTable();
  return (await prisma.$executeRaw`DELETE FROM JobApplication WHERE id = ${id}`) > 0;
}
