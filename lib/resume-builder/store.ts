import { prisma } from '@/lib/prisma';
import { resumeDataSchema, TEMPLATE_IDS, type ResumeData, type ResumeDocument, type TemplateId } from './types';

/**
 * Resumes made in Admin → Resume builder, stored in the ResumeDocument table (plain SQL, so it works
 * before and after `prisma generate` picks up the model). The table is created on first use.
 */
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS ResumeDocument (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, template TEXT NOT NULL DEFAULT 'classic', data TEXT NOT NULL, code TEXT, jobDescription TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`;
export const MAX_RESUMES = 50;

let ready: Promise<unknown> | null = null;
const ensureTable = () => (ready ??= prisma.$executeRawUnsafe(CREATE_TABLE).catch((error) => { ready = null; throw error; }));

type Row = { id: number | bigint; name: string; template: string; data: string; code: string | null; jobDescription: string; createdAt: string; updatedAt: string };

function toDocument(row: Row): ResumeDocument {
  let data: ResumeData;
  try { data = resumeDataSchema.parse(JSON.parse(row.data)); } catch { data = resumeDataSchema.parse({}); }
  const template = (TEMPLATE_IDS as readonly string[]).includes(row.template) ? (row.template as TemplateId) : 'classic';
  return { id: Number(row.id), name: row.name, template, data, code: row.code ?? null, jobDescription: row.jobDescription ?? '', createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function listResumes(): Promise<ResumeDocument[]> {
  await ensureTable();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM ResumeDocument ORDER BY updatedAt DESC`;
  return rows.map(toDocument);
}

export async function getResume(id: number): Promise<ResumeDocument | null> {
  await ensureTable();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM ResumeDocument WHERE id = ${id}`;
  return rows[0] ? toDocument(rows[0]) : null;
}

export async function countResumes() {
  await ensureTable();
  const rows = await prisma.$queryRaw<{ count: number | bigint }[]>`SELECT COUNT(*) AS count FROM ResumeDocument`;
  return Number(rows[0]?.count ?? 0);
}

export async function createResume(input: { name: string; template: TemplateId; data: ResumeData; code?: string | null; jobDescription?: string }) {
  await ensureTable();
  const now = new Date().toISOString();
  // RETURNING gives the new row in the same statement (works on local SQLite and on Turso over HTTP).
  const rows = await prisma.$queryRaw<Row[]>`INSERT INTO ResumeDocument (name, template, data, code, jobDescription, createdAt, updatedAt)
    VALUES (${input.name}, ${input.template}, ${JSON.stringify(input.data)}, ${input.code ?? null}, ${input.jobDescription ?? ''}, ${now}, ${now})
    RETURNING *`;
  return toDocument(rows[0]);
}

export type ResumeChanges = Partial<{ name: string; template: TemplateId; data: ResumeData; code: string | null; jobDescription: string }>;

export async function updateResume(id: number, changes: ResumeChanges): Promise<ResumeDocument | null> {
  const current = await getResume(id);
  if (!current) return null;
  const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
  await prisma.$executeRaw`UPDATE ResumeDocument SET name = ${next.name}, template = ${next.template}, data = ${JSON.stringify(next.data)},
    code = ${next.code}, jobDescription = ${next.jobDescription}, updatedAt = ${next.updatedAt} WHERE id = ${id}`;
  return next;
}

export async function deleteResume(id: number) {
  await ensureTable();
  const deleted = await prisma.$executeRaw`DELETE FROM ResumeDocument WHERE id = ${id}`;
  return deleted > 0;
}
