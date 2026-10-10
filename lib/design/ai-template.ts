import { designConfig } from '@/components/design/config';
import { STYLE_KEYS, migrateDesign, styleFields } from '@/components/design/style-panel';
import { DEFAULT_ROOT } from './theme';
import { BLOCK_TYPES, PROJECT_ONLY, designProblem, type DesignScope } from './store';
import type { DesignData } from './templates';

/**
 * "Create a template with AI" (Admin → Design). Nothing here calls an AI: we write a prompt that explains
 * exactly what a design may contain (every block, its settings and allowed values, the rules), the person
 * pastes it into any AI chat, then pastes the JSON answer back. `importDesign` cleans that answer up
 * (fixes ids, drops unknown settings, swaps invalid values for defaults) and checks it like any saved design.
 * Server-only: reads the editor config.
 */

export type TemplateKind = 'home' | 'project';
export const kindOf = (scope: DesignScope): TemplateKind => (scope === 'home' ? 'home' : 'project');

type Option = { label: string; value: unknown };
type Field = {
  type: string; label?: string; placeholder?: string; options?: Option[]; min?: number; max?: number;
  objectFields?: Record<string, Field>; arrayFields?: Record<string, Field>; defaultItemProps?: Record<string, unknown>;
  ai?: 'color' | 'sides';
};
type Component = { label?: string; fields?: Record<string, Field>; ownFields?: Record<string, Field>; ownDefaults?: Record<string, unknown>; defaultProps?: Record<string, unknown> };

const COMPONENTS = designConfig.components as unknown as Record<string, Component>;
const ROOT_FIELDS = (designConfig.root as { fields: Record<string, Field> }).fields;
const isPlain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const clone = <T,>(v: T): T => (v === undefined ? v : structuredClone(v));
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Blocks that also take the shared Design settings (spacing, size, colors, border, item, more). */
const styled = (c: Component) => c.fields?.border === (styleFields.border as unknown);
const slotsOf = (c: Component) => Object.entries(c.fields ?? {}).filter(([, f]) => f.type === 'slot').map(([k]) => k);
const QUICK = (name: string) => name.startsWith('Quick');
/** A block's own setting with the same name as a shared Design group (e.g. Heading.size = text size). */
const ownClash = (c: Component, key: string): Field | undefined => {
  const own = c.ownFields?.[key];
  return own && styled(c) && (STYLE_KEYS as readonly string[]).includes(key) ? own : undefined;
};
const allowed = (kind: TemplateKind) => (BLOCK_TYPES as readonly string[]).filter((name) => kind === 'project' || !(PROJECT_ONLY as readonly string[]).includes(name));

// ---------------------------------------------------------------- the catalog

function optionText(o: Option) {
  const value = JSON.stringify(o.value);
  const label = String(o.label ?? '').replace(/[✎🎨]\s*/gu, '').trim();
  return label && label.toLowerCase() !== String(o.value).toLowerCase() ? `${value} (${label})` : value;
}

function describe(field: Field, indent: string): string {
  switch (field.type) {
    case 'slot': return 'SLOT: an array of blocks';
    case 'text': case 'textarea': return `string${field.placeholder ? ` (e.g. ${field.placeholder})` : ''}`;
    case 'number': return `number${field.min !== undefined || field.max !== undefined ? ` ${field.min ?? ''}–${field.max ?? ''}` : ''}`;
    case 'select': case 'radio': return field.options?.length ? `one of ${field.options.map(optionText).join(' | ')}` : 'string';
    case 'custom':
      if (field.ai === 'color') return 'color: "" (= theme color) or hex like "#1e293b"';
      if (field.ai === 'sides') return 'object { "top"?, "right"?, "bottom"?, "left"? }: pixels as digit strings, e.g. { "top": "48", "bottom": "48" }; {} = default';
      return 'leave out (set in the editor)';
    case 'object': return `object {\n${lines(field.objectFields ?? {}, `${indent}    `, undefined)}\n${indent}  }`;
    case 'array': return `array of objects {\n${lines(field.arrayFields ?? {}, `${indent}    `, undefined)}\n${indent}  }`;
    default: return 'value';
  }
}

function lines(fields: Record<string, Field>, indent: string, defaults: Record<string, unknown> | undefined, skip: readonly string[] = []) {
  return Object.entries(fields).filter(([key]) => !skip.includes(key)).map(([key, field]) => {
    const label = field.label ? ` — ${field.label.replace(/\s+/g, ' ')}` : '';
    let def = '';
    if (defaults && field.type !== 'slot' && field.type !== 'object' && defaults[key] !== undefined) {
      const json = JSON.stringify(defaults[key]);
      if (json.length <= 70) def = ` · default ${json}`;
    }
    return `${indent}- ${key}: ${describe(field, indent)}${def}${label}`;
  }).join('\n');
}

