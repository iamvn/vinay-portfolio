import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type Client, type InValue } from '@libsql/client';
import { databaseConfig } from '@/lib/db-config';
import { migrate } from '@/lib/db-migrate';
import { hashPassword } from '@/lib/auth/password';
import type { Site } from './registry';

/**
 * Creating and deleting a site's database.
 *   - With TURSO_API_TOKEN + TURSO_ORG (production): a new Turso database per site, via the Turso Platform API.
 *   - Without them (local development): a SQLite file per site in prisma/sites/.
 */
const TURSO_API = 'https://api.turso.tech/v1';
const tursoConfigured = () => Boolean(process.env.TURSO_API_TOKEN?.trim() && process.env.TURSO_ORG?.trim());

async function turso(path: string, init: RequestInit = {}) {
  const response = await fetch(`${TURSO_API}/organizations/${encodeURIComponent(process.env.TURSO_ORG!.trim())}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.TURSO_API_TOKEN!.trim()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Turso: ${body?.error ?? response.statusText} (${response.status})`);
  return body;
}

const localFile = (slug: string) => join(process.cwd(), 'prisma', 'sites', `${slug}.db`);

export async function createSiteDatabase(slug: string): Promise<{ dbUrl: string; dbToken?: string; dbName: string }> {
  if (tursoConfigured()) {
    const name = `site-${slug}`.slice(0, 64);
    const group = process.env.TURSO_GROUP?.trim() || 'default';
    const created = await turso('/databases', { method: 'POST', body: JSON.stringify({ name, group }) });
    const hostname = created?.database?.Hostname;
    if (!hostname) throw new Error('Turso did not return the new database address.');
    const token = await turso(`/databases/${encodeURIComponent(name)}/auth/tokens?authorization=full-access`, { method: 'POST' });
    if (!token?.jwt) throw new Error('Turso did not return a token for the new database.');
    return { dbUrl: `libsql://${hostname}`, dbToken: token.jwt, dbName: name };
  }
  if (process.env.VERCEL) {
    throw new Error('Creating sites on Vercel needs TURSO_API_TOKEN and TURSO_ORG (each site gets its own Turso database). Add them in Vercel → Settings → Environment Variables.');
  }
  mkdirSync(join(process.cwd(), 'prisma', 'sites'), { recursive: true });
  return { dbUrl: `file:${localFile(slug)}`, dbName: '' };
}

export async function deleteSiteDatabase(site: Site) {
  if (site.dbName && tursoConfigured()) {
    await turso(`/databases/${encodeURIComponent(site.dbName)}`, { method: 'DELETE' });
  } else if (site.dbUrl.startsWith('file:')) {
    rmSync(site.dbUrl.slice('file:'.length), { force: true });
  }
}

// ---------- the starting content ----------

/** Portfolio content and design copied from the main site. Users, AI keys, analytics, resumes and photos are not. */
const COPIED_TABLES = ['Profile', 'SiteCopy', 'SkillGroup', 'Experience', 'Project', 'ProjectImage'] as const;

async function copyTable(from: Client, to: Client, table: string, where = '') {
  // An older source database may not have every table yet (e.g. no saved design): nothing to copy then.
  const result = await from.execute(`SELECT * FROM "${table}" ${where}`).catch((error) => {
    if (/no such table/i.test(String(error))) return null;
    throw error;
  });
  if (!result) return 0;
  if (!result.rows.length) return 0;
  const columns = result.columns;
  const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  await to.batch(result.rows.map((row) => ({ sql, args: columns.map((c) => row[c] as InValue) })), 'write');
  return result.rows.length;
}

/**
 * Sets up a new site's database: tables, a copy of the creating site's portfolio content and design (the
 * main site's, unless another site's admin creates it) with the new owner's name and email, and the
 * owner's admin account.
 */
export async function prepareSiteDatabase(
  site: { dbUrl: string; dbToken?: string },
  owner: { name: string; email: string; password: string; createdAt?: string },
  from?: { dbUrl: string; dbToken?: string },
) {
  const target = createClient({ url: site.dbUrl, authToken: site.dbToken });
  const { url, authToken } = from ? { url: from.dbUrl, authToken: from.dbToken } : databaseConfig();
  const source = createClient({ url, authToken });
  try {
    await migrate(target);
    for (const table of COPIED_TABLES) await copyTable(source, target, table);
    // Only the starting design (what's live + the draft), never the publish history or who saved it.
    await copyTable(source, target, 'Setting', "WHERE key IN ('design.published', 'design.draft')");
    const now = owner.createdAt ?? new Date().toISOString();
    await target.execute({
      sql: "UPDATE Setting SET value = json_set(value, '$.savedBy', ?, '$.savedAt', ?) WHERE key IN ('design.published', 'design.draft') AND json_valid(value)",
      args: [owner.email, now],
    });
    // The copy is a starting point: your identity is replaced with the new owner's.
    const links = JSON.stringify({ email: owner.email, github: null, linkedin: null, instagram: null });
    await target.execute({ sql: "UPDATE Profile SET name = ?, socialLinks = ?, profileImage = '', assistantNotes = '' WHERE id = 1", args: [owner.name, links] });
    await target.execute({
      sql: 'INSERT INTO User (email, name, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [owner.email, owner.name, await hashPassword(owner.password), 'admin', new Date().toISOString()],
    });
  } finally {
    target.close();
    source.close();
  }
}
