import { createHash, randomUUID } from 'node:crypto';
import { prisma } from './prisma';
import { currentSite } from './sites/context';
import { clientIp } from './rate-limit';
import { classifySource, isBot, parseUserAgent, referrerHost } from './traffic-sources';

/**
 * Visitor analytics for Admin → Insights, kept in each site's own database.
 *
 * Privacy: no cookies, no IP addresses, nothing that identifies a person. A visitor is a one-way hash of
 * (secret, today's date, site, IP, browser) that changes every day, so the same person can't be followed
 * from one day to the next, and the hash can't be turned back into an IP. Location is the country / region /
 * city the hosting platform derives from the request (Vercel, Cloudflare); the IP itself is never stored.
 * Rows older than RETENTION_DAYS are deleted.
 */

export const RETENTION_DAYS = 400;
export const GOAL_TYPES = ['resume_download', 'contact_email', 'contact_copy', 'contact_linkedin', 'ask', 'form'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

const SQL = [
  `CREATE TABLE IF NOT EXISTS PageView (id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, path TEXT NOT NULL, visitor TEXT NOT NULL, entry INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT '', medium TEXT NOT NULL DEFAULT '', referrer TEXT NOT NULL DEFAULT '', campaign TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '', browser TEXT NOT NULL DEFAULT '', os TEXT NOT NULL DEFAULT '', duration INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS PageView_createdAt ON PageView (createdAt)`,
  `CREATE INDEX IF NOT EXISTS PageView_visitor ON PageView (visitor, createdAt)`,
  `CREATE TABLE IF NOT EXISTS TrafficGoal (id INTEGER PRIMARY KEY AUTOINCREMENT, createdAt TEXT NOT NULL, type TEXT NOT NULL, visitor TEXT NOT NULL, path TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS TrafficGoal_createdAt ON TrafficGoal (createdAt)`,
];

// The tables come with every deploy's migration (prisma/init.sql); this covers a server that skipped it.
const ready = new Map<string, Promise<void>>();
async function ensureTables() {
  const site = await currentSite();
  const key = `${site.slug}|${site.createdAt}`;
  let done = ready.get(key);
  if (!done) {
    done = (async () => { for (const sql of SQL) await prisma.$executeRawUnsafe(sql); })();
    done.catch(() => ready.delete(key));
    ready.set(key, done);
  }
  await done;
}

/** Today's anonymous id for whoever sent this request on this site. */
export async function visitorId(request: Request): Promise<string> {
  const site = await currentSite().catch(() => null);
  const day = new Date().toISOString().slice(0, 10);
  const secret = process.env.AUTH_SECRET || 'portfolio-analytics';
  const ua = request.headers.get('user-agent') ?? '';
  return createHash('sha256').update(`${secret}|${day}|${site?.slug ?? 'main'}|${clientIp(request)}|${ua}`).digest('base64url').slice(0, 22);
}

const header = (request: Request, name: string) => {
  const value = request.headers.get(name)?.trim() ?? '';
  try { return decodeURIComponent(value).slice(0, 80); } catch { return value.slice(0, 80); }
};

/** Country / region / city from the hosting platform's headers ('' when unknown, e.g. on a laptop). */
export function locationOf(request: Request) {
  const country = (header(request, 'x-vercel-ip-country') || header(request, 'cf-ipcountry')).toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : '',
    region: header(request, 'x-vercel-ip-country-region') || header(request, 'cf-region'),
    city: header(request, 'x-vercel-ip-city') || header(request, 'cf-ipcity'),
  };
}

/** Visits from someone signed in to this site (you, editing) aren't counted. */
export const signedIn = (request: Request) => !!request.headers.get('cookie')?.includes('portfolio_session=');