/** The block's own default for a clashing setting (the merged defaults hold the Design group's). */
const ownDefault = (c: Component, key: string) => c.ownDefaults?.[key];

function blockSection(name: string): string {
  const c = COMPONENTS[name];
  if (!c) return '';
  const slots = slotsOf(c);
  const tags = [
    (PROJECT_ONLY as readonly string[]).includes(name) ? 'project pages only' : '',
    slots.length ? `holds blocks in: ${slots.join(', ')}` : '',
    styled(c) ? '+ shared design settings' : '',
  ].filter(Boolean);
  // Its own settings (including one named like a Design group, which then means the block's own setting).
  const ownFields = styled(c) ? (c.ownFields ?? {}) : (c.fields ?? {});
  const clashes = styled(c) ? STYLE_KEYS.filter((k) => k in ownFields) : [];
  const own = lines(ownFields, '  ', { ...c.defaultProps, ...Object.fromEntries(clashes.map((k) => [k, ownDefault(c, k)])) }, ['_view']);
  return `### ${name} — ${c.label ?? name}${tags.length ? ` [${tags.join('; ')}]` : ''}\n${own || '  (no settings: shows live content)'}`;
}

/** Every block a page of this kind may use, grouped like the editor's sidebar. */
function catalog(kind: TemplateKind) {
  const ok = new Set(allowed(kind));
  const categories = Object.entries(designConfig.categories ?? {}) as [string, { title?: string; components?: string[] }][];
  const ordered = kind === 'project' ? [...categories.filter(([k]) => k === 'project'), ...categories.filter(([k]) => k !== 'project')] : categories.filter(([k]) => k !== 'project');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [key, category] of ordered) {
    if (key === 'quick') continue; // ready-made Box layouts: the AI should build with Box instead
    const names = (category.components ?? []).filter((n) => ok.has(n) && !seen.has(n));
    if (!names.length) continue;
    names.forEach((n) => seen.add(n));
    out.push(`## ${category.title ?? key}\n\n${names.map(blockSection).join('\n\n')}`);
  }
  const rest = [...ok].filter((n) => !seen.has(n) && !QUICK(n));
  if (rest.length) out.push(`## Other blocks\n\n${rest.map(blockSection).join('\n\n')}`);
  return out.join('\n\n');
}

const EXAMPLES: Record<TemplateKind, unknown> = {
  home: {
    root: { props: { theme: 'paper', headingFont: 'serif', bodyFont: 'system', radius: 'large', width: 'normal' } },
    content: [
      { type: 'NavBar', props: { id: 'nav' } },
      { type: 'Hero', props: { id: 'hero', variant: 'centered' } },
      { type: 'Section', props: { id: 'about', background: 'surface', padding: 'lg', anchor: 'about', content: [
        { type: 'Heading', props: { id: 'about-title', source: 'custom', text: 'What I do', level: 'h2', align: 'center' } },
        { type: 'Text', props: { id: 'about-text', source: 'summary', align: 'center', maxWidth: 'prose' } },
      ] } },
      { type: 'Projects', props: { id: 'projects', layout: 'grid', columns: '3' } },
      { type: 'Contact', props: { id: 'contact' } },
      { type: 'Footer', props: { id: 'footer' } },
    ],
  },
  project: {
    root: { props: { theme: 'clean', headingFont: 'system', radius: 'medium', width: 'normal' } },
    content: [
      { type: 'ProjectBar', props: { id: 'bar' } },
      { type: 'Section', props: { id: 'intro', padding: 'lg', content: [
        { type: 'ProjectTitle', props: { id: 'title', size: 'xl' } },
        { type: 'ProjectSummary', props: { id: 'summary' } },
        { type: 'ProjectLinks', props: { id: 'links' } },
      ] } },
      { type: 'ProjectCover', props: { id: 'cover' } },
      { type: 'ProjectStory', props: { id: 'story' } },
      { type: 'ProjectNav', props: { id: 'next' } },
    ],
  },
};

/**
 * Everything the AI needs except the person's request and the current design (the admin adds those as
 * they type). Kept in one place so the rules and the importer below agree.
 */
