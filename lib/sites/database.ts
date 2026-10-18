import { createClient, type Client } from '@libsql/client';
import { databaseConfig } from '@/lib/db-config';
import { listSites, mainSite, siteBySlug, type Site } from './registry';
import { databaseUsage, deleteOrgDatabase, listOrgDatabases } from './provision';

/**
 * Platform owner → Database tab: how much of the Turso plan Kritipath uses, which sites and tables take the
 * space, and deleting old logs (visitor stats, events, activity) after a preview. Content (profiles, projects,
 * resumes, designs, users) is never part of a cleanup.
 */

/** Turso Free ("starter") plan limits, as `turso plan show` lists them. Change these on a paid plan. */
export const PLAN = {
  name: 'Turso Free',
  storageBytes: 5 * 1024 ** 3,
  rowsRead: 500_000_000,
  rowsWritten: 10_000_000,
  databases: 100,
};

/** What can be cleaned: only logs that grow forever. Each entry lists [table, timestamp column]. */
export const CLEANUP_KINDS = {
  visits: { label: 'Visitor stats', hint: 'Page views and goal clicks behind Insights. Older ones only change the long-range charts.', tables: [['PageView', 'createdAt'], ['TrafficGoal', 'createdAt']], mainOnly: false },
  events: { label: 'Contact & “Ask my resume” events', hint: 'Counts of resume downloads, contact clicks and questions asked.', tables: [['Event', 'createdAt']], mainOnly: false },
  activity: { label: 'Activity log', hint: 'Sign-ins and changes across every site (Activity logs tab). Kept in your main database only.', tables: [['SiteActivity', 'at']], mainOnly: true },
} as const;
export type CleanupKind = keyof typeof CLEANUP_KINDS;
export const CLEANUP_DAYS = [30, 90, 180, 365] as const;

/** Plain names for the tables people will see in the size list. */
const TABLE_NAMES: Record<string, string> = {
  PageView: 'Visitor stats (page views)', TrafficGoal: 'Visitor stats (goal clicks)', Event: 'Contact & Ask events', SiteActivity: 'Activity log',
  Profile: 'Profile', SiteCopy: 'Site text', SkillGroup: 'Skills', Experience: 'Experience', Project: 'Projects', ProjectImage: 'Project images',
  Resume: 'Resume files', ProfileImage: 'Profile photos', User: 'Users', AiProvider: 'AI providers', Setting: 'Settings, designs & personal data',
  ResumeDocument: 'Resume builder documents', JobApplication: 'Job applications', Asset: 'Uploaded files (list)', AssetBlock: 'Uploaded files (data)', Site: 'List of sites',
  FormSubmission: 'Contact form messages', SharedTemplate: 'Published templates',
  CommunityPost: 'Community posts', SupportRequest: 'Support requests',
};

/** The admin tab each table's data belongs to, for the "by tab" totals. Settings are split by key below. */
const TABLE_TAB: Record<string, string> = {
  Profile: 'Profile', ProfileImage: 'Profile', SiteCopy: 'Site text', SkillGroup: 'Skills', Experience: 'Experience',
  Project: 'Projects', ProjectImage: 'Projects', Resume: 'Resume', ResumeDocument: 'Resume builder', JobApplication: 'Applications',
  PageView: 'Insights', TrafficGoal: 'Insights', Event: 'Insights', FormSubmission: 'Insights', AiProvider: 'AI assistant',
  User: 'Users & security', Asset: 'Uploaded files', AssetBlock: 'Uploaded files', SharedTemplate: 'Design', CommunityPost: 'Community',
  SupportRequest: 'Support', SiteActivity: 'Activity logs', Site: 'Sites',
};
/** Setting rows by the first part of their key: design.* → Design, progress.* → Progress tracker… */
const SETTING_TAB: Record<string, string> = { design: 'Design', progress: 'Progress tracker', career: 'Applications', platform: 'Support', support: 'Support', system: 'Settings' };

const open = (site: Site): Client => createClient({ url: site.dbUrl, authToken: site.dbToken });
const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** The main database's name in Turso: the host's first label without "-<org>". */
function mainDbName() {
  try {
    const label = new URL(databaseConfig().url).host.split('.')[0];
    const org = process.env.TURSO_ORG?.trim();
    return org && label.endsWith(`-${org}`) ? label.slice(0, -(org.length + 1)) : '';
  } catch {
    return '';
  }
}

