import { designConfig } from '@/components/design/config';
import { STYLE_KEYS, migrateDesign, styleFields } from '@/components/design/style-panel';
import { DEFAULT_ROOT, isSafeColor } from './theme';
import { BLOCK_TYPES, PROJECT_ONLY, designProblem, type DesignScope } from './store';
import type { DesignData } from './templates';
import { OWNER_TEMPLATES } from './owner-templates';

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
      if (field.ai === 'color') return 'color: "" (= theme color), hex like "#1e293b", or rgba(255,255,255,0.6) for see-through glass';
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

/** The polished example in the homepage prompt, compact (defaults left out) and with the concept as its brief. */
let examplePage: unknown = null;
const EXAMPLE_PAGE = () => (examplePage ??= { brief: OWNER_TEMPLATES[0].description, ...(compactDesign(OWNER_TEMPLATES[0].data) as object) });

const EXAMPLES: Record<TemplateKind, unknown> = {
  home: {
    brief: 'Calm editorial: warm paper background, ink-black serif headings, one burnt-orange accent, generous white space, thin rules between sections.',
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
    brief: 'Clean case study: white page, indigo accent, big cover, readable story column.',
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
  "brief": "2–4 sentences: your design concept (see How to design it)",
  "root": { "props": { …theme settings… } },
  "content": [ { "type": "BlockName", "props": { "id": "unique-id", …settings… } } ]
}`,
    `# How to design it

The person wants a page that is unmistakably theirs. A safe, generic portfolio is a failed answer. Work in this order:

1. Concept first. Turn the request into a concrete visual language and write it in "brief": the mood; the palette (each color and its role); typography (fonts, case, letter spacing); shapes (corners, borders, glows, gradients); recurring motifs; and the vocabulary for section labels. Short requests ("PlayStation 5 theme", "cricket") still need a full concept: think about what the thing actually looks and feels like and borrow that.
2. Theme everything at the root: set all nine root colors to your palette (not the theme preset's), plus headingFont, bodyFont, headingCase, headingWeight, radius, buttonShape, buttonStyle and effects to match.
3. Make the first screen the signature moment. If the plain Hero block can't carry the theme, build the hero yourself from Section, Flex, Box and Card: gradient panels, glowing 1px accent borders, large uppercase headings, small monospace status labels, icons, live text via "source" (name, role, summary, availability).
4. Speak the theme's language. Every section gets a themed eyebrow or label and one themed line of copy (for a game console: "Select a game" for projects, "Trophies" for stats, "Player profile" for about, "Loadout" for skills, "Join the party" for contact). Live blocks have eyebrow/title settings: theme them, or set them to "-" and write your own Heading above.
5. Vary the rhythm: alternate section backgrounds, mix full-width bands with contained panels, use cards, dividers and icons. Don't give every section the same layout.
6. Check before answering: would a stranger name the theme from a screenshot? Is the text readable (light text on dark, or dark on light)? Does it work on a phone?

# Techniques that make a page look designed (use them)

- Panels: put each section in a Box with size.contained true, a fill (white, a tint, or rgba(255,255,255,0.8) for glass), a 1px border, radius 20–32, shadow "sm", padding about 40 (24 on phones via spacing.paddingMobile) and margin top 20, so sections float on the page background. Set advanced.fitSections true on any Box that holds a ready-made section (Projects, Skills, Experience, Stats…), otherwise those add their own big spacing.
- Section header: a Flex row (justify "between", stackOnMobile true) with on the left a small uppercase muted Text (tracking "wide", e.g. "FEATURED WORK") above a bold Heading, and on the right a short muted Text or a Link ("View all"). Then hide the ready-made section's own heading by setting its eyebrow and title to "-".
- Feature cards: a Grid (4 / 2 / 1 columns) of Boxes, each a row with an Icon (background "circle", tone "accent2") next to a small bold Heading and a short Text.
- Liquid Glass (Apple-style translucent material): Box look.glass "light", "clear", "tinted" or "dark" gives a blurred, light-catching glass pane with a bright rim; use it for panels, cards, docks and toolbars over a colorful background. NavBar style "glass" is a floating glass capsule. Icon background "glass" is a glass tile; background "tile" is a glossy colored app-icon squircle with a white glyph.
- Hero: a Box with a colorful background (a gradient: look.fill "custom", fillColor + gradientVia + gradientTo, angle 100–140; or the built-in wallpaper look.image "/design/wallpapers/sunrise-hills.svg", imageFit "cover") with a two-column Flex: intro on one side; on the other a glass card holding the profile photo (Image source "profilePhoto", optional filter "grayscale", radiusPx), name, role and a few icon + live-text lines ("pin" + location, "briefcase" + availabilityNote, currentJob).
- Small details: macOS-style window dots (three 12px Boxes, radius 99, red #ff5f57, yellow #febc2e, green #28c840, padding 0), a status Badge with a dot, a dock of Icon tiles, thin Dividers, eyebrow labels.
- Ready-made sections have richer looks: Projects frame "window" (covers in app windows), linkStyle "arrow" (round ↗ button), tabs true (Featured / All switch); Skills layout "tabs" (segmented control of skill groups over chips); Experience layout "journey" (side by side with ringed markers).
- Call to action at the end: a soft gradient strip with an Icon, eyebrow, Heading, the contact description and a "Get in touch" Button.
- Typography: use Heading "size" (it scales down on phones) for big titles; only use sizePx below 30. One heading font, one body font. Pair a near-black text color with a muted grey and one or two accents.
- Rhythm: consistent radius across cards, gaps of 12–24 inside panels, 20 between panels. Hide decorative extras on phones with advanced.visibility "desktop" (Box) or more.visibility (other blocks).

How themes map onto this builder (examples; adapt, don't copy):
- Game console: near-black to deep-blue gradients, one luminous accent (electric blue or white glow), cool second accent; condensed or system headings in uppercase with wide tracking; mono labels like "SYSTEM READY" or "LOADING…"; console-style panels (Box with dark gradient, 1px accent border, radius 24–32, large shadow); "game" icons; projects as a game library (Projects layout "carousel" or "gallery", wide images); effects "grid".
- Streaming app: black, one bold red accent, huge banner hero, rows of wide poster cards (Projects carousel), "Up next" and "Continue watching" wording.
- Sports scoreboard: deep green or navy, cream text, mono or condensed numbers, stats as scoreboard cards, match and innings wording.
- Newspaper or magazine: paper colors, serif headings, square corners, thin dividers, column layouts, masthead-style name.`,
    `# Rules

1. Only use the block types listed under "Blocks" below, spelled exactly. Anything else is removed.
2. Every block has "type" and "props"; "props.id" is required and must be unique across the WHOLE page (letters, digits and dashes, e.g. "hero", "about-title"). Settings go inside "props", never next to "type".
3. Blocks go inside other blocks only through that block's SLOT settings (an array of blocks), e.g. Section.content, Columns.column1–column4, Flex.items, Grid.items, Box.content, Card.content, Hero.extra. Nothing else can hold blocks. Do not use "zones".
4. Limits: at most 400 blocks in total, nested at most 12 levels deep, under 400 KB of JSON. A finished page usually has 60–150 blocks: thin pages look unfinished.
5. For "one of" settings use one of the listed values exactly, with the same type (true/false are booleans, "2" is a string). Numbers must be within the range shown.
6. Leave out any setting you don't need: it gets the default shown. Objects may be partial (only the keys you change).
7. Colors: hex like "#0f172a", rgba(…) for translucent glass, or "" for the theme color. Set the palette on root.props.colors; inside blocks prefer tones (accent, surface, soft…) so everything stays consistent.
8. Images and links: only https:// URLs, site paths like /resume or #section anchors, or mailto:. Leave image URLs empty ("") rather than inventing them; never use data: or javascript: URLs.
9. Text is plain text only. No HTML, CSS, class names, scripts or emoji-heavy decoration.
10. Themed requests ("Netflix style", "cricket scoreboard", "retro newspaper"…): capture the mood with colors, fonts, layout and your own wording. Never use another brand's logo, name or trademarked slogans in the page text.
11. The person’s real details (name, role, summary, projects, experience, skills, contact links, resume) are filled in live by the site. Use the live blocks (Hero, Projects, Experience, Skills, Stats, Contact, SocialLinks, ResumeButton…) or a Heading/Text/Badge/Image "source" binding to show them. Never type their name (leave NavBar "brand" empty), employers, numbers, testimonials or technology lists: for technologies use Tags with source "technologies" or "skills". Themed labels and short generic lines are fine. The hero headline and section eyebrows/titles can also come from the owner’s Site text (sources "headline", "projectsTitle", "skillsTitle", "experienceTitle", "contactTitle"…; Button labelSource "primaryAction"/"contactAction") when no themed wording is needed, so the owner can edit them without the editor.
12. Build custom layouts with Section, Columns, Flex, Grid, Box and Card. Make it look good on phones too (e.g. Columns and Flex stack on mobile, Grid has columnsMobile).
13. Blocks marked "+ shared design settings" also accept the settings under "Shared design settings" (spacing, size, colors, border, item, more). Use them sparingly. When a block lists its own setting with one of those names (e.g. Heading "size"), use the block's own meaning.`,
    `# Page

You are designing ${page}.`,
    `# Theme settings (root.props)

${lines(ROOT_FIELDS, '', DEFAULT_ROOT as unknown as Record<string, unknown>)}`,
    `# Blocks\n\n${catalog(kind)}`,
    `# Shared design settings (for blocks marked "+ shared design settings")

${lines(styleFields as unknown as Record<string, Field>, '', undefined)}`,
    kind === 'home'
      ? `# A complete example of the quality expected

This is a real page made with this builder ("${OWNER_TEMPLATES[0].name}": ${OWNER_TEMPLATES[0].description}). Study how it's put together (panels, headers, cards, glass, live blocks, phone settings) and match its level of finish and completeness. Don't copy its look: your page follows your own brief.

${JSON.stringify(EXAMPLE_PAGE())}`
      : `# A small valid example (only to show the JSON shape: it is deliberately plain; your design should be far richer)

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
        if (value === '' || isSafeColor(value)) return String(value).trim();
        f.add(`${path}: ${JSON.stringify(value)} isn’t a hex or rgba() color, used the theme color`);
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
  | { data: DesignData; blocks: number; fixes: string[]; brief: string; problem?: never }
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
  // The AI's design concept: used as the template's description when none is given.
  const brief = typeof value.brief === 'string' ? value.brief.replace(/\s+/g, ' ').trim().slice(0, 600) : '';

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
  return { data, blocks, fixes: f.notes, brief };
}