export function promptGuide(kind: TemplateKind): string {
  const page = kind === 'home'
    ? 'the HOMEPAGE of a personal portfolio site'
    : 'the PROJECT PAGE layout of a portfolio site. One design is used for every project: blocks named Project… show the project being viewed (its title, cover, story, links, PDF), so never type a project’s details yourself';
  return [
    `# Output format (strict)

Reply with ONE JSON object and nothing else: no explanation, no markdown code fences, no comments, no trailing commas.
The object is a page for the Puck page builder (https://puckeditor.com), shaped exactly like this:

{
  "root": { "props": { …theme settings… } },
  "content": [ { "type": "BlockName", "props": { "id": "unique-id", …settings… } } ]
}`,
    `# Rules

1. Only use the block types listed under "Blocks" below, spelled exactly. Anything else is removed.
2. Every block has "type" and "props"; "props.id" is required and must be unique across the WHOLE page (letters, digits and dashes, e.g. "hero", "about-title"). Settings go inside "props", never next to "type".
3. Blocks go inside other blocks only through that block's SLOT settings (an array of blocks), e.g. Section.content, Columns.column1–column4, Flex.items, Grid.items, Box.content, Card.content, Hero.extra. Nothing else can hold blocks. Do not use "zones".
4. Limits: at most 400 blocks in total, nested at most 12 levels deep, under 400 KB of JSON. A good page usually has 10–60 blocks.
5. For "one of" settings use one of the listed values exactly, with the same type (true/false are booleans, "2" is a string). Numbers must be within the range shown.
6. Leave out any setting you don't need: it gets the default shown. Objects may be partial (only the keys you change).
7. Colors: hex only, like "#0f172a", or "" for the theme color. Prefer the theme settings and tones (accent, surface…) over custom colors.
8. Images and links: only https:// URLs, site paths like /resume or #section anchors, or mailto:. Leave image URLs empty ("") rather than inventing them; never use data: or javascript: URLs.
9. Text is plain text only. No HTML, CSS, class names, scripts or emoji-heavy decoration.
10. Themed requests ("Netflix style", "cricket scoreboard", "retro newspaper"…): capture the mood with colors, fonts, layout and your own wording. Never use another brand's logo, name or trademarked slogans in the page text.
11. The person’s real details (name, role, summary, projects, experience, skills, contact links, resume) are filled in live by the site. Use the live blocks (Hero, Projects, Experience, Skills, Contact, SocialLinks, ResumeButton…) or a Heading/Text/Image "source" binding to show them. Never invent names, employers, numbers or testimonials; short generic labels like "Selected work" are fine.
12. Build custom layouts with Section, Columns, Flex, Grid, Box and Card. Make it look good on phones too (e.g. Columns and Flex stack on mobile, Grid has columnsMobile).
13. Blocks marked "+ shared design settings" also accept the settings under "Shared design settings" (spacing, size, colors, border, item, more). Use them sparingly. When a block lists its own setting with one of those names (e.g. Heading "size"), use the block's own meaning.`,
    `# Page

You are designing ${page}.`,
    `# Theme settings (root.props)

${lines(ROOT_FIELDS, '', DEFAULT_ROOT as unknown as Record<string, unknown>)}`,
    `# Blocks\n\n${catalog(kind)}`,
    `# Shared design settings (for blocks marked "+ shared design settings")

${lines(styleFields as unknown as Record<string, Field>, '', undefined)}`,
    `# A small valid example (for the shape only; design your own)

${JSON.stringify(EXAMPLES[kind])}`,
  ].join('\n\n');
}

/**
 * A design written for the prompt: settings that equal their defaults are left out (the importer fills
 * them back in), so the AI sees what is actually set and the prompt stays short.
 */
export function compactDesign(input: DesignData): unknown {
  const data = migrateDesign(input) as { root?: { props?: Record<string, unknown> }; content?: unknown[]; zones?: Record<string, unknown[]> };
  const strip = (value: unknown, def: unknown): unknown => {
    if (sameValue(value, def)) return undefined;
    if (isPlain(value) && isPlain(def)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) { const s = strip(v, def[k]); if (s !== undefined) out[k] = s; }
      return Object.keys(out).length ? out : undefined;
    }
    return value;
  };
  const blocks = (items: unknown): unknown[] => (Array.isArray(items) ? items : []).map((item) => {
    if (!isPlain(item) || typeof item.type !== 'string' || !isPlain(item.props)) return item;
    const c = COMPONENTS[item.type] ?? {};
    const slots = new Set(slotsOf(c));
    const props: Record<string, unknown> = { id: item.props.id };
    for (const [k, v] of Object.entries(item.props)) {
      if (k === 'id' || k === '_view') continue;
      if (slots.has(k)) { props[k] = blocks(v); continue; }
      const s = strip(v, c.defaultProps?.[k]);
      if (s !== undefined) props[k] = s;
    }
    return { type: item.type, props };
  });
  const out: Record<string, unknown> = {
    root: { props: (strip(data.root?.props ?? {}, DEFAULT_ROOT) as Record<string, unknown> | undefined) ?? {} },
    content: blocks(data.content),
  };
  if (data.zones && Object.keys(data.zones).length) out.zones = Object.fromEntries(Object.entries(data.zones).map(([k, v]) => [k, blocks(v)]));
  return out;
}

