import { randomBytes } from 'node:crypto';
import { mainClient } from '@/lib/db-client';
import type { Site } from '@/lib/sites/registry';
import { CATEGORIES, normalizeTag, toPublic, type Post, type PostInput, type PostStatus, type PublicPost } from './types';

/**
 * Community posts live in the MAIN site's database (table CommunityPost), so every site's people write to,
 * and everyone reads from, the same board. Each post belongs to the site it was written on.
 */

const CREATE = [
  `CREATE TABLE IF NOT EXISTS CommunityPost (id TEXT PRIMARY KEY, site TEXT NOT NULL, siteName TEXT NOT NULL DEFAULT '', authorUser TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'published', category TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
    outcome TEXT NOT NULL DEFAULT '', level TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '', search TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS CommunityPost_status_created ON CommunityPost (status, createdAt)',
  'CREATE INDEX IF NOT EXISTS CommunityPost_site ON CommunityPost (site)',
];
let ready: Promise<void> | null = null;
const ensureTable = () => (ready ??= (async () => { for (const sql of CREATE) await mainClient.$executeRawUnsafe(sql); })().catch((error) => { ready = null; throw error; }));

/** Per site: how many posts in total, and how many new ones a day (keeps the shared database small and spam out). */
export const MAX_POSTS_PER_SITE = 300;
export const MAX_NEW_POSTS_PER_DAY = 20;
export const PAGE_SIZE = 20;

type Row = { id: string; site: string; siteName: string; authorUser: string; status: string; content: string; createdAt: string; updatedAt: string };

function toPost(row: Row): Post {
  let content: Partial<PostInput> & { authorUrl?: string } = {};
  try { content = JSON.parse(row.content); } catch { /* damaged row: show what we can */ }
  return {
    title: '', company: '', role: '', location: '', category: 'Other', level: '', outcome: '', difficulty: '', interviewedOn: '', tags: [], summary: '',
    rounds: [], questions: [], preparation: '', resources: [], authorName: '', authorHeadline: '', anonymous: false, published: true,
    ...content,
    authorUrl: content.authorUrl ?? '',
    id: row.id, site: row.site, siteName: row.siteName, status: (['published', 'draft', 'hidden'].includes(row.status) ? row.status : 'draft') as PostStatus,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

// Tags are stored as ",react,node.js," so one tag can be matched exactly with LIKE.
const tagColumn = (tags: string[]) => (tags.length ? `,${tags.map((t) => normalizeTag(t).toLowerCase()).join(',')},` : '');
const searchColumn = (p: PostInput) => [
  p.title, p.company, p.role, p.location, p.category, p.level, p.outcome, p.tags.join(' '), p.summary, p.preparation,
  ...p.rounds.map((r) => `${r.name} ${r.details}`), ...p.questions.map((q) => `${q.question} ${q.round} ${q.answer}`),
].join(' \n').toLowerCase().slice(0, 60_000);
const like = (text: string) => `%${text.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
// One of each tag, ignoring case, keeping the first spelling ("React", not a later "react").
const uniqueTags = (tags: string[]) => {
  const seen = new Map<string, string>();
  for (const tag of tags.map(normalizeTag).filter(Boolean)) if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
  return [...seen.values()].slice(0, 12);
};

// ---------- public board ----------

export type BoardQuery = { q?: string; category?: string; tag?: string; outcome?: string; level?: string; page?: number };

export async function listPublic(query: BoardQuery) {
  await ensureTable();
  const where = ["status = 'published'"];
  const args: unknown[] = [];
  if (query.q) for (const word of query.q.trim().split(/\s+/).slice(0, 6)) { where.push("search LIKE ? ESCAPE '\\'"); args.push(like(word)); }
  if (query.category) { where.push('category = ?'); args.push(query.category); }
  if (query.outcome) { where.push('outcome = ?'); args.push(query.outcome); }
  if (query.level) { where.push('level = ?'); args.push(query.level); }
  if (query.tag) { where.push("tags LIKE ? ESCAPE '\\'"); args.push(like(`,${normalizeTag(query.tag)},`)); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const page = Math.max(0, query.page ?? 0);
  const [rows, count, categories, tagRows] = await Promise.all([
    mainClient.$queryRawUnsafe<Row[]>(`SELECT * FROM CommunityPost ${clause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, ...args, PAGE_SIZE, page * PAGE_SIZE),
    mainClient.$queryRawUnsafe<{ n: number | bigint }[]>(`SELECT COUNT(*) AS n FROM CommunityPost ${clause}`, ...args),
    mainClient.$queryRawUnsafe<{ category: string; n: number | bigint }[]>("SELECT category, COUNT(*) AS n FROM CommunityPost WHERE status = 'published' GROUP BY category ORDER BY n DESC"),
    mainClient.$queryRawUnsafe<{ tags: string }[]>("SELECT tags FROM CommunityPost WHERE status = 'published' AND tags != '' ORDER BY createdAt DESC LIMIT 500"),
  ]);
  // The most used tags, spelled the way people wrote them.
  const tagCounts = new Map<string, number>();
  for (const row of tagRows) for (const tag of row.tags.split(',').filter(Boolean)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const posts = rows.map((row) => toPublic(toPost(row)));
  const spelled = new Map<string, string>();
  for (const post of posts) for (const tag of post.tags) spelled.set(tag.toLowerCase(), tag);
  return {
    posts,
    total: Number(count[0]?.n ?? 0),
    page,
    pages: Math.max(1, Math.ceil(Number(count[0]?.n ?? 0) / PAGE_SIZE)),
    categories: categories.filter((c) => (CATEGORIES as readonly string[]).includes(c.category)).map((c) => ({ name: c.category, count: Number(c.n) })),
    tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([tag, n]) => ({ name: spelled.get(tag) ?? tag, count: n })),
  };
}

export async function getPublic(id: string): Promise<PublicPost | null> {
  if (!/^[a-z0-9]{6,20}$/.test(id)) return null;
  await ensureTable();
  const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM CommunityPost WHERE id = ${id} AND status = 'published'`;
  return rows[0] ? toPublic(toPost(rows[0])) : null;
}

// ---------- a site's own posts ----------

export async function listForSite(site: string): Promise<Post[]> {
  await ensureTable();
  return (await mainClient.$queryRaw<Row[]>`SELECT * FROM CommunityPost WHERE site = ${site} ORDER BY createdAt DESC`).map(toPost);
}

async function getRow(id: string) {
  if (!/^[a-z0-9]{6,20}$/.test(id)) return null;
  await ensureTable();
  const rows = await mainClient.$queryRaw<Row[]>`SELECT * FROM CommunityPost WHERE id = ${id}`;
  return rows[0] ? toPost(rows[0]) : null;
}

export class CommunityError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function createPost(site: Pick<Site, 'slug' | 'name'>, authorUser: string, authorUrl: string, input: PostInput): Promise<Post> {
  await ensureTable();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [[total], [today]] = await Promise.all([
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM CommunityPost WHERE site = ${site.slug}`,
    mainClient.$queryRaw<{ n: number | bigint }[]>`SELECT COUNT(*) AS n FROM CommunityPost WHERE site = ${site.slug} AND createdAt >= ${since}`,
  ]);
  if (Number(total?.n ?? 0) >= MAX_POSTS_PER_SITE) throw new CommunityError(`A site can keep up to ${MAX_POSTS_PER_SITE} posts. Delete old ones first.`);
  if (Number(today?.n ?? 0) >= MAX_NEW_POSTS_PER_DAY) throw new CommunityError(`That’s ${MAX_NEW_POSTS_PER_DAY} posts today already. Please try again tomorrow.`, 429);
  const id = randomBytes(8).toString('hex').slice(0, 12).replace(/^\d/, 'p');
  const now = new Date().toISOString();
  const content = { ...input, tags: uniqueTags(input.tags), authorUrl };
  await mainClient.$executeRaw`INSERT INTO CommunityPost (id, site, siteName, authorUser, status, category, company, role, outcome, level, tags, search, content, createdAt, updatedAt)
    VALUES (${id}, ${site.slug}, ${site.name}, ${authorUser}, ${input.published ? 'published' : 'draft'}, ${input.category}, ${input.company}, ${input.role},
      ${input.outcome}, ${input.level}, ${tagColumn(content.tags)}, ${searchColumn(content)}, ${JSON.stringify(content)}, ${now}, ${now})`;
  return (await getRow(id))!;
}

/** Changes a post of this site. A post the platform owner hid stays hidden. */
export async function updatePost(site: string, id: string, input: PostInput, authorUrl: string): Promise<Post | null> {
  const post = await getRow(id);
  if (!post || post.site !== site) return null;
  const content = { ...input, tags: uniqueTags(input.tags), authorUrl: authorUrl || post.authorUrl };
  const status: PostStatus = post.status === 'hidden' ? 'hidden' : input.published ? 'published' : 'draft';
  await mainClient.$executeRaw`UPDATE CommunityPost SET status = ${status}, category = ${input.category}, company = ${input.company}, role = ${input.role},
    outcome = ${input.outcome}, level = ${input.level}, tags = ${tagColumn(content.tags)}, search = ${searchColumn(content)}, content = ${JSON.stringify(content)},
    updatedAt = ${new Date().toISOString()} WHERE id = ${id}`;
  return getRow(id);
}

export async function deletePost(site: string, id: string): Promise<Post | null> {
  const post = await getRow(id);
  if (!post || post.site !== site) return null;
  await mainClient.$executeRaw`DELETE FROM CommunityPost WHERE id = ${id}`;
  return post;
}

// ---------- the platform owner ----------

/** Every post (any status), newest first, for moderation. Includes who on the site wrote it. */
export async function listAll({ q = '', status = '' }: { q?: string; status?: string } = {}) {
  await ensureTable();
  const where: string[] = [];
  const args: unknown[] = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (q) { where.push("(search LIKE ? ESCAPE '\\' OR siteName LIKE ? ESCAPE '\\' OR authorUser LIKE ? ESCAPE '\\')"); args.push(like(q), like(q), like(q)); }
  const rows = await mainClient.$queryRawUnsafe<Row[]>(`SELECT * FROM CommunityPost ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY createdAt DESC LIMIT 200`, ...args);
  return rows.map((row) => ({ ...toPost(row), authorUser: row.authorUser }));
}

export async function setHidden(id: string, hidden: boolean): Promise<Post | null> {
  const post = await getRow(id);
  if (!post) return null;
  const status: PostStatus = hidden ? 'hidden' : post.published ? 'published' : 'draft';
  await mainClient.$executeRaw`UPDATE CommunityPost SET status = ${status} WHERE id = ${id}`;
  return { ...post, status };
}

export async function removePost(id: string): Promise<Post | null> {
  const post = await getRow(id);
  if (!post) return null;
  await mainClient.$executeRaw`DELETE FROM CommunityPost WHERE id = ${id}`;
  return post;
}

/** Deletes a site's posts (when the site itself is deleted). */
export async function removeSitePosts(site: string) {
  await ensureTable();
  await mainClient.$executeRaw`DELETE FROM CommunityPost WHERE site = ${site}`;
}
