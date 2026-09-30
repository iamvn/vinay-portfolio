import { prisma } from '@/lib/prisma';
import type { DesignData } from './templates';
import type { DesignBlockName } from '@/components/design/config';

/**
 * Designs from Admin → Design, stored in the Setting table:
 *   design.draft      what the editor is working on (autosaved)
 *   design.published  what visitors see; absent = the classic built-in homepage
 *   design.history    the last few published versions, newest first (for "restore")
 */
const KEYS = { draft: 'design.draft', published: 'design.published', history: 'design.history' } as const;
const HISTORY_SIZE = 5;
const MAX_BYTES = 400_000;
const MAX_BLOCKS = 400;
const MAX_DEPTH = 6;

/** Block types a design may contain, and which of their props hold nested blocks. */
export const BLOCK_TYPES = [
  'ClassicShell', 'ClassicHero', 'ClassicAbout', 'ClassicSkills', 'ClassicProjects', 'ClassicExperience', 'ClassicContact', 'ClassicFooter',
  'NavBar', 'Hero', 'HiringSnapshot', 'Stats', 'Skills', 'Projects', 'Experience', 'Contact', 'SocialLinks', 'ResumeButton', 'Footer',
  'Section', 'Columns', 'Card', 'Spacer', 'Divider', 'Heading', 'Text', 'Button', 'Image', 'List',
] as const;
// Compile-time check: the allow-list above must name every block in the editor config, and nothing else.
type Missing = Exclude<DesignBlockName, (typeof BLOCK_TYPES)[number]> | Exclude<(typeof BLOCK_TYPES)[number], DesignBlockName>;
export const BLOCK_LIST_COMPLETE: [Missing] extends [never] ? true : Missing = true;

const SLOT_FIELDS: Record<string, string[]> = { ClassicShell: ['content'], Section: ['content'], Card: ['content'], Columns: ['column1', 'column2', 'column3', 'column4'] };

export type StoredDesign = { data: DesignData; savedAt: string; savedBy: string; template?: string };

async function read(key: string): Promise<unknown> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}
const write = (key: string, value: unknown) =>
  prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });

export const getDraft = async () => (await read(KEYS.draft)) as StoredDesign | null;
export const getPublished = async () => (await read(KEYS.published).catch(() => null)) as StoredDesign | null;
export async function getHistory() {
  const value = await read(KEYS.history);
  return Array.isArray(value) ? (value as StoredDesign[]) : [];
}

export async function saveDraft(data: DesignData, by: string, template?: string) {
  const draft: StoredDesign = { data, savedAt: new Date().toISOString(), savedBy: by, ...(template ? { template } : {}) };
  await write(KEYS.draft, draft);
  return draft;
}

/** Makes `data` live: it becomes the published design and the draft; the previous live design goes to history. */
export async function publish(data: DesignData, by: string) {
  const [previous, history] = await Promise.all([getPublished(), getHistory()]);
  const published: StoredDesign = { data, savedAt: new Date().toISOString(), savedBy: by };
  const upsert = (key: string, value: unknown) =>
    prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  await prisma.$transaction([
    upsert(KEYS.published, published),
    upsert(KEYS.draft, published),
    ...(previous ? [upsert(KEYS.history, [previous, ...history].slice(0, HISTORY_SIZE))] : []),
  ]);
  return published;
}

/** Throws away draft changes: the draft goes back to what's live (or is removed when the built-in homepage is live). */
export async function discardDraft() {
  const published = await getPublished();
  if (published) await write(KEYS.draft, published);
  else await prisma.setting.deleteMany({ where: { key: KEYS.draft } });
  return published;
}

/** Back to the classic built-in homepage. The design that was live goes to history. */
export async function unpublish() {
  const [previous, history] = await Promise.all([getPublished(), getHistory()]);
  if (!previous) return;
  await write(KEYS.history, [previous, ...history].slice(0, HISTORY_SIZE));
  await prisma.setting.delete({ where: { key: KEYS.published } });
}

// ---------- validation ----------

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks a design from the editor before it is stored: known block types only, sane size and nesting,
 * string ids. Returns the problem as text, or null when the design is fine.
 * (Links and image URLs are also filtered when a design is rendered.)
 */
export function designProblem(data: unknown): string | null {
  if (!isObject(data)) return 'The design must be an object.';
  if (JSON.stringify(data).length > MAX_BYTES) return 'The design is too large (over 400 KB).';
  if (!Array.isArray(data.content)) return 'The design has no content list.';
  if (data.root !== undefined && !isObject(data.root)) return 'The design root is invalid.';
  if (isObject(data.root) && data.root.props !== undefined && !isObject(data.root.props)) return 'The design settings are invalid.';
  if (data.zones !== undefined && !isObject(data.zones)) return 'The design zones are invalid.';

  let count = 0;
  const ids = new Set<string>();
  const check = (items: unknown, depth: number): string | null => {
    if (!Array.isArray(items)) return 'A block list is invalid.';
    if (depth > MAX_DEPTH) return 'Blocks are nested too deeply.';
    for (const item of items) {
      if (!isObject(item) || typeof item.type !== 'string' || !isObject(item.props)) return 'A block is invalid.';
      if (!(BLOCK_TYPES as readonly string[]).includes(item.type)) return `Unknown block type “${item.type}”.`;
      const id = item.props.id;
      if (typeof id !== 'string' || !id || id.length > 100) return `A ${item.type} block has no valid id.`;
      if (ids.has(id)) return `Two blocks share the id “${id}”.`;
      ids.add(id);
      if (++count > MAX_BLOCKS) return `Too many blocks (max ${MAX_BLOCKS}).`;
      for (const field of SLOT_FIELDS[item.type] ?? []) {
        const nested = item.props[field];
        if (nested === undefined) continue;
        const problem = check(nested, depth + 1);
        if (problem) return problem;
      }
    }
    return null;
  };
  const problem = check(data.content, 0);
  if (problem) return problem;
  for (const zone of Object.values((data.zones as Record<string, unknown>) ?? {})) {
    const zoneProblem = check(zone, 1);
    if (zoneProblem) return zoneProblem;
  }
  return null;
}
