import { randomBytes } from 'node:crypto';
import { mainClient } from '@/lib/db-client';
import { announcementSchema, isLive, mergeGuide, type Announcement, type GuideEntry, type GuideTab } from './content';
import type { z } from 'zod';

/**
 * The Guide's text and the announcements, kept in the MAIN site's database (Setting table), so the platform
 * owner writes them once and every site's admin shows them.
 */
const GUIDE_KEY = 'platform.guide';
const ANNOUNCEMENTS_KEY = 'platform.announcements';
export const MAX_ANNOUNCEMENTS = 30;

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await mainClient.setting.findUnique({ where: { key } }).catch(() => null);
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}
async function write(key: string, value: unknown) {
  const text = JSON.stringify(value);
  await mainClient.setting.upsert({ where: { key }, create: { key, value: text }, update: { value: text } });
}

type StoredGuide = { intro?: string; tabs?: Partial<Record<GuideTab, GuideEntry>> };

export async function getGuide() {
  return mergeGuide(await read<StoredGuide | null>(GUIDE_KEY, null));
}

/** Saves the owner's changes: a tab set to null goes back to its default text. */
export async function updateGuide(update: { intro?: string; tabs?: Partial<Record<GuideTab, GuideEntry | null>> }) {
  const stored = await read<StoredGuide>(GUIDE_KEY, {});
  const tabs = { ...(stored.tabs ?? {}) };
  for (const [tab, entry] of Object.entries(update.tabs ?? {}) as [GuideTab, GuideEntry | null][]) {
    if (entry) tabs[tab] = entry; else delete tabs[tab];
  }
  await write(GUIDE_KEY, { intro: update.intro ?? stored.intro ?? '', tabs });
  return getGuide();
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const list = await read<Announcement[]>(ANNOUNCEMENTS_KEY, []);
  return Array.isArray(list) ? list.filter((a) => a && typeof a.id === 'string').sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
}

/** What every admin sees now, newest first. */
export const liveAnnouncements = async () => (await listAnnouncements()).filter((a) => isLive(a));

export async function addAnnouncement(input: z.output<typeof announcementSchema>, by: string): Promise<Announcement> {
  const list = await listAnnouncements();
  const item: Announcement = { ...input, id: randomBytes(6).toString('hex'), createdAt: new Date().toISOString(), by };
  // Oldest ones drop off once the list is full.
  await write(ANNOUNCEMENTS_KEY, [item, ...list].slice(0, MAX_ANNOUNCEMENTS));
  return item;
}

export async function updateAnnouncement(id: string, changes: Partial<z.output<typeof announcementSchema>>): Promise<Announcement | null> {
  const list = await listAnnouncements();
  const index = list.findIndex((a) => a.id === id);
  if (index === -1) return null;
  list[index] = { ...list[index], ...changes };
  await write(ANNOUNCEMENTS_KEY, list);
  return list[index];
}

export async function removeAnnouncement(id: string): Promise<boolean> {
  const list = await listAnnouncements();
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  await write(ANNOUNCEMENTS_KEY, next);
  return true;
}
