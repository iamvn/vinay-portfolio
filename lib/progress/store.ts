import { prisma } from '@/lib/prisma';
import { boardSchema, emptyBoard, localDay, newId, type Board } from './types';

/**
 * Each user's Progress tracker lives in this site's Setting table: one row for the board (JSON) and one row
 * per vision-board picture (a small, already-resized data URL). Private: only that signed-in user reads it.
 */
const boardKey = (userId: number) => `progress.board.${userId}`;
const imagePrefix = (userId: number) => `progress.img.${userId}.`;
const imageKey = (userId: number, id: string) => `${imagePrefix(userId)}${id}`;

export const MAX_BOARD_BYTES = 400_000;
export const MAX_IMAGE_BYTES = 900_000; // a data URL; the browser resizes pictures to ~1200px JPEG first
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function getBoard(userId: number): Promise<Board> {
  const row = await prisma.setting.findUnique({ where: { key: boardKey(userId) } }).catch(() => null);
  if (!row) return emptyBoard();
  try {
    const parsed = boardSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : emptyBoard();
  } catch {
    return emptyBoard();
  }
}

/** Saves the whole board; drops ticks older than 120 days and pictures no longer on any vision board. */
export async function saveBoard(userId: number, board: Board): Promise<Board> {
  const cutoff = localDay(new Date(Date.now() - 120 * 86_400_000));
  const daily = Object.fromEntries(Object.entries(board.daily).filter(([day]) => day >= cutoff));
  const taskIds = new Set(board.tasks.map((t) => t.id));
  const trackIds = new Set(board.tracks.map((t) => t.id));
  const clean: Board = {
    ...board,
    daily: Object.fromEntries(Object.entries(daily).map(([day, ids]) => [day, ids.filter((tid) => taskIds.has(tid))])),
    tasks: board.tasks.map((t) => (t.trackId && !trackIds.has(t.trackId) ? { ...t, trackId: '' } : t)),
    updatedAt: new Date().toISOString(),
  };
  const value = JSON.stringify(clean);
  if (value.length > MAX_BOARD_BYTES) throw new Error('Your plan is too big to save. Remove some notes or old tasks.');
  await prisma.setting.upsert({ where: { key: boardKey(userId) }, create: { key: boardKey(userId), value }, update: { value } });
  // Pictures removed from every year's vision board are deleted.
  const keep = new Set(Object.values(clean.vision).flatMap((y) => y.images.map((i) => imageKey(userId, i.id))));
  const stored = await prisma.setting.findMany({ where: { key: { startsWith: imagePrefix(userId) } }, select: { key: true } });
  const stale = stored.map((r) => r.key).filter((k) => !keep.has(k));
  if (stale.length) await prisma.setting.deleteMany({ where: { key: { in: stale } } });
  return clean;
}

export async function addImage(userId: number, dataUrl: string) {
  if (!IMAGE_DATA_URL.test(dataUrl)) throw new Error('Upload a JPEG, PNG or WebP picture.');
  if (dataUrl.length > MAX_IMAGE_BYTES) throw new Error('That picture is too large. Try a smaller one.');
  const count = await prisma.setting.count({ where: { key: { startsWith: imagePrefix(userId) } } });
  if (count >= 60) throw new Error('You have a lot of pictures already. Remove some first.');
  const id = newId();
  await prisma.setting.create({ data: { key: imageKey(userId, id), value: dataUrl } });
  return id;
}

export async function getImage(userId: number, id: string) {
  if (!/^[a-z0-9]{6,24}$/.test(id)) return null;
  const row = await prisma.setting.findUnique({ where: { key: imageKey(userId, id) } });
  const match = row?.value.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  return match ? { type: match[1], bytes: Buffer.from(match[2], 'base64') } : null;
}
