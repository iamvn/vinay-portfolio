import { prisma } from '@/lib/prisma';
import { cleanHidden, type SectionKey } from './sections';

/** Which homepage sections are switched off (lib/sections.ts). One setting in the site's own database. */
const KEY = 'sections';

export async function hiddenSections(): Promise<SectionKey[]> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  try { return cleanHidden(JSON.parse(row?.value ?? '{}').hidden); } catch { return []; }
}

export async function setHiddenSections(hidden: SectionKey[]) {
  const value = JSON.stringify({ hidden: cleanHidden(hidden) });
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  return cleanHidden(hidden);
}
