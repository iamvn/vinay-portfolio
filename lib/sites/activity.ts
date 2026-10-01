import { mainClient } from '@/lib/db-client';
import type { Site } from './registry';

/**
 * What other sites' admins do that the main site's admin should know about: adding users, creating or
 * deleting sites. Kept in the main site's database (table SiteActivity) and shown in Admin → Sites.
 */
export type ActivityKind = 'user.added' | 'site.created' | 'site.deleted';
export type Activity = {
  id: number;
  at: string;
  site: string;       // slug of the site where it happened
  siteName: string;
  actor: string;      // "Name <email>" of the admin who did it
  kind: ActivityKind;
  details: Record<string, string>;
};

const CREATE = `CREATE TABLE IF NOT EXISTS SiteActivity (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, site TEXT NOT NULL, siteName TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}')`;
let ready: Promise<unknown> | null = null;
const ensureTable = () => (ready ??= mainClient.$executeRawUnsafe(CREATE).catch((error) => { ready = null; throw error; }));

export const actorLabel = (user: { name?: string | null; email: string }) => (user.name?.trim() ? `${user.name.trim()} <${user.email}>` : user.email);

/** Records something a site's admin did. Never throws: the action itself already happened. */
export async function logActivity(site: Pick<Site, 'slug' | 'name' | 'isMain'>, actor: string, kind: ActivityKind, details: Record<string, string>) {
  if (site.isMain) return; // only other sites' actions are reported to the main admin
  try {
    await ensureTable();
    await mainClient.$executeRaw`INSERT INTO SiteActivity (at, site, siteName, actor, kind, details)
      VALUES (${new Date().toISOString()}, ${site.slug}, ${site.name}, ${actor}, ${kind}, ${JSON.stringify(details)})`;
  } catch (error) {
    console.error('Could not record site activity:', error);
  }
}

type Row = { id: number | bigint; at: string; site: string; siteName: string; actor: string; kind: string; details: string };

export async function listActivity(limit = 100): Promise<Activity[]> {
  await ensureTable();
  const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM SiteActivity ORDER BY id DESC LIMIT ${limit}`;
  return rows.map((row) => {
    let details: Record<string, string> = {};
    try { details = JSON.parse(row.details); } catch { /* keep empty */ }
    return { id: Number(row.id), at: row.at, site: row.site, siteName: row.siteName, actor: row.actor, kind: row.kind as ActivityKind, details };
  });
}