/** The bytes of every value in a database: its data size, without indexes or free pages. */
async function dataBytes(site: Site) {
  const db = open(site);
  try {
    const list = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE '_prisma%'");
    let total = 0;
    for (const row of list.rows) {
      const name = String(row.name);
      const cols = (await db.execute(`PRAGMA table_info(${quote(name)})`)).rows.map((c) => String(c.name));
      if (!cols.length) continue;
      const r = await db.execute(`SELECT COALESCE(SUM(${cols.map((c) => `COALESCE(length(CAST(${quote(c)} AS BLOB)), 0)`).join(' + ')}), 0) AS b FROM ${quote(name)}`);
      total += Number(r.rows[0]?.b ?? 0);
    }
    return total;
  } finally {
    db.close();
  }
}

/** Runs `fn` over the items a few at a time, so many sites don't all hit Turso at once. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

/**
 * Every site (main first) with its data size, this month's Turso storage and reads/writes, and any databases
 * in the Turso organization that no site uses any more.
 */
export async function databaseOverview() {
  const sites = [mainSite(), ...(await listSites())];
  const rows = await mapLimit(sites, 5, async (site) => {
    let usage: Awaited<ReturnType<typeof databaseUsage>> = null;
    let size: number | null = null;
    const errors: string[] = [];
    try { usage = await withTimeout(databaseUsage(site.isMain ? mainDbName() : site.dbName), 10_000); } catch (err) { errors.push(err instanceof Error ? err.message : 'usage unavailable'); }
    try { size = await withTimeout(dataBytes(site), 20_000); } catch (err) { errors.push(err instanceof Error ? err.message : 'unreadable'); }
    return { slug: site.slug, name: site.isMain ? 'Main site' : site.name, isMain: Boolean(site.isMain), status: site.status, dbName: site.isMain ? mainDbName() : site.dbName, dataBytes: size, storageBytes: usage?.storageBytes ?? null, rowsRead: usage?.rowsRead ?? null, rowsWritten: usage?.rowsWritten ?? null, error: errors.length ? errors.join('; ') : undefined };
  });
  // Databases in Turso that no site points at (e.g. left from before sites were deleted with their database).
  let orgDatabases: number | null = null;
  let unused: { name: string }[] = [];
  try {
    const all = await withTimeout(listOrgDatabases(), 10_000);
    if (all) {
      orgDatabases = all.length;
      const used = new Set(rows.map((r) => r.dbName).filter(Boolean));
      const mainHost = (() => { try { return new URL(databaseConfig().url).host; } catch { return ''; } })();
      unused = all.filter((d) => !used.has(d.name) && d.hostname !== mainHost).map((d) => ({ name: d.name }));
    }
  } catch { /* the list is optional */ }
  const sum = (key: 'storageBytes' | 'rowsRead' | 'rowsWritten') => rows.reduce((n, r) => n + (r[key] ?? 0), 0);
  return {
    plan: PLAN,
    usageAvailable: rows.some((r) => r.storageBytes !== null),
    totals: { storageBytes: sum('storageBytes'), dataBytes: rows.reduce((n, r) => n + (r.dataBytes ?? 0), 0), rowsRead: sum('rowsRead'), rowsWritten: sum('rowsWritten'), databases: orgDatabases ?? rows.length, sites: rows.length - 1 },
    unused,
    sites: rows.map(({ dbName: _dbName, ...r }) => { void _dbName; return r; })
      .sort((a, b) => Number(b.isMain) - Number(a.isMain) || ((b.storageBytes ?? b.dataBytes ?? 0) - (a.storageBytes ?? a.dataBytes ?? 0))),
    cleanup: Object.entries(CLEANUP_KINDS).map(([id, k]) => ({ id, label: k.label, hint: k.hint, mainOnly: k.mainOnly })),
    days: CLEANUP_DAYS,
    generatedAt: new Date().toISOString(),
  };
}

