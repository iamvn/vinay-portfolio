import { prisma } from '@/lib/prisma';

/**
 * Messages sent through forms built in Admin → Design, stored per site (table FormSubmission) and shown in
 * Admin → Insights. Plain SQL like the other newer tables, so it works before and after `prisma generate`.
 */
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS FormSubmission (id INTEGER PRIMARY KEY AUTOINCREMENT, form TEXT NOT NULL DEFAULT '', fields TEXT NOT NULL DEFAULT '{}', page TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL)`;
export const MAX_SUBMISSIONS = 2000;

let ready: Promise<unknown> | null = null;
const ensureTable = () => (ready ??= prisma.$executeRawUnsafe(CREATE_TABLE).catch((error) => { ready = null; throw error; }));

export type FormSubmission = { id: number; form: string; fields: Record<string, string>; page: string; createdAt: string };
type Row = { id: number | bigint; form: string; fields: string; page: string; createdAt: string };

export async function saveSubmission(input: Omit<FormSubmission, 'id' | 'createdAt'>) {
  await ensureTable();
  await prisma.$executeRaw`INSERT INTO FormSubmission (form, fields, page, createdAt) VALUES (${input.form}, ${JSON.stringify(input.fields)}, ${input.page}, ${new Date().toISOString()})`;
  // Keep the newest ones only, so a spam wave can't fill the database.
  await prisma.$executeRaw`DELETE FROM FormSubmission WHERE id NOT IN (SELECT id FROM FormSubmission ORDER BY id DESC LIMIT ${MAX_SUBMISSIONS})`;
}

export async function listSubmissions(limit = 100): Promise<FormSubmission[]> {
  await ensureTable();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM FormSubmission ORDER BY id DESC LIMIT ${limit}`;
  return rows.map((row) => {
    let fields: Record<string, string> = {};
    try { fields = JSON.parse(row.fields); } catch { /* keep empty */ }
    return { id: Number(row.id), form: row.form, fields, page: row.page, createdAt: row.createdAt };
  });
}

export async function deleteSubmission(id: number) {
  await ensureTable();
  return (await prisma.$executeRaw`DELETE FROM FormSubmission WHERE id = ${id}`) > 0;
}
