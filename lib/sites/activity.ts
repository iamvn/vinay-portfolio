import { mainClient } from '@/lib/db-client';
import type { Site } from './registry';

/**
 * The activity log shown to the main site's admin (Admin → Activity logs): what happens on other sites
 * (sign-ins, users added/changed/removed, sites created/changed/deleted by their admins) and what the main
 * admin does to sites. Kept in the main site's database (table SiteActivity).
 */
export const ACTIVITY_KINDS = [
  'user.login', 'user.added', 'user.updated', 'user.removed', 'site.created', 'site.updated', 'site.deleted',
  // Community board: only who did what to which post, and when (the post itself lives in CommunityPost).
  'community.posted', 'community.updated', 'community.deleted', 'community.hidden', 'community.shown', 'community.removed',
  // Support & requests: that someone asked, and that it was answered (the request lives in SupportRequest).
  'support.requested', 'support.answered',
  // Templates published for every site (Design → Your templates → Publish), and removed again.
  'design.shared', 'design.unshared',
  // Database tab: old logs deleted by the platform owner (what, how old, how many).
  'data.cleaned',
  'log.cleared',
] as const;
/** Filters that match a whole group of kinds. */
export const ACTIVITY_GROUPS = ['user.', 'site.', 'community.', 'support.', 'design.'] as const;
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

/** True when the same kind of entry for the same post was logged in the last `minutes` (to keep repeated edits to one line). */
export async function loggedRecently(kind: ActivityKind, postId: string, minutes = 30) {
  try {
    await ensureTable();
    const since = new Date(Date.now() - minutes * 60_000).toISOString();
    const rows = await mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM SiteActivity WHERE kind = ${kind} AND at >= ${since} AND details LIKE ${`%"id":"${postId}"%`}`;
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Deletes log entries older than `days` days (null = all of them). Returns how many were deleted. */
export async function clearActivity(days: number | null): Promise<number> {
  await ensureTable();
  if (days === null) return mainClient.$executeRaw`DELETE FROM SiteActivity`;
  const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return mainClient.$executeRaw`DELETE FROM SiteActivity WHERE at < ${before}`;
}

/** How many entries the log holds, and since when. */
export async function activityStats() {
  await ensureTable();
  const [row] = await mainClient.$queryRaw<{ n: number | bigint; oldest: string | null }[]>`SELECT COUNT(*) AS n, MIN(at) AS oldest FROM SiteActivity`;
  return { count: Number(row?.n ?? 0), oldest: row?.oldest ?? null };
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