// ---------------------------------------------------------------- importing the answer

/** Finds the JSON object in an AI reply (which may wrap it in a code fence or a sentence). */
export function parseAiJson(text: string): { value: unknown; problem?: never } | { value?: never; problem: string } {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return { problem: 'No JSON object found. Paste the AI’s whole answer: it should start with { and end with }.' };
  try {
    return { value: JSON.parse(t.slice(start, end + 1)) };
  } catch (error) {
    return { problem: `That isn’t valid JSON (${(error as Error).message.replace(/^JSON\.parse: /, '')}). Ask the AI to “reply with valid JSON only”, or check that you copied the whole answer.` };
  }
}

type Fixes = { notes: string[]; add: (note: string) => void };
const fixes = (): Fixes => {
  const notes: string[] = [];
  return { notes, add: (note) => { if (notes.length < 200) notes.push(note); } };
};

function cleanValue(field: Field, value: unknown, def: unknown, path: string, f: Fixes): unknown {
  if (value === undefined || value === null) return clone(def);
  switch (field.type) {
    case 'select': case 'radio': {
      const values = (field.options ?? []).map((o) => o.value);
      if (!values.length) return typeof value === 'string' ? value.slice(0, 200) : clone(def);
      if (values.some((v) => v === value)) return value;
      const loose = values.find((v) => String(v).toLowerCase() === String(value).trim().toLowerCase());
      if (loose !== undefined) return loose;
      f.add(`${path}: ${JSON.stringify(value)} isn’t an option, used ${JSON.stringify(def)}`);
      return clone(def);
    }
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) { f.add(`${path}: not a number, used ${JSON.stringify(def)}`); return clone(def); }
      return Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, n));
    }
    case 'text': case 'textarea':
      if (typeof value === 'string') return value.slice(0, 5000);
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      f.add(`${path}: not text, used the default`);
      return clone(def);
    case 'object': {
      if (!isPlain(value)) { f.add(`${path}: expected an object, used the default`); return clone(def); }
      const base = isPlain(def) ? def : {};
      const out: Record<string, unknown> = {};
      for (const [k, sub] of Object.entries(field.objectFields ?? {})) {
        const v = cleanValue(sub, value[k], base[k], `${path}.${k}`, f);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    case 'array': {
      if (!Array.isArray(value)) { f.add(`${path}: expected a list, used the default`); return clone(def); }
      return value.filter(isPlain).slice(0, 100).map((item, i) => {
        const out: Record<string, unknown> = {};
        for (const [k, sub] of Object.entries(field.arrayFields ?? {})) {
          const v = cleanValue(sub, item[k], field.defaultItemProps?.[k], `${path}[${i}].${k}`, f);
          if (v !== undefined) out[k] = v;
        }
        return out;
      });
    }
    case 'custom':
      if (field.ai === 'color') {
        if (value === '' || (typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()))) return String(value).trim();
        f.add(`${path}: ${JSON.stringify(value)} isn’t a hex color, used the theme color`);
        return clone(def) ?? '';
      }
      if (field.ai === 'sides') {
        if (!isPlain(value)) { f.add(`${path}: expected { top, right, bottom, left }, used the default`); return clone(def) ?? {}; }
        const out: Record<string, string> = {};
        for (const side of ['top', 'right', 'bottom', 'left']) {
          const digits = String(value[side] ?? '').replace(/px$/i, '').trim();
          if (/^\d{1,3}$/.test(digits)) out[side] = String(Math.min(400, Number(digits)));
        }
        return out;
      }
      return typeof value === typeof def ? value : clone(def);
    default:
      return value;
  }
}

export type ImportResult =
  | { data: DesignData; blocks: number; fixes: string[]; problem?: never }
  | { problem: string; data?: never; blocks?: never; fixes?: never };

