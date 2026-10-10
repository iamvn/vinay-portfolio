import { randomBytes } from 'node:crypto';
import { mainClient } from '@/lib/db-client';
import type { Site } from '@/lib/sites/registry';
import { SUPPORT_KINDS, SUPPORT_STATUSES, type RequestInput, type SupportKind, type SupportRequest, type SupportStatus } from './types';

/**
 * Support requests live in the MAIN site's database (table SupportRequest), so the platform owner sees every
 * site's requests in one inbox. Small on purpose: a request is its subject, message, status and one reply.
 */

const CREATE = [
  `CREATE TABLE IF NOT EXISTS SupportRequest (id TEXT PRIMARY KEY, site TEXT NOT NULL, siteName TEXT NOT NULL DEFAULT '',
    fromName TEXT NOT NULL DEFAULT '', fromEmail TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, target TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', reply TEXT NOT NULL DEFAULT '',
    repliedAt TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS SupportRequest_status_created ON SupportRequest (status, createdAt)',
  'CREATE INDEX IF NOT EXISTS SupportRequest_site ON SupportRequest (site, fromEmail)',
];
let ready: Promise<void> | null = null;
const ensureTable = () => (ready ??= (async () => { for (const sql of CREATE) await mainClient.$executeRawUnsafe(sql); })().catch((error) => { ready = null; throw error; }));

/** Per person a day, and open at once per site: enough for real use, not enough to flood the inbox. */
export const MAX_PER_DAY = 10;
export const MAX_OPEN_PER_SITE = 50;

type Row = Omit<SupportRequest, 'kind' | 'status'> & { kind: string; status: string };
const toRequest = (row: Row): SupportRequest => ({
  ...row,
  kind: ((SUPPORT_KINDS as readonly string[]).includes(row.kind) ? row.kind : 'help') as SupportKind,
  status: ((SUPPORT_STATUSES as readonly string[]).includes(row.status) ? row.status : 'open') as SupportStatus,
});

export class SupportLimitError extends Error {}

export async function createRequest(site: Pick<Site, 'slug' | 'name' | 'isMain'>, from: { name: string; email: string }, input: RequestInput) {
  await ensureTable();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [today, open] = await Promise.all([
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM SupportRequest WHERE site = ${site.slug} AND fromEmail = ${from.email} AND createdAt > ${since}`,
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM SupportRequest WHERE site = ${site.slug} AND status IN ('open', 'in-progress')`,
  ]);
  if (Number(today[0]?.n ?? 0) >= MAX_PER_DAY) throw new SupportLimitError(`You’ve sent ${MAX_PER_DAY} requests today. Try again tomorrow.`);
  if (Number(open[0]?.n ?? 0) >= MAX_OPEN_PER_SITE) throw new SupportLimitError('Your site has a lot of open requests. Wait for some answers first.');
  const now = new Date().toISOString();
  const request: SupportRequest = {
    id: randomBytes(8).toString('hex'), site: site.slug, siteName: site.isMain ? 'Main site' : site.name, fromName: from.name, fromEmail: from.email,
    kind: input.kind, target: input.kind === 'access' ? input.target : '', subject: input.subject, message: input.message,
    status: 'open', reply: '', repliedAt: '', createdAt: now, updatedAt: now,
  };
  await mainClient.$executeRaw`INSERT INTO SupportRequest (id, site, siteName, fromName, fromEmail, kind, target, subject, message, status, reply, repliedAt, createdAt, updatedAt)
    VALUES (${request.id}, ${request.site}, ${request.siteName}, ${request.fromName}, ${request.fromEmail}, ${request.kind}, ${request.target}, ${request.subject},
      ${request.message}, 'open', '', '', ${now}, ${now})`;
  return request;
}

/** What one person on a site has sent, newest first. */
export async function listMine(site: string, email: string) {
  await ensureTable();
  const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM SupportRequest WHERE site = ${site} AND fromEmail = ${email} ORDER BY createdAt DESC LIMIT 100`;
  return rows.map(toRequest);
}

/** The platform owner's inbox: open and in-progress first, then the rest, newest first. */
export async function listAll(filter: 'active' | 'all' | SupportStatus = 'active') {
  await ensureTable();
  const where = filter === 'all' ? '' : filter === 'active' ? "WHERE status IN ('open', 'in-progress')" : 'WHERE status = ?';
  const args = filter === 'all' || filter === 'active' ? [] : [filter];
  const [rows, counts] = await Promise.all([
    mainClient.$queryRawUnsafe<Row[]>(`SELECT * FROM SupportRequest ${where} ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in-progress' THEN 1 ELSE 2 END, createdAt DESC LIMIT 300`, ...args),
    mainClient.$queryRawUnsafe<{ status: string; n: number | bigint }[]>('SELECT status, COUNT(*) AS n FROM SupportRequest GROUP BY status'),
  ]);
  const count = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0])) as Record<SupportStatus, number>;
  for (const row of counts) if (row.status in count) count[row.status as SupportStatus] = Number(row.n);
  return { items: rows.map(toRequest), count };
}

export async function openCount() {
  await ensureTable();
  const rows = await mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM SupportRequest WHERE status = 'open'`;
  return Number(rows[0]?.n ?? 0);
}

export async function getRequest(id: string) {
  await ensureTable();
  const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM SupportRequest WHERE id = ${id}`;
  return rows[0] ? toRequest(rows[0]) : null;
}

export async function answerRequest(id: string, change: { status?: SupportStatus; reply?: string }) {
  const current = await getRequest(id);
  if (!current) return null;
  const now = new Date().toISOString();
  const next = { ...current, ...change, updatedAt: now };
  if (change.reply !== undefined && change.reply !== current.reply) next.repliedAt = change.reply ? now : '';
  await mainClient.$executeRaw`UPDATE SupportRequest SET status = ${next.status}, reply = ${next.reply}, repliedAt = ${next.repliedAt}, updatedAt = ${now} WHERE id = ${id}`;
  return next;
}

export async function removeRequest(id: string) {
  await ensureTable();
  return (await mainClient.$executeRaw`DELETE FROM SupportRequest WHERE id = ${id}`) > 0;
}

/** When a site is deleted. */
export async function removeSiteRequests(site: string) {
  await ensureTable();
  await mainClient.$executeRaw`DELETE FROM SupportRequest WHERE site = ${site}`;
}
