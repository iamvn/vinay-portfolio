import { randomBytes } from 'node:crypto';
import { mainClient } from '@/lib/db-client';
import type { DesignData } from './templates';
import type { TemplateKind } from './ai-template';
import { paletteOf, type Palette } from './custom-templates';

/**
 * Templates people published for everyone (Admin → Design → Your templates → Publish). They live in the MAIN
 * site's database (table SharedTemplate) so every site sees the same list. Each is a snapshot of the author's
 * template at the time they published (publishing again refreshes it); the author's name only shows on the
 * template card, never on a page made from it.
 */

const CREATE = [
  `CREATE TABLE IF NOT EXISTS SharedTemplate (id TEXT PRIMARY KEY, site TEXT NOT NULL, siteName TEXT NOT NULL DEFAULT '', source TEXT NOT NULL,
    kind TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', theme TEXT NOT NULL DEFAULT 'clean', blocks INTEGER NOT NULL DEFAULT 0,
    author TEXT NOT NULL DEFAULT '', palette TEXT NOT NULL DEFAULT '{}', data TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS SharedTemplate_source ON SharedTemplate (site, source)',
  'CREATE INDEX IF NOT EXISTS SharedTemplate_kind ON SharedTemplate (kind, createdAt)',
];
let ready: Promise<void> | null = null;
const ensureTable = () => (ready ??= (async () => {
  for (const sql of CREATE) await mainClient.$executeRawUnsafe(sql);
  // Added after the first version.
  await mainClient.$executeRawUnsafe("ALTER TABLE SharedTemplate ADD COLUMN palette TEXT NOT NULL DEFAULT '{}'").catch((error) => { if (!/duplicate column/i.test(String(error))) throw error; });
})().catch((error) => { ready = null; throw error; }));

export const MAX_SHARED_PER_SITE = 12;
export const MAX_SHARED_TOTAL = 500;
export const isSharedId = (id: string) => /^shared-[a-f0-9]{12,40}$/.test(id);

export type SharedTemplate = {
  id: string; site: string; siteName: string; source: string; kind: TemplateKind; name: string; description: string;
  theme: string; palette: Palette; blocks: number; author: string; createdAt: string; updatedAt: string;
};
type Row = Omit<SharedTemplate, 'blocks' | 'kind' | 'palette'> & { blocks: number | bigint; kind: string; palette?: string; data?: string };
const parsePalette = (raw: string | undefined): Palette => { try { return JSON.parse(raw || '{}') as Palette; } catch { return {}; } };
const toShared = ({ data: _data, palette, ...row }: Row): SharedTemplate => ({ ...row, palette: parsePalette(palette), blocks: Number(row.blocks), kind: row.kind === 'project' ? 'project' : 'home' }); // eslint-disable-line @typescript-eslint/no-unused-vars
const COLUMNS = 'id, site, siteName, source, kind, name, description, theme, palette, blocks, author, createdAt, updatedAt';

export class SharedLimitError extends Error {}

export async function listShared(kind: TemplateKind) {
  await ensureTable();
  const rows = await mainClient.$queryRawUnsafe<Row[]>(`SELECT ${COLUMNS} FROM SharedTemplate WHERE kind = ? ORDER BY createdAt DESC LIMIT 200`, kind);
  return rows.map(toShared);
}

export async function getShared(id: string): Promise<(SharedTemplate & { data: DesignData }) | null> {
  if (!isSharedId(id)) return null;
  await ensureTable();
  const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM SharedTemplate WHERE id = ${id}`;
  if (!rows[0]) return null;
  try { return { ...toShared(rows[0]), data: JSON.parse(rows[0].data ?? '') as DesignData }; } catch { return null; }
}

/** The shared copy of one of a site's templates, if it's published. */
export async function sharedFor(site: string, source: string) {
  await ensureTable();
  const rows = await mainClient.$queryRawUnsafe<Row[]>(`SELECT ${COLUMNS} FROM SharedTemplate WHERE site = ? AND source = ?`, site, source);
  return rows[0] ? toShared(rows[0]) : null;
}

/** Publishes a template for everyone, or refreshes the published copy. */
export async function publishShared(input: Omit<SharedTemplate, 'id' | 'createdAt' | 'updatedAt' | 'palette'> & { data: DesignData }) {
  await ensureTable();
  const now = new Date().toISOString();
  const palette = JSON.stringify(paletteOf(input.data));
  const existing = await sharedFor(input.site, input.source);
  const data = JSON.stringify(input.data);
  if (existing) {
    await mainClient.$executeRaw`UPDATE SharedTemplate SET siteName = ${input.siteName}, name = ${input.name}, description = ${input.description}, theme = ${input.theme},
      blocks = ${input.blocks}, author = ${input.author}, palette = ${palette}, data = ${data}, updatedAt = ${now} WHERE id = ${existing.id}`;
    const { data: _data, ...meta } = input; // eslint-disable-line @typescript-eslint/no-unused-vars
    return { ...existing, ...meta, palette: parsePalette(palette), updatedAt: now };
  }
  const [mine, all] = await Promise.all([
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM SharedTemplate WHERE site = ${input.site}`,
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM SharedTemplate`,
  ]);
  if (Number(mine[0]?.n ?? 0) >= MAX_SHARED_PER_SITE) throw new SharedLimitError(`A site can publish up to ${MAX_SHARED_PER_SITE} templates. Unpublish one first.`);
  if (Number(all[0]?.n ?? 0) >= MAX_SHARED_TOTAL) throw new SharedLimitError('The shared template library is full right now.');
  const id = `shared-${randomBytes(8).toString('hex')}`;
  await mainClient.$executeRaw`INSERT INTO SharedTemplate (id, site, siteName, source, kind, name, description, theme, palette, blocks, author, data, createdAt, updatedAt)
    VALUES (${id}, ${input.site}, ${input.siteName}, ${input.source}, ${input.kind}, ${input.name}, ${input.description}, ${input.theme}, ${palette}, ${input.blocks},
      ${input.author}, ${data}, ${now}, ${now})`;
  const { data: _data, ...meta } = input; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...meta, palette: parsePalette(palette), id, createdAt: now, updatedAt: now };
}

/** Keeps a published copy's name and description in step with the author's template. */
export async function renameShared(site: string, source: string, change: { name: string; description: string }) {
  await ensureTable();
  await mainClient.$executeRaw`UPDATE SharedTemplate SET name = ${change.name}, description = ${change.description}, updatedAt = ${new Date().toISOString()} WHERE site = ${site} AND source = ${source}`;
}

export async function unpublishShared(site: string, source: string) {
  await ensureTable();
  return (await mainClient.$executeRaw`DELETE FROM SharedTemplate WHERE site = ${site} AND source = ${source}`) > 0;
}

export async function removeShared(id: string) {
  await ensureTable();
  return (await mainClient.$executeRaw`DELETE FROM SharedTemplate WHERE id = ${id}`) > 0;
}

/** When a site is deleted. */
export async function removeSiteShared(site: string) {
  await ensureTable();
  await mainClient.$executeRaw`DELETE FROM SharedTemplate WHERE site = ${site}`;
}
