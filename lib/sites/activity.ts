import { mainClient } from '@/lib/db-client';
import type { Site } from './registry';

/**
 * The activity log shown to the main site's admin (Admin → Activity logs): what happens on other sites
 * (sign-ins, users added/changed/removed, sites created/changed/deleted by their admins) and what the main
 * admin does to sites. Kept in the main site's database (table SiteActivity).
 */
export const ACTIVITY_KINDS = ['user.login', 'user.added', 'user.updated', 'user.removed', 'site.created', 'site.updated', 'site.deleted'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type Activity = {
  id: number;
  at: string;
  site: string;       // slug of the site where it happened ('main' = your site)
  siteName: string;
  actor: string;      // "Name <email>" of who did it
  kind: ActivityKind;
  details: Record<string, string>;
};

const CREATE = `CREATE TABLE IF NOT EXISTS SiteActivity (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, site TEXT NOT NULL, siteName TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}')`;
let ready: Promise<unknown> | null = null;
const ensureTable = () => (ready ??= mainClient.$executeRawUnsafe(CREATE).catch((error) => { ready = null; throw error; }));

export const actorLabel = (user: { name?: string | null; email: string }) => (user.name?.trim() ? `${user.name.trim()} <${user.email}>` : user.email);

/**
 * Records something that happened. Never throws: the action itself already happened.
 * Actions on the main site are only recorded when `includeMain` is set (changes to other sites).
 */
export async function logActivity(
  site: Pick<Site, 'slug' | 'name' | 'isMain'>, actor: string, kind: ActivityKind, details: Record<string, string>,
  { includeMain = false } = {},
) {
  if (site.isMain && !includeMain) return;
  try {
    await ensureTable();
    await mainClient.$executeRaw`INSERT INTO SiteActivity (at, site, siteName, actor, kind, details)
      VALUES (${new Date().toISOString()}, ${site.slug}, ${site.isMain ? 'Main site' : site.name}, ${actor}, ${kind}, ${JSON.stringify(details)})`;
  } catch (error) {
    console.error('Could not record activity:', error);
  }
}

type Row = { id: number | bigint; at: string; site: string; siteName: string; actor: string; kind: string; details: string };
const toActivity = (row: Row): Activity => {
  let details: Record<string, string> = {};
  try { details = JSON.parse(row.details); } catch { /* keep empty */ }
  return { id: Number(row.id), at: row.at, site: row.site, siteName: row.siteName, actor: row.actor, kind: row.kind as ActivityKind, details };
};

export type ActivityQuery = { limit?: number; offset?: number; site?: string; kind?: string; search?: string };

/** A page of the log, newest first, with optional filters; plus the total matching and the sites seen in the log. */
export async function listActivity({ limit = 50, offset = 0, site, kind, search }: ActivityQuery = {}) {
  await ensureTable();
  const where: string[] = [];
  const args: unknown[] = [];
  if (site) { where.push('site = ?'); args.push(site); }
  if (kind) { where.push(kind.endsWith('.') ? 'kind LIKE ?' : 'kind = ?'); args.push(kind.endsWith('.') ? `${kind}%` : kind); }
  if (search) {
    where.push("(actor LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\' OR siteName LIKE ? ESCAPE '\\')");
    const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    args.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows, count, sites] = await Promise.all([
    mainClient.$queryRawUnsafe<Row[]>(`SELECT * FROM SiteActivity ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, limit, offset),
    mainClient.$queryRawUnsafe<{ n: number | bigint }[]>(`SELECT COUNT(*) AS n FROM SiteActivity ${clause}`, ...args),
    mainClient.$queryRawUnsafe<{ site: string; siteName: string }[]>('SELECT site, MAX(siteName) AS siteName FROM SiteActivity GROUP BY site ORDER BY siteName'),
  ]);
  return { items: rows.map(toActivity), total: Number(count[0]?.n ?? 0), sites };
}
