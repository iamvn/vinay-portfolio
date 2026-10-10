import { prisma } from '@/lib/prisma';
import type { DesignData } from './templates';
import type { TemplateKind } from './ai-template';

/**
 * Templates this site made itself (Admin → Design → Create a template with AI). Stored in the site's
 * Setting table: a small index (`design.customTemplates`) plus one row per template's design
 * (`design.customTemplate.<id>`), so listing them never loads every design.
 */

/** The colors a template sets on top of its theme preset (for its thumbnail). */
export type Palette = Partial<Record<'bg' | 'surface' | 'surface2' | 'text' | 'muted' | 'line' | 'accent' | 'accent2', string>>;
export function paletteOf(data: DesignData): Palette {
  const colors = (data.root as { props?: { colors?: Record<string, unknown> } } | undefined)?.props?.colors ?? {};
  const keys = ['bg', 'surface', 'surface2', 'text', 'muted', 'line', 'accent', 'accent2'] as const;
  return Object.fromEntries(keys.flatMap((k) => (typeof colors[k] === 'string' && /^#[0-9a-f]{3,8}$/i.test(colors[k] as string) ? [[k, colors[k]]] : []))) as Palette;
}

export type CustomTemplate = {
  id: string; name: string; description: string; kind: TemplateKind; theme: string; blocks: number; palette?: Palette;
  createdAt: string; createdBy: string;
  /** Owner templates (lib/design/owner-templates.ts): which one, and its version. */
  source?: string; version?: number;
};

export const MAX_CUSTOM_TEMPLATES = 24;
const INDEX = 'design.customTemplates';
const dataKey = (id: string) => `design.customTemplate.${id}`;
export const isCustomId = (id: string) => /^custom-[a-z0-9]{6,40}$/.test(id);

async function readJson(key: string): Promise<unknown> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}
const writeJson = (key: string, value: unknown) =>
  prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });

async function index(): Promise<CustomTemplate[]> {
  const list = await readJson(INDEX);
  return Array.isArray(list) ? (list as CustomTemplate[]).filter((t) => t && isCustomId(t.id)) : [];
}

export const listCustomTemplates = async (kind?: TemplateKind) => (await index()).filter((t) => !kind || t.kind === kind);

export async function getCustomTemplate(id: string): Promise<(CustomTemplate & { data: DesignData }) | null> {
  if (!isCustomId(id)) return null;
  const meta = (await index()).find((t) => t.id === id);
  const data = meta && (await readJson(dataKey(id)));
  return meta && data ? { ...meta, data: data as DesignData } : null;
}

export async function createCustomTemplate(input: { name: string; description: string; kind: TemplateKind; data: DesignData; blocks: number; by: string; source?: string; version?: number }) {
  const list = await index();
  if (list.length >= MAX_CUSTOM_TEMPLATES) throw new LimitError(`You can keep up to ${MAX_CUSTOM_TEMPLATES} of your own templates. Delete one first.`);
  const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const theme = String((input.data.root as { props?: { theme?: unknown } } | undefined)?.props?.theme ?? 'clean');
  const meta: CustomTemplate = {
    id, name: input.name, description: input.description, kind: input.kind, theme, blocks: input.blocks, palette: paletteOf(input.data),
    createdAt: new Date().toISOString(), createdBy: input.by,
    ...(input.source ? { source: input.source, version: input.version ?? 1 } : {}),
  };
  await writeJson(dataKey(id), input.data);
  await writeJson(INDEX, [meta, ...list]);
  return meta;
}

/** Renames a template (and changes its description). */
export async function updateCustomTemplate(id: string, change: { name?: string; description?: string }) {
  const list = await index();
  const current = list.find((t) => t.id === id);
  if (!current) return null;
  const next = { ...current, ...change };
  await writeJson(INDEX, list.map((t) => (t.id === id ? next : t)));
  return next;
}

/** Replaces a template's design (an owner template moved to a newer version); its name stays as the owner set it. */
export async function replaceCustomTemplateDesign(id: string, input: { data: DesignData; blocks: number; description: string; source: string; version: number }) {
  const list = await index();
  const current = list.find((t) => t.id === id);
  if (!current) return null;
  const theme = String((input.data.root as { props?: { theme?: unknown } } | undefined)?.props?.theme ?? 'clean');
  const next: CustomTemplate = { ...current, blocks: input.blocks, description: input.description, theme, palette: paletteOf(input.data), source: input.source, version: input.version };
  await writeJson(dataKey(id), input.data);
  await writeJson(INDEX, list.map((t) => (t.id === id ? next : t)));
  return next;
}

export const listAllCustomTemplates = () => index();

export async function deleteCustomTemplate(id: string) {
  const list = await index();
  if (!list.some((t) => t.id === id)) return false;
  await writeJson(INDEX, list.filter((t) => t.id !== id));
  await prisma.setting.deleteMany({ where: { key: dataKey(id) } });
  return true;
}

export class LimitError extends Error {}