/** One site's tables: rows and approximate size (the bytes of every value), largest first. */
export async function siteTables(slug: string) {
  const site = slug === 'main' ? mainSite() : await siteBySlug(slug, true);
  if (!site) return null;
  const db = open(site);
  try {
    return await withTimeout((async () => {
      const list = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE '_prisma%'");
      const tables = [];
      for (const row of list.rows) {
        const name = String(row.name);
        const cols = (await db.execute(`PRAGMA table_info(${quote(name)})`)).rows.map((c) => String(c.name));
        const size = cols.length ? cols.map((c) => `COALESCE(length(CAST(${quote(c)} AS BLOB)), 0)`).join(' + ') : '0';
        const stats = await db.execute(`SELECT COUNT(*) AS n, COALESCE(SUM(${size}), 0) AS bytes FROM ${quote(name)}`);
        tables.push({ name, label: TABLE_NAMES[name] ?? name, rows: Number(stats.rows[0]?.n ?? 0), bytes: Number(stats.rows[0]?.bytes ?? 0) });
      }
      // Totals per admin tab: tables by TABLE_TAB, Setting rows by the first part of their key.
      const byTab = new Map<string, { tab: string; rows: number; bytes: number }>();
      const add = (tab: string, rows: number, b: number) => {
        const entry = byTab.get(tab) ?? { tab, rows: 0, bytes: 0 };
        entry.rows += rows; entry.bytes += b; byTab.set(tab, entry);
      };
      for (const t of tables) if (t.name !== 'Setting') add(TABLE_TAB[t.name] ?? 'Other', t.rows, t.bytes);
      if (tables.some((t) => t.name === 'Setting')) {
        const groups = await db.execute("SELECT substr(key, 1, instr(key || '.', '.') - 1) AS p, COUNT(*) AS n, COALESCE(SUM(length(CAST(key AS BLOB)) + length(CAST(value AS BLOB))), 0) AS bytes FROM Setting GROUP BY p");
        for (const g of groups.rows) add(SETTING_TAB[String(g.p)] ?? 'Settings', Number(g.n), Number(g.bytes));
      }
      return {
        tables: tables.sort((a, b) => b.bytes - a.bytes),
        tabs: [...byTab.values()].filter((t) => t.rows > 0 || t.bytes > 0).sort((a, b) => b.bytes - a.bytes),
      };
    })(), 20_000);
  } finally {
    db.close();
  }
}

/**
 * Counts (dryRun) or deletes rows of one kind older than `days`, on one site or all of them.
 * At least 30 days are always kept, whatever is asked.
 */
export async function cleanup(kind: CleanupKind, days: number, scope: string, dryRun: boolean) {
  const info = CLEANUP_KINDS[kind];
  const cutoff = new Date(Date.now() - Math.max(30, days) * 86_400_000).toISOString();
  const all = [mainSite(), ...(await listSites())];
  const sites = info.mainOnly ? [mainSite()] : scope === 'all' ? all : all.filter((s) => (s.isMain ? 'main' : s.slug) === scope);
  const results: { slug: string; name: string; rows: number; error?: string }[] = [];
  for (const site of sites) {
    const db = open(site);
    let rows = 0;
    try {
      for (const [table, column] of info.tables) {
        const exists = await db.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [table] });
        if (!exists.rows.length) continue;
        if (dryRun) {
          const r = await db.execute({ sql: `SELECT COUNT(*) AS n FROM ${quote(table)} WHERE ${quote(column)} < ?`, args: [cutoff] });
          rows += Number(r.rows[0]?.n ?? 0);
        } else {
          const r = await db.execute({ sql: `DELETE FROM ${quote(table)} WHERE ${quote(column)} < ?`, args: [cutoff] });
          rows += r.rowsAffected;
        }
      }
      results.push({ slug: site.isMain ? 'main' : site.slug, name: site.isMain ? 'Main site' : site.name, rows });
    } catch (err) {
      results.push({ slug: site.isMain ? 'main' : site.slug, name: site.isMain ? 'Main site' : site.name, rows, error: err instanceof Error ? err.message : 'failed' });
    } finally {
      db.close();
    }
  }
  return { kind, days: Math.max(30, days), cutoff, total: results.reduce((n, r) => n + r.rows, 0), sites: results.filter((r) => r.rows > 0 || r.error) };
}

/** Deletes a Turso database that no site uses. Refuses the main database and any site's database. */
export async function deleteUnusedDatabase(name: string) {
  const sites = await listSites();
  if (name === mainDbName() || sites.some((s) => s.dbName === name)) throw new Error('A site still uses that database.');
  const all = await listOrgDatabases();
  const mainHost = (() => { try { return new URL(databaseConfig().url).host; } catch { return ''; } })();
  const target = all?.find((d) => d.name === name);
  if (!target) throw new Error('No database with that name.');
  if (target.hostname === mainHost) throw new Error('That is the main database.');
  await deleteOrgDatabase(name);
}
