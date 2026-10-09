import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/**
 * Uploaded documents (PDFs) for the site: project PDFs and PDF blocks in Admin → Design.
 *
 * Stored in each site's own database, so nothing extra has to be set up and it stays on the free plans.
 * Vercel limits a request to 4.5 MB, so:
 *   - the browser uploads a file in parts of PART_BYTES (3 MB),
 *   - the server keeps it as BLOCK_BYTES (256 KB) rows in AssetBlock,
 *   - visitors' viewers fetch byte ranges, so only the blocks a page needs are read (and no response is big).
 * Plain SQL like the other newer tables, so it works before and after `prisma generate`.
 */

export const BLOCK_BYTES = 256 * 1024;
export const PART_BYTES = 12 * BLOCK_BYTES; // 3 MB per upload request
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_SITE_BYTES = 200 * 1024 * 1024; // all of a site's documents together
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS Asset (id TEXT PRIMARY KEY, fileName TEXT NOT NULL, mimeType TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'uploading', uploadedBy TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, uploadedAt TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS AssetBlock (assetId TEXT NOT NULL, idx INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (assetId, idx))`,
];
let ready: Promise<unknown> | null = null;
const ensureTables = () => (ready ??= (async () => { for (const sql of TABLES) await prisma.$executeRawUnsafe(sql); })().catch((error) => { ready = null; throw error; }));

export type Asset = { id: string; fileName: string; mimeType: string; size: number; status: 'uploading' | 'ready'; uploadedBy: string; createdAt: string; uploadedAt: string };
type Row = Omit<Asset, 'size'> & { size: number | bigint };
const toAsset = (row: Row): Asset => ({ ...row, size: Number(row.size), status: row.status === 'ready' ? 'ready' : 'uploading' });

import { isAssetId } from './assets-url';
export { assetIdFrom, assetUrl, isAssetId } from './assets-url';

export const safeFileName = (name: string) => (name.replace(/[^\w.\- ()]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'document.pdf');

export async function listAssets(): Promise<Asset[]> {
  await ensureTables();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM Asset WHERE status = 'ready' ORDER BY uploadedAt DESC`;
  return rows.map(toAsset);
}

export async function getAsset(id: string): Promise<Asset | null> {
  if (!isAssetId(id)) return null;
  await ensureTables();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM Asset WHERE id = ${id}`;
  return rows[0] ? toAsset(rows[0]) : null;
}

export async function usedBytes(): Promise<number> {
  await ensureTables();
  const rows = await prisma.$queryRaw<{ total: number | bigint | null }[]>`SELECT SUM(size) AS total FROM Asset`;
  return Number(rows[0]?.total ?? 0);
}

/** Starts an upload. Throws an Error with a message for the user when it isn't allowed. */
export async function createAsset(input: { fileName: string; size: number; mimeType: string; uploadedBy: string }): Promise<Asset> {
  await ensureTables();
  // Uploads that were never finished (closed tab…) are cleaned up after a day.
  const stale = new Date(Date.now() - STALE_UPLOAD_MS).toISOString();
  const old = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM Asset WHERE status = 'uploading' AND createdAt < ${stale}`;
  for (const { id } of old) await deleteAsset(id);

  if (!Number.isInteger(input.size) || input.size <= 0) throw new Error('The file is empty.');
  if (input.size > MAX_FILE_BYTES) throw new Error(`The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Try “Reduce file size” / “Optimize PDF” when exporting it.`);
  if ((await usedBytes()) + input.size > MAX_SITE_BYTES) throw new Error(`Your documents would take more than ${MAX_SITE_BYTES / 1024 / 1024} MB. Delete some you no longer use first.`);
  const asset: Asset = { id: randomUUID(), fileName: safeFileName(input.fileName), mimeType: input.mimeType, size: input.size, status: 'uploading', uploadedBy: input.uploadedBy, createdAt: new Date().toISOString(), uploadedAt: '' };
  await prisma.$executeRaw`INSERT INTO Asset (id, fileName, mimeType, size, status, uploadedBy, createdAt, uploadedAt) VALUES (${asset.id}, ${asset.fileName}, ${asset.mimeType}, ${asset.size}, 'uploading', ${asset.uploadedBy}, ${asset.createdAt}, '')`;
  return asset;
}

export const partCount = (size: number) => Math.ceil(size / PART_BYTES);

/** Stores part `n` (0-based) of an upload. Re-sending a part replaces it, so a failed part can be retried. */
export async function savePart(asset: Asset, n: number, bytes: Uint8Array) {
  const parts = partCount(asset.size);
  if (!Number.isInteger(n) || n < 0 || n >= parts) throw new Error('Unknown part.');
  const expected = n === parts - 1 ? asset.size - n * PART_BYTES : PART_BYTES;
  if (bytes.length !== expected) throw new Error(`Part ${n + 1} should be ${expected} bytes, got ${bytes.length}.`);
  if (n === 0 && !(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new Error('This is not a PDF file.');
  const first = n * (PART_BYTES / BLOCK_BYTES);
  const statements = [];
  for (let offset = 0, i = 0; offset < bytes.length; offset += BLOCK_BYTES, i++) {
    const block = Buffer.from(bytes.subarray(offset, offset + BLOCK_BYTES));
    statements.push(prisma.$executeRaw`INSERT OR REPLACE INTO AssetBlock (assetId, idx, data) VALUES (${asset.id}, ${first + i}, ${block})`);
  }
  await prisma.$transaction(statements);
}

/** Checks every byte arrived and makes the document available. */
export async function completeAsset(asset: Asset): Promise<Asset> {
  const rows = await prisma.$queryRaw<{ total: number | bigint | null; blocks: number | bigint }[]>`SELECT SUM(LENGTH(data)) AS total, COUNT(*) AS blocks FROM AssetBlock WHERE assetId = ${asset.id}`;
  const total = Number(rows[0]?.total ?? 0);
  if (total !== asset.size || Number(rows[0]?.blocks ?? 0) !== Math.ceil(asset.size / BLOCK_BYTES)) throw new Error('Some parts of the file are missing. Please upload it again.');
  const uploadedAt = new Date().toISOString();
  await prisma.$executeRaw`UPDATE Asset SET status = 'ready', uploadedAt = ${uploadedAt} WHERE id = ${asset.id}`;
  return { ...asset, status: 'ready', uploadedAt };
}

export async function deleteAsset(id: string) {
  await ensureTables();
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM AssetBlock WHERE assetId = ${id}`,
    prisma.$executeRaw`DELETE FROM Asset WHERE id = ${id}`,
  ]);
}

/** Bytes start..end (inclusive) of a ready document, read from only the blocks that hold them. */
export async function readRange(asset: Asset, start: number, end: number): Promise<Uint8Array> {
  const firstBlock = Math.floor(start / BLOCK_BYTES);
  const lastBlock = Math.floor(end / BLOCK_BYTES);
  const rows = await prisma.$queryRaw<{ idx: number | bigint; data: Uint8Array }[]>`SELECT idx, data FROM AssetBlock WHERE assetId = ${asset.id} AND idx BETWEEN ${firstBlock} AND ${lastBlock} ORDER BY idx`;
  const out = new Uint8Array(end - start + 1);
  for (const row of rows) {
    const blockStart = Number(row.idx) * BLOCK_BYTES;
    const data = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data as ArrayBuffer);
    const from = Math.max(start, blockStart);
    const to = Math.min(end, blockStart + data.length - 1);
    if (to >= from) out.set(data.subarray(from - blockStart, to - blockStart + 1), from - start);
  }
  return out;
}
