import { mainClient } from '@/lib/db-client';
import { databaseConfig } from '@/lib/db-config';
import { decryptSecret, encryptSecret } from '@/lib/ai/crypto';
import { MAIN_SLUG, parseHost } from './hosts';

/**
 * The list of sites, kept in the main site's database (table Site). Each site has its own database;
 * the main site (yours) uses DATABASE_URL and isn't listed here.
 */
export type Site = {
  slug: string;
  name: string;
  ownerEmail: string;
  domain: string | null;
  dbUrl: string;
  dbToken?: string;
  dbName: string;
  status: 'active' | 'suspended';
  createdAt: string;
  isMain: boolean;
};

export function mainSite(): Site {
  const { url, authToken } = databaseConfig();
  return { slug: MAIN_SLUG, name: 'Main site', ownerEmail: '', domain: null, dbUrl: url, dbToken: authToken, dbName: '', status: 'active', createdAt: '', isMain: true };
}

const CREATE = `CREATE TABLE IF NOT EXISTS Site (slug TEXT PRIMARY KEY, name TEXT NOT NULL, ownerEmail TEXT NOT NULL DEFAULT '', domain TEXT UNIQUE, dbUrl TEXT NOT NULL, dbTokenCipher TEXT NOT NULL DEFAULT '', dbName TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', createdAt TEXT NOT NULL)`;
let ready: Promise<unknown> | null = null;
const ensureTable = () => (ready ??= mainClient.$executeRawUnsafe(CREATE).catch((error) => { ready = null; throw error; }));

type Row = { slug: string; name: string; ownerEmail: string; domain: string | null; dbUrl: string; dbTokenCipher: string; dbName: string; status: string; createdAt: string };
const toSite = (row: Row): Site => ({
  slug: row.slug, name: row.name, ownerEmail: row.ownerEmail, domain: row.domain || null, dbUrl: row.dbUrl,
  dbToken: row.dbTokenCipher ? decryptSecret(row.dbTokenCipher) ?? undefined : undefined, dbName: row.dbName,
  status: row.status === 'suspended' ? 'suspended' : 'active', createdAt: row.createdAt, isMain: false,
});

// Short cache: every request looks up its site, and sites change rarely. Shared through globalThis so the
// proxy and the route handlers (separate bundles in the same server) see a pause/delete at once; other
// servers pick it up within CACHE_MS.
const CACHE_MS = 10_000;
const shared = globalThis as unknown as { siteCache?: Map<string, { site: Site | null; at: number }> };
const cache = (shared.siteCache ??= new Map<string, { site: Site | null; at: number }>());
export const forgetSites = () => cache.clear();

async function cached(key: string, load: () => Promise<Site | null>, fresh = false) {
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.site;
  const site = await load();
  cache.set(key, { site, at: Date.now() });
  return site;
}

export async function listSites(): Promise<Site[]> {
  await ensureTable();
  return (await mainClient.$queryRaw<Row[]>`SELECT * FROM Site ORDER BY createdAt DESC`).map(toSite);
}

export async function siteBySlug(slug: string, fresh = false): Promise<Site | null> {
  if (slug === MAIN_SLUG) return mainSite();
  return cached(`slug:${slug}`, async () => {
    await ensureTable();
    const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM Site WHERE slug = ${slug}`;
    return rows[0] ? toSite(rows[0]) : null;
  }, fresh);
}

async function siteByDomain(domain: string, fresh = false): Promise<Site | null> {
  return cached(`domain:${domain}`, async () => {
    await ensureTable();
    const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM Site WHERE domain = ${domain}`;
    return rows[0] ? toSite(rows[0]) : null;
  }, fresh);
}

/**
 * The site for a host name; null when it's a subdomain of a site that doesn't exist.
 * `fresh` skips the cache: proxy.ts uses it so pausing or deleting a site applies on the very next request.
 */
export async function siteForHost(host: string | null | undefined, { fresh = false } = {}): Promise<Site | null> {
  const target = parseHost(host);
  if (target.kind === 'main') {
    // Free per-site addresses: extra *.vercel.app domains on the same project (e.g. savi-bharti.vercel.app),
    // saved as that site's custom domain. Every other vercel.app / localhost address is the main site.
    const name = (host ?? '').toLowerCase().replace(/:\d+$/, '');
    if (name.endsWith('.vercel.app')) return (await siteByDomain(name, fresh)) ?? mainSite();
    return mainSite();
  }
  if (target.kind === 'sub') return siteBySlug(target.slug, fresh);
  // A custom domain: a site's own domain, otherwise the main site (e.g. the main site's own domain).
  return (await siteByDomain(target.domain, fresh)) ?? mainSite();
}

export async function insertSite(site: Omit<Site, 'isMain' | 'dbToken'> & { dbToken?: string }) {
  await ensureTable();
  const cipher = site.dbToken ? encryptSecret(site.dbToken) : '';
  await mainClient.$executeRaw`INSERT INTO Site (slug, name, ownerEmail, domain, dbUrl, dbTokenCipher, dbName, status, createdAt)
    VALUES (${site.slug}, ${site.name}, ${site.ownerEmail}, ${site.domain}, ${site.dbUrl}, ${cipher}, ${site.dbName}, ${site.status}, ${site.createdAt})`;
  forgetSites();
}

export async function updateSite(slug: string, changes: Partial<Pick<Site, 'name' | 'domain' | 'status'>>) {
  const site = await siteBySlug(slug);
  if (!site || site.isMain) return null;
  const next = { ...site, ...changes };
  await mainClient.$executeRaw`UPDATE Site SET name = ${next.name}, domain = ${next.domain}, status = ${next.status} WHERE slug = ${slug}`;
  forgetSites();
  return next;
}

export async function removeSite(slug: string) {
  await ensureTable();
  await mainClient.$executeRaw`DELETE FROM Site WHERE slug = ${slug}`;
  forgetSites();
}
