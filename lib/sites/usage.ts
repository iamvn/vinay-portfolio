import { createClient, type Client } from '@libsql/client';
import { databaseConfig } from '@/lib/db-config';
import { mainClient } from '@/lib/db-client';
import { listSites, mainSite, type Site } from './registry';
import { databaseUsage } from './provision';

/**
 * Platform owner: how much each site is used, to spot inactive sites before their data piles up.
 * Reads each site's own database (sign-ins, visitors, content) and Turso's usage numbers (storage, reads,
 * writes this month). Nothing here changes any data.
 */
export type SiteUsage = {
  slug: string; name: string; ownerEmail: string; domain: string | null; status: string; createdAt: string; isMain: boolean;
  lastLogin: { at: string; email: string } | null;
  users: number | null; projects: number | null;
  views30: number | null; visitors30: number | null; lastView: string | null;
  storageBytes: number | null; rowsRead: number | null; rowsWritten: number | null;
  error?: string;
};

export const LAST_LOGIN_KEY = 'system.lastLogin';
const DAY = 86_400_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);

async function one<T>(db: Client, sql: string, args: (string | number)[] = []): Promise<T | null> {
  try {
    const result = await db.execute({ sql, args });
    return (result.rows[0] as T) ?? null;
  } catch {
    return null; // e.g. a table this site hasn't created yet
  }
}

/** The main database's Turso name: the host's first label without "-<org>". */
function mainDbName() {
  const { url } = databaseConfig();
  try {
    const label = new URL(url).host.split('.')[0];
    const org = process.env.TURSO_ORG?.trim();
    return org && label.endsWith(`-${org}`) ? label.slice(0, -(org.length + 1)) : '';
  } catch {
    return '';
  }
}

async function readSite(site: Site, loginsFromLog: Map<string, { at: string; email: string }>): Promise<SiteUsage> {
  const base: SiteUsage = {
    slug: site.slug, name: site.name, ownerEmail: site.ownerEmail, domain: site.domain, status: site.status, createdAt: site.createdAt, isMain: Boolean(site.isMain),
    lastLogin: loginsFromLog.get(site.slug) ?? null, users: null, projects: null, views30: null, visitors30: null, lastView: null,
    storageBytes: null, rowsRead: null, rowsWritten: null,
  };
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const errors: string[] = [];
  const db = createClient({ url: site.dbUrl, authToken: site.dbToken });
  try {
    await withTimeout((async () => {
      const [saved, users, projects, recent, last] = await Promise.all([
        one<{ value: string }>(db, 'SELECT value FROM Setting WHERE key = ?', [LAST_LOGIN_KEY]),
        one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM User'),
        one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM Project'),
        one<{ n: number; v: number }>(db, 'SELECT COUNT(*) AS n, COUNT(DISTINCT visitor) AS v FROM PageView WHERE createdAt >= ?', [since]),
        one<{ last: string | null }>(db, 'SELECT MAX(createdAt) AS last FROM PageView'),
      ]);
      try {
        const stored = saved?.value ? JSON.parse(saved.value) : null;
        if (stored?.at && (!base.lastLogin || stored.at > base.lastLogin.at)) base.lastLogin = { at: String(stored.at), email: String(stored.email ?? '') };
      } catch { /* ignore a malformed value */ }
      base.users = users ? Number(users.n) : null;
      base.projects = projects ? Number(projects.n) : null;
      base.views30 = recent ? Number(recent.n) : null;
      base.visitors30 = recent ? Number(recent.v) : null;
      base.lastView = last?.last ?? null;
    })(), 10_000);
  } catch (error) {
    errors.push(`database: ${error instanceof Error ? error.message : 'unreachable'}`);
  } finally {
    db.close();
  }
  try {
    const usage = await withTimeout(databaseUsage(site.isMain ? mainDbName() : site.dbName), 10_000);
    if (usage) Object.assign(base, usage);
  } catch (error) {
    errors.push(`usage: ${error instanceof Error ? error.message : 'unavailable'}`);
  }
  if (errors.length) base.error = errors.join('; ');
  return base;
}

export async function platformUsage() {
  const sites = await listSites();
  const loginsFromLog = new Map<string, { at: string; email: string }>();
  let trackingSince: string | null = null;
  try {
    const rows = await mainClient.$queryRawUnsafe<{ site: string; at: string; details: string }[]>(
      "SELECT site, at, details FROM SiteActivity WHERE kind = 'user.login' AND at = (SELECT MAX(a.at) FROM SiteActivity a WHERE a.kind = 'user.login' AND a.site = SiteActivity.site)",
    );
    for (const row of rows) {
      let email = '';
      try { email = String(JSON.parse(row.details)?.email ?? ''); } catch { /* ignore */ }
      loginsFromLog.set(row.site, { at: row.at, email });
    }
    const first = await mainClient.$queryRawUnsafe<{ at: string | null }[]>('SELECT MIN(at) AS at FROM SiteActivity');
    trackingSince = first[0]?.at ?? null;
  } catch { /* no activity log yet */ }
  const all = [mainSite(), ...sites];
  const usage = await Promise.all(all.map((site) => readSite(site, loginsFromLog)));
  const sum = (key: 'storageBytes' | 'rowsRead' | 'rowsWritten') => usage.reduce((n, u) => n + (u[key] ?? 0), 0);
  return {
    sites: usage,
    totals: { sites: sites.length, storageBytes: sum('storageBytes'), rowsRead: sum('rowsRead'), rowsWritten: sum('rowsWritten') },
    usageAvailable: usage.some((u) => u.storageBytes !== null),
    trackingSince,
    generatedAt: new Date().toISOString(),
  };
}