const cleanPath = (path: string) => {
  const p = (path || '/').split(/[?#]/)[0].slice(0, 300);
  return p.startsWith('/') ? p : '/';
};
const cleanReferrer = (referrer: string) => {
  try {
    const url = new URL(referrer);
    if (url.protocol === 'android-app:') return `android-app://${url.host || url.pathname.replace(/^\/+/, '').split('/')[0]}`;
    if (!/^https?:$/.test(url.protocol)) return '';
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`.slice(0, 300); // no query string: it can hold personal data
  } catch {
    return '';
  }
};
/** Pages that are never counted: the admin, sign-in, API and preview pages. */
export const isTrackedPath = (path: string) => !/^\/(admin|login|api|_next)(\/|$)/.test(path);

export type ViewInput = { id: string; path: string; referrer: string; load: boolean; utmSource?: string; utmMedium?: string; utmCampaign?: string };

/** Records one page view. Returns false when it isn't counted (bot, signed in, admin page…). Never throws. */
export async function recordView(request: Request, input: ViewInput): Promise<boolean> {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    const path = cleanPath(input.path);
    if (isBot(ua) || signedIn(request) || !isTrackedPath(path) || !/^[\w-]{8,64}$/.test(input.id)) return false;
    await ensureTables();
    const ownHost = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(',')[0].trim();
    const referrer = cleanReferrer(input.referrer);
    const { source, medium } = classifySource({ referrer, utmSource: input.utmSource, utmMedium: input.utmMedium, ownHost, userAgent: ua });
    // A visit starts when a page is opened from outside the site (or typed in), not on clicks between pages.
    const internal = !input.utmSource && referrerHost(referrer) !== '' && referrerHost(referrer) === ownHost.toLowerCase().replace(/^www\./, '').split(':')[0];
    const entry = input.load && !internal;
    const { device, browser, os } = parseUserAgent(ua);
    const { country, region, city } = locationOf(request);
    const visitor = await visitorId(request);
    const now = new Date().toISOString();
    await prisma.$executeRaw`INSERT OR IGNORE INTO PageView (id, createdAt, path, visitor, entry, source, medium, referrer, campaign, country, region, city, device, browser, os)
      VALUES (${input.id}, ${now}, ${path}, ${visitor}, ${entry ? 1 : 0}, ${entry ? source : ''}, ${entry ? medium : ''}, ${entry ? referrer : ''}, ${entry ? (input.utmCampaign ?? '').trim().slice(0, 80) : ''},
              ${country}, ${region}, ${city}, ${device}, ${browser}, ${os})`;
    if (Math.random() < 1 / 300) await prune();
    return true;
  } catch (error) {
    console.error('recordView failed', error);
    return false;
  }
}

/** Time the page was actually on screen, reported when the visitor leaves it. Capped at 30 minutes. */
export async function recordDuration(id: string, ms: number) {
  try {
    if (!/^[\w-]{8,64}$/.test(id) || !Number.isFinite(ms) || ms <= 0) return;
    await ensureTables();
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const value = Math.min(Math.round(ms), 30 * 60 * 1000);
    await prisma.$executeRaw`UPDATE PageView SET duration = MAX(duration, ${value}) WHERE id = ${id} AND createdAt >= ${since}`;
  } catch (error) {
    console.error('recordDuration failed', error);
  }
}

/** Records a goal (resume download, contact click…) so Insights can show which sources lead to it. Never throws. */
export async function recordGoal(request: Request, type: GoalType) {
  try {
    if (isBot(request.headers.get('user-agent') ?? '') || signedIn(request)) return;
    await ensureTables();
    let path = '';
    try { path = cleanPath(new URL(request.headers.get('referer') ?? '').pathname); } catch { /* none */ }
    await prisma.$executeRaw`INSERT INTO TrafficGoal (createdAt, type, visitor, path) VALUES (${new Date().toISOString()}, ${type}, ${await visitorId(request)}, ${path})`;
  } catch (error) {
    console.error('recordGoal failed', error);
  }
}

async function prune() {
  const before = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await prisma.$executeRaw`DELETE FROM PageView WHERE createdAt < ${before}`;
  await prisma.$executeRaw`DELETE FROM TrafficGoal WHERE createdAt < ${before}`;
}

/** Deletes all visitor analytics of this site. */
export async function clearTraffic() {
  await ensureTables();
  await prisma.$executeRaw`DELETE FROM PageView`;
  await prisma.$executeRaw`DELETE FROM TrafficGoal`;
}

// ---------------------------------------------------------------- reports

export type Filters = { source?: string; country?: string; device?: string; page?: string };
export type Period = { from: string; to: string; prevFrom: string; prevTo: string; tzMinutes: number; bucket: 'hour' | 'day' | 'month' };

type Row = Record<string, unknown>;
const num = (value: unknown) => (typeof value === 'bigint' ? Number(value) : typeof value === 'number' ? value : Number(value ?? 0) || 0);
const str = (value: unknown) => (value == null ? '' : String(value));

/** "visitor IN (…)" for the active filters: only visitors who came from that source, viewed that page, etc. */
function filterSql(filters: Filters, from: string, to: string): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const add = (cond: string, value: string) => {
    parts.push(` AND visitor IN (SELECT visitor FROM PageView WHERE createdAt >= ? AND createdAt < ? AND ${cond})`);
    params.push(from, to, value);
  };
  if (filters.source) add('entry = 1 AND source = ?', filters.source);
  if (filters.country) add('country = ?', filters.country === 'unknown' ? '' : filters.country);
  if (filters.device) add('device = ?', filters.device);
  if (filters.page) add('path = ?', filters.page);
  return { sql: parts.join(''), params };
}

async function query(sql: string, params: unknown[]): Promise<Row[]> {
  return prisma.$queryRawUnsafe<Row[]>(sql, ...params);
}

async function totals(from: string, to: string, filters: Filters) {
  const f = filterSql(filters, from, to);
  const [row] = await query(
    `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, COALESCE(SUM(entry), 0) AS visits, COALESCE(SUM(duration), 0) AS time
     FROM PageView WHERE createdAt >= ? AND createdAt < ?${f.sql}`, [from, to, ...f.params]);
  const [bounce] = await query(
    `SELECT COUNT(*) AS n FROM (SELECT visitor FROM PageView WHERE createdAt >= ? AND createdAt < ?${f.sql} GROUP BY visitor HAVING COUNT(*) = 1)`, [from, to, ...f.params]);
  const visitors = num(row?.visitors);
  const visits = Math.max(num(row?.visits), visitors ? 1 : 0);
  return {
    visitors,
    visits: num(row?.visits),
    views: num(row?.views),
    avgTime: visits ? Math.round(num(row?.time) / visits) : 0, // ms on screen per visit
    bounceRate: visitors ? num(bounce?.n) / visitors : 0, // visitors who saw one page only
  };
}

export async function trafficReport(period: Period, filters: Filters) {
  await ensureTables();
  const { from, to, prevFrom, prevTo } = period;
  const shift = `${period.tzMinutes >= 0 ? '+' : ''}${Math.round(period.tzMinutes)} minutes`;
  const f = filterSql(filters, from, to);
  const base = `createdAt >= ? AND createdAt < ?${f.sql}`;
  const args = [from, to, ...f.params];
  const fmt = period.bucket === 'hour' ? '%Y-%m-%dT%H' : period.bucket === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const live = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const group = (column: string, entryOnly = false, limit = 50) => query(
    `SELECT ${column} AS name, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS n FROM PageView WHERE ${base}${entryOnly ? ' AND entry = 1' : ''}
     GROUP BY ${column} ORDER BY visitors DESC, n DESC LIMIT ${limit}`, args);

  const [now, before, series, sources, mediums, referrers, campaigns, pages, entryPages, countries, cities, devices, browsers, oss, goals, liveRow, recent] = await Promise.all([
    totals(from, to, filters),
    totals(prevFrom, prevTo, filters),
    query(`SELECT strftime('${fmt}', createdAt, ?) AS t, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, COALESCE(SUM(entry), 0) AS visits
           FROM PageView WHERE ${base} GROUP BY t ORDER BY t`, [shift, ...args]),
    query(`SELECT source AS name, medium, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS n FROM PageView WHERE ${base} AND entry = 1
           GROUP BY source, medium ORDER BY visitors DESC, n DESC LIMIT 50`, args),
    group('medium', true),
    query(`SELECT referrer AS name, source, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS n FROM PageView WHERE ${base} AND entry = 1 AND referrer != ''
           GROUP BY referrer ORDER BY visitors DESC, n DESC LIMIT 50`, args),
    query(`SELECT campaign AS name, source, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS n FROM PageView WHERE ${base} AND entry = 1 AND campaign != ''
           GROUP BY campaign, source ORDER BY visitors DESC, n DESC LIMIT 50`, args),
    query(`SELECT path AS name, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS n, CAST(AVG(NULLIF(duration, 0)) AS INTEGER) AS time
           FROM PageView WHERE ${base} GROUP BY path ORDER BY visitors DESC, n DESC LIMIT 50`, args),
    group('path', true),
    group('country'),
    query(`SELECT city AS name, country, region, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS n FROM PageView WHERE ${base} AND city != ''
           GROUP BY city, country ORDER BY visitors DESC, n DESC LIMIT 50`, args),
    group('device'),
    group('browser'),
    group('os'),
    // Each goal is credited to where that visitor's visit came from (same day; the visitor id changes daily).
    query(`SELECT g.type AS type, COALESCE((SELECT p.source FROM PageView p WHERE p.visitor = g.visitor AND p.entry = 1 AND p.createdAt <= g.createdAt ORDER BY p.createdAt DESC LIMIT 1), 'Unknown') AS source, COUNT(*) AS n
           FROM TrafficGoal g WHERE g.createdAt >= ? AND g.createdAt < ?${f.sql.replaceAll('visitor IN', 'g.visitor IN')} GROUP BY type, source ORDER BY n DESC`, [from, to, ...f.params]),
    query(`SELECT COUNT(DISTINCT visitor) AS n FROM PageView WHERE createdAt >= ?`, [live]),
    query(`SELECT id, createdAt, path, source, medium, referrer, campaign, country, region, city, device, browser, os, visitor
           FROM PageView WHERE ${base} AND entry = 1 ORDER BY createdAt DESC LIMIT 40`, args),
  ]);

  // What each recent visit did: pages seen, time on screen and goals, until that visitor's next visit.
  const visits = await Promise.all(recent.map(async (row) => {
    const visitor = str(row.visitor);
    const start = str(row.createdAt);
    const [next] = await query(`SELECT MIN(createdAt) AS t FROM PageView WHERE visitor = ? AND entry = 1 AND createdAt > ?`, [visitor, start]);
    const end = str(next?.t) || '9999';
    const [pagesRow, goalRows] = await Promise.all([
      query(`SELECT COUNT(*) AS n, COALESCE(SUM(duration), 0) AS time, GROUP_CONCAT(path, '\n') AS paths FROM (SELECT path, duration FROM PageView WHERE visitor = ? AND createdAt >= ? AND createdAt < ? ORDER BY createdAt)`, [visitor, start, end]),
      query(`SELECT type FROM TrafficGoal WHERE visitor = ? AND createdAt >= ? AND createdAt < ? ORDER BY createdAt`, [visitor, start, end]),
    ]);
    return {
      id: str(row.id), at: start, landing: str(row.path), source: str(row.source), medium: str(row.medium), referrer: str(row.referrer), campaign: str(row.campaign),
      country: str(row.country), region: str(row.region), city: str(row.city), device: str(row.device), browser: str(row.browser), os: str(row.os),
      views: num(pagesRow[0]?.n), time: num(pagesRow[0]?.time), pages: [...new Set(str(pagesRow[0]?.paths).split('\n').filter(Boolean))].slice(0, 12),
      goals: goalRows.map((g) => str(g.type)),
    };
  }));

  const list = (rows: Row[], extra: (row: Row) => Record<string, unknown> = () => ({})) =>
    rows.map((row) => ({ name: str(row.name), visitors: num(row.visitors), count: num(row.n), ...extra(row) }));

  return {
    totals: now,
    previous: before,
    live: num(liveRow[0]?.n),
    series: series.map((row) => ({ t: str(row.t), views: num(row.views), visitors: num(row.visitors), visits: num(row.visits) })),
    sources: list(sources, (row) => ({ medium: str(row.medium) })),
    mediums: list(mediums),
    referrers: list(referrers, (row) => ({ source: str(row.source) })),
    campaigns: list(campaigns, (row) => ({ source: str(row.source) })),
    pages: list(pages, (row) => ({ time: num(row.time) })),
    entryPages: list(entryPages),
    countries: list(countries),
    cities: list(cities, (row) => ({ country: str(row.country), region: str(row.region) })),
    devices: list(devices),
    browsers: list(browsers),
    os: list(oss),
    goals: goals.map((row) => ({ type: str(row.type), source: str(row.source), count: num(row.n) })),
    visits,
  };
}

export type TrafficReport = Awaited<ReturnType<typeof trafficReport>>;
export const newViewId = () => randomUUID();