/**
 * Turns the AI's answer into a design this site can use, or explains what's wrong. Lenient about small
 * mistakes (missing or repeated ids, unknown settings, values that aren't options), strict about the rest.
 */
export function importDesign(input: unknown, kind: TemplateKind): ImportResult {
  let value = input;
  if (Array.isArray(value)) value = { content: value };
  if (isPlain(value) && !Array.isArray(value.content) && isPlain(value.data)) value = value.data;
  if (!isPlain(value) || !Array.isArray(value.content)) return { problem: 'Expected an object like { "root": { "props": {…} }, "content": [ …blocks… ] }.' };

  const f = fixes();
  const ok = new Set(allowed(kind));
  const ids = new Set<string>();
  const dropped = new Map<string, number>();
  let blocks = 0;
  const uniqueId = (type: string, wanted: unknown) => {
    let id = typeof wanted === 'string' ? wanted.trim().slice(0, 100) : '';
    if (!id || ids.has(id)) {
      const base = (id || type).replace(/[^\w-]+/g, '-').slice(0, 80) || 'block';
      let n = 2;
      while (ids.has(`${base}-${n}`)) n++;
      if (id) f.add(`Two blocks used the id “${id}”: renamed one to “${base}-${n}”`);
      id = `${base}-${n}`;
    }
    ids.add(id);
    return id;
  };

  const walk = (items: unknown, depth: number): unknown[] => {
    if (!Array.isArray(items)) return [];
    const out: unknown[] = [];
    for (const raw of items) {
      if (!isPlain(raw) || typeof raw.type !== 'string') { f.add('Removed an item that wasn’t a block'); continue; }
      const type = raw.type;
      if (!ok.has(type)) { dropped.set(type, (dropped.get(type) ?? 0) + 1); continue; }
      // Settings next to "type" instead of inside "props": accept them.
      const { type: _type, props: rawProps, ...loose } = raw;
      void _type;
      const given: Record<string, unknown> = isPlain(rawProps) ? rawProps : loose;
      const c = COMPONENTS[type];
      const defaults = c.defaultProps ?? {};
      const props: Record<string, unknown> = { id: uniqueId(type, given.id) };
      blocks++;
      const unknown: string[] = [];
      for (const key of Object.keys(given)) if (key !== 'id' && !(c.fields && key in c.fields)) unknown.push(key);
      if (unknown.length) f.add(`${type} “${props.id}”: ignored unknown setting${unknown.length > 1 ? 's' : ''} ${unknown.slice(0, 5).join(', ')}`);
      for (const [key, field] of Object.entries(c.fields ?? {})) {
        if (key === '_view') { props._view = 'content'; continue; }
        if (field.type === 'slot') {
          props[key] = depth >= 12 ? [] : walk(given[key] === undefined ? clone(defaults[key] ?? []) : given[key], depth + 1);
          continue;
        }
        const clash = ownClash(c, key);
        const v = clash && given[key] !== undefined && !isPlain(given[key])
          ? cleanValue(clash, given[key], ownDefault(c, key), `${type} “${props.id}” ${key}`, f)
          : cleanValue(field, given[key], defaults[key], `${type} “${props.id}” ${key}`, f);
        if (v !== undefined) props[key] = v;
      }
      out.push({ type, props });
    }
    return out;
  };

  const rootGiven = isPlain(value.root) ? (isPlain(value.root.props) ? value.root.props : value.root) : {};
  const rootProps: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(ROOT_FIELDS)) {
    const v = cleanValue(field, rootGiven[key], (DEFAULT_ROOT as unknown as Record<string, unknown>)[key], `Theme ${key}`, f);
    if (v !== undefined) rootProps[key] = v;
  }
  const content = walk(value.content, 0);
  if (isPlain(value.zones) && Object.keys(value.zones).length) f.add('Ignored "zones" (nested blocks belong in slot settings)');
  for (const [type, n] of dropped) {
    f.add(kind === 'home' && (PROJECT_ONLY as readonly string[]).includes(type)
      ? `Removed ${n} “${type}” block${n > 1 ? 's' : ''}: it only works on project pages`
      : `Removed ${n} unknown block${n > 1 ? 's' : ''} “${type}”`);
  }
  if (!content.length) return { problem: 'The design has no blocks this site can use.' };
  const data = { root: { props: rootProps }, content } as unknown as DesignData;
  const problem = designProblem(data, kind === 'home' ? 'home' : 'project');
  if (problem) return { problem };
  return { data, blocks, fixes: f.notes };
}
