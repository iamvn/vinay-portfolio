import { randomBytes } from 'node:crypto';
import { mainClient } from '@/lib/db-client';
import { KINDS, TOPICS, hostOf, kindOf, normalizeUrl, type Kind, type Resource, type ResourceInput, type Topic } from './resource-types';

/**
 * Free resources live in the MAIN site's database (table CommunityResource), like the interview board, so
 * every site reads and adds to one shared library. Anyone can add a link; the platform owner can remove one.
 */

const CREATE = [
  `CREATE TABLE IF NOT EXISTS CommunityResource (id TEXT PRIMARY KEY, url TEXT NOT NULL, urlKey TEXT NOT NULL, title TEXT NOT NULL,
    topic TEXT NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, verifiedSite TEXT NOT NULL DEFAULT '',
    verifiedUrl TEXT NOT NULL DEFAULT '', sender TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'published', createdAt TEXT NOT NULL)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS CommunityResource_urlKey ON CommunityResource (urlKey)',
  'CREATE INDEX IF NOT EXISTS CommunityResource_status_created ON CommunityResource (status, createdAt)',
  'CREATE INDEX IF NOT EXISTS CommunityResource_sender ON CommunityResource (sender, createdAt)',
];
let ready: Promise<void> | null = null;
const ensureTable = () => (ready ??= (async () => { for (const sql of CREATE) await mainClient.$executeRawUnsafe(sql); })().catch((error) => { ready = null; throw error; }));

/** Keeps the shared database small and spam out. */
export const MAX_PER_SENDER_PER_DAY = 15;
export const MAX_RESOURCES = 5000;
export const PAGE_SIZE = 30;

type Row = { id: string; url: string; title: string; topic: string; kind: string; note: string; name: string; verifiedSite: string; verifiedUrl: string; createdAt: string };

const toResource = (row: Row): Resource => ({
  id: row.id, url: row.url, host: hostOf(row.url), title: row.title,
  topic: ((TOPICS as readonly string[]).includes(row.topic) ? row.topic : 'Other') as Topic,
  kind: ((KINDS as readonly string[]).includes(row.kind) ? row.kind : 'Article') as Kind,
  note: row.note, name: row.name,
  verified: row.verifiedSite ? { site: row.verifiedSite, url: row.verifiedUrl } : null,
  createdAt: row.createdAt,
});
const like = (text: string) => `%${text.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export class ResourceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type LibraryQuery = { q?: string; topic?: string; kind?: string; by?: string; page?: number };

export async function listResources(query: LibraryQuery) {
  await ensureTable();
  const where = ["status = 'published'"];
  const args: unknown[] = [];
  if (query.q) for (const word of query.q.trim().split(/\s+/).slice(0, 6)) {
    where.push("(LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(note) LIKE ? ESCAPE '\\' OR LOWER(url) LIKE ? ESCAPE '\\')");
    args.push(like(word), like(word), like(word));
  }
  if (query.topic) { where.push('topic = ?'); args.push(query.topic); }
  if (query.kind) { where.push('kind = ?'); args.push(query.kind); }
  if (query.by) { where.push('LOWER(name) = ?'); args.push(query.by.toLowerCase()); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const page = Math.max(0, query.page ?? 0);
  const [rows, count, topics, kinds, people] = await Promise.all([
    mainClient.$queryRawUnsafe<Row[]>(`SELECT * FROM CommunityResource ${clause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, ...args, PAGE_SIZE, page * PAGE_SIZE),
    mainClient.$queryRawUnsafe<{ n: number | bigint }[]>(`SELECT COUNT(*) AS n FROM CommunityResource ${clause}`, ...args),
    mainClient.$queryRawUnsafe<{ topic: string; n: number | bigint }[]>("SELECT topic, COUNT(*) AS n FROM CommunityResource WHERE status = 'published' GROUP BY topic ORDER BY n DESC"),
    mainClient.$queryRawUnsafe<{ kind: string; n: number | bigint }[]>("SELECT kind, COUNT(*) AS n FROM CommunityResource WHERE status = 'published' GROUP BY kind"),
    mainClient.$queryRawUnsafe<{ name: string; n: number | bigint }[]>("SELECT name, COUNT(*) AS n FROM CommunityResource WHERE status = 'published' GROUP BY LOWER(name) ORDER BY n DESC, MIN(createdAt) LIMIT 8"),
  ]);
  const total = Number(count[0]?.n ?? 0);
  return {
    resources: rows.map(toResource),
    total,
    all: topics.reduce((n, t) => n + Number(t.n), 0),
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    topics: topics.filter((t) => (TOPICS as readonly string[]).includes(t.topic)).map((t) => ({ name: t.topic as Topic, count: Number(t.n) })),
    kinds: KINDS.map((k) => ({ name: k, count: Number(kinds.find((x) => x.kind === k)?.n ?? 0) })).filter((k) => k.count > 0),
    people: people.map((p) => ({ name: p.name, count: Number(p.n) })),
  };
}

export async function addResource(input: ResourceInput, sender: string, verified: { site: string; url: string } | null): Promise<Resource> {
  await ensureTable();
  const urlKey = normalizeUrl(input.url);
  const existing = await mainClient.$queryRaw<{ name: string; status: string }[]>`SELECT name, status FROM CommunityResource WHERE urlKey = ${urlKey}`;
  if (existing[0]) {
    throw new ResourceError(existing[0].status === 'published' ? `Already in the library, shared by ${existing[0].name}. Thanks for thinking of it!` : 'This link can’t be added.', 409);
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [today, total] = await Promise.all([
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM CommunityResource WHERE sender = ${sender} AND createdAt > ${since}`,
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM CommunityResource`,
  ]);
  if (Number(today[0]?.n ?? 0) >= MAX_PER_SENDER_PER_DAY) throw new ResourceError(`You’ve shared ${MAX_PER_SENDER_PER_DAY} links today, thank you! Come back tomorrow for more.`, 429);
  if (Number(total[0]?.n ?? 0) >= MAX_RESOURCES) throw new ResourceError('The library is full for now. Please try again later.', 429);
  const row: Row & { urlKey: string; sender: string } = {
    id: randomBytes(6).toString('hex'), url: input.url.trim(), urlKey, title: input.title, topic: input.topic, kind: kindOf(input.url),
    note: input.note, name: input.name, verifiedSite: verified?.site ?? '', verifiedUrl: verified?.url ?? '', sender, createdAt: new Date().toISOString(),
  };
  await mainClient.$executeRaw`INSERT INTO CommunityResource (id, url, urlKey, title, topic, kind, note, name, verifiedSite, verifiedUrl, sender, status, createdAt)
    VALUES (${row.id}, ${row.url}, ${row.urlKey}, ${row.title}, ${row.topic}, ${row.kind}, ${row.note}, ${row.name}, ${row.verifiedSite}, ${row.verifiedUrl}, ${row.sender}, 'published', ${row.createdAt})`;
  return toResource(row);
}

/** Hidden, not deleted: the link stays blocked so it can't simply be added again. */
export async function hideResource(id: string) {
  if (!/^[a-f0-9]{12}$/.test(id)) return false;
  await ensureTable();
  return (await mainClient.$executeRaw`UPDATE CommunityResource SET status = 'hidden' WHERE id = ${id}`) > 0;
}
