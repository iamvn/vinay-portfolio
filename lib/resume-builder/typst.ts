import { visibleSections, TEMPLATES, type ResumeData, type TemplateId } from './types';

/**
 * Turns resume content into Typst code (https://typst.app). The generated code is meant to be read
 * and edited in the code tab, so it defines two small helpers (`section`, `entry`) and then lists the
 * content plainly.
 *
 * ATS rules every template follows: one column, real selectable text (no images or text in shapes),
 * standard section names, dates on the same line as the job, simple "•" bullets, embedded fonts.
 */

/**
 * Text inside markup (summary, bullets) so it appears literally. Only what Typst would interpret is
 * escaped, keeping the code readable: "real-time" and "CI/CD" stay as they are, but "--" (dash),
 * "//" (comment), "*bold*", "#", "$", "@", "<label>" and a leading "=", "-", "+", "/" or "1." are escaped.
 */
export function typstText(value: string): string {
  let text = value.replace(/\s+/g, ' ').trim()
    .replace(/[\\#$*_`<>@[\]~]/g, (char) => `\\${char}`)
    .replace(/-(?=[-?])/g, '\\-')          // "--" en dash, "-?" soft hyphen
    .replace(/\/(?=[/*])|(?<=\*)\//g, '\\/') // comments: //, /* */
    .replace(/\.\.\./g, '.\\..');          // "..." would become an ellipsis glyph
  if (/^[=+\-/]/.test(text)) text = `\\${text}`;  // heading / list / term markers at line start
  text = text.replace(/^(\d+)\./, '$1\\.');         // "1." numbered-list marker
  return text;
}

/** A Typst string literal. */
export const typstString = (value: string) =>
  `"${value.replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** "https://www.linkedin.com/in/x/" → "linkedin.com/in/x" (what recruiters and ATS read). */
export const displayUrl = (url: string) => url.replace(/^mailto:/i, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
const hrefFor = (url: string) => (/^(https?:|mailto:)/i.test(url) ? url : `https://${url}`);

type Style = {
  font: string;
  size: string;
  nameSize: string;
  margin: string;
  leading: string;
  accent: string;
  headerAlign: 'center' | 'left';
  nameStyle: (name: string) => string;
  section: string;   // body of #let section(title) = …
  entry: string;     // body of #let entry(…) = …
  listSpacing: string;
  entryGap: string;
};

const ENTRY_TWO_LINE = (titleWeight: string) => `{
  v(ENTRY_GAP, weak: true)
  block(sticky: true, breakable: false, width: 100%)[
    #text(weight: "${titleWeight}", title) #h(1fr) #date
    #if subtitle != "" or location != "" [
      \\ #emph(subtitle) #h(1fr) #emph(location)
    ]
  ]
  v(0.1em)
}`;

const ENTRY_ONE_LINE = `{
  v(ENTRY_GAP, weak: true)
  block(sticky: true, breakable: false, width: 100%)[
    #text(weight: "bold", title)#if subtitle != "" [, #subtitle]#if location != "" [ · #location] #h(1fr) #date
  ]
}`;

const STYLES: Record<TemplateId, Style> = {
  classic: {
    font: 'New Computer Modern', size: '10.5pt', nameSize: '24pt', margin: '(x: 1.5cm, y: 1.3cm)', leading: '0.6em',
    accent: 'black', headerAlign: 'center', listSpacing: '0.55em', entryGap: '0.9em',
    nameStyle: (name) => `#text(size: NAME_SIZE, weight: "bold", smallcaps(${name}))`,
    section: `block(sticky: true, breakable: false, width: 100%, above: 1em, below: 0.5em)[
  #text(size: 1.1em, weight: "bold", smallcaps(title))
  #v(-0.55em)
  #line(length: 100%, stroke: 0.6pt + accent)
]`,
    entry: ENTRY_TWO_LINE('bold'),
  },
  modern: {
    font: 'Inter', size: '9.8pt', nameSize: '22pt', margin: '(x: 1.6cm, y: 1.4cm)', leading: '0.62em',
    accent: 'rgb("#1d4ed8")', headerAlign: 'left', listSpacing: '0.55em', entryGap: '0.95em',
    nameStyle: (name) => `#text(size: NAME_SIZE, weight: "bold", ${name})`,
    section: `block(sticky: true, breakable: false, width: 100%, above: 1.1em, below: 0.5em)[
  #text(size: 0.95em, weight: "bold", fill: accent, tracking: 0.08em, upper(title))
  #v(-0.6em)
  #line(length: 100%, stroke: 0.5pt + luma(190))
]`,
    entry: ENTRY_TWO_LINE('semibold'),
  },
  compact: {
    font: 'Libertinus Serif', size: '10pt', nameSize: '19pt', margin: '(x: 1.25cm, y: 1.05cm)', leading: '0.5em',
    accent: 'black', headerAlign: 'center', listSpacing: '0.42em', entryGap: '0.7em',
    nameStyle: (name) => `#text(size: NAME_SIZE, weight: "bold", ${name})`,
    section: `block(sticky: true, breakable: false, width: 100%, above: 0.8em, below: 0.4em)[
  #text(size: 1.05em, weight: "bold", upper(title))
  #v(-0.6em)
  #line(length: 100%, stroke: 0.5pt + accent)
]`,
    entry: ENTRY_ONE_LINE,
  },
  minimal: {
    font: 'Inter', size: '10pt', nameSize: '26pt', margin: '(x: 1.8cm, y: 1.6cm)', leading: '0.68em',
    accent: 'black', headerAlign: 'left', listSpacing: '0.6em', entryGap: '1.05em',
    nameStyle: (name) => `#text(size: NAME_SIZE, weight: "semibold", ${name})`,
    section: `block(sticky: true, breakable: false, width: 100%, above: 1.4em, below: 0.6em)[
  #text(size: 1.15em, weight: "bold", title)
]`,
    entry: ENTRY_TWO_LINE('semibold'),
  },
};

const nonEmpty = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
const bullets = (items: string[]) => nonEmpty(items).map((item) => `- ${typstText(item)}`).join('\n');

/** Typst code for a resume. `title` is the resume's own name (shown only in a comment). */
export function toTypst(data: ResumeData, template: TemplateId, title = 'Resume'): string {
  const style = STYLES[template] ?? STYLES.classic;
  const templateName = TEMPLATES.find((t) => t.id === template)?.name ?? template;
  const { basics } = data;
  const out: string[] = [];

  out.push(
    `// Resume: ${title.replace(/\n/g, ' ')} · Template: ${templateName}`,
    '// This is Typst code (typst.app/docs). Edit anything; the preview updates as you type.',
    '// Content tab → "Regenerate code from form" rebuilds this file from the form.',
    '',
    '// ─── Page, fonts and spacing ───',
    `#set document(title: ${typstString(`${basics.name || 'Resume'} – Resume`)}, author: ${typstString(basics.name || 'Resume')})`,
    `#set page(paper: "${data.layout.paper}", margin: ${style.margin})`,
    `#set text(font: "${style.font}", size: ${style.size}, lang: "en", hyphenate: false)`,
    `#set par(leading: ${style.leading}, spacing: 0.75em, justify: false)`,
    `#set list(indent: 0.15em, body-indent: 0.55em, spacing: ${style.listSpacing}, marker: [•])`,
    '#set smartquote(enabled: false) // keep quotes exactly as typed',
    '#show link: set text(fill: black)',
    `#let accent = ${style.accent}`,
    '',
    '// ─── Building blocks ───',
    `#let section(title) = ${style.section}`,
    '',
    `#let entry(title: "", subtitle: "", date: "", location: "") = ${style.entry.replace('ENTRY_GAP', style.entryGap)}`,
    '',
    '// ─── Header ───',
  );

  const contact = [
    basics.phone ? typstText(basics.phone) : '',
    basics.email ? `#link("mailto:${basics.email.trim().replace(/"/g, '')}")[${typstText(basics.email)}]` : '',
    basics.location ? typstText(basics.location) : '',
    ...basics.links.filter((link) => link.url.trim()).map((link) => `#link(${typstString(hrefFor(link.url.trim()))})[${typstText(displayUrl(link.url))}]`),
  ].filter(Boolean);

  out.push(`#align(${style.headerAlign})[`);
  out.push(`  ${style.nameStyle(typstString(basics.name || 'Your Name')).replace('NAME_SIZE', style.nameSize)}`);
  if (basics.headline.trim()) {
    out.push(`  #v(-0.35em)`, `  #text(size: 1.1em${template === 'modern' ? ', fill: accent, weight: "medium"' : ''})[${typstText(basics.headline)}]`);
  }
  // Each item in a box so a link never breaks across lines.
  if (contact.length) out.push('  #v(-0.25em)', `  ${contact.map((item) => `#box[${item}]`).join(' #h(0.4em)|#h(0.4em) ')}`);
  out.push(']');

  for (const id of visibleSections(data)) {
    const block = renderSection(id, data);
    if (block) out.push('', block);
  }
  return `${out.join('\n')}\n`;
}

function renderSection(id: ReturnType<typeof visibleSections>[number], data: ResumeData): string {
  switch (id) {
    case 'summary': {
      const summary = data.basics.summary.trim();
      return summary ? `#section("Summary")\n${typstText(summary)}` : '';
    }
    case 'experience': {
      const items = data.experience.filter((item) => !item.hidden && (item.role.trim() || item.company.trim()));
      if (!items.length) return '';
      return ['#section("Experience")', ...items.map((item) => [
        `#entry(title: ${typstString(item.role)}, subtitle: ${typstString(item.company)}, date: ${typstString(item.period)}, location: ${typstString(item.location)})`,
        bullets(item.bullets),
      ].filter(Boolean).join('\n'))].join('\n\n');
    }
    case 'projects': {
      const items = data.projects.filter((item) => !item.hidden && item.name.trim());
      if (!items.length) return '';
      return ['#section("Projects")', ...items.map((item) => {
        const date = item.link.trim() ? `[#link(${typstString(hrefFor(item.link.trim()))})[${typstText(displayUrl(item.link))}]]` : '""';
        return [
          `#entry(title: ${typstString(item.name)}, subtitle: ${typstString(item.tech)}, date: ${date})`,
          bullets(item.bullets),
        ].filter(Boolean).join('\n');
      })].join('\n\n');
    }
    case 'skills': {
      const groups = data.skills.filter((group) => group.items.trim());
      if (!groups.length) return '';
      return ['#section("Skills")', groups.map((group) => (group.group.trim()
        ? `*${typstText(group.group)}:* ${typstText(group.items)}`
        : typstText(group.items))).join(' \\\n')].join('\n');
    }
    case 'education': {
      const items = data.education.filter((item) => item.school.trim() || item.degree.trim());
      if (!items.length) return '';
      return ['#section("Education")', ...items.map((item) => [
        `#entry(title: ${typstString(item.school)}, subtitle: ${typstString(item.degree)}, date: ${typstString(item.period)}, location: ${typstString(item.location)})`,
        item.details.trim() ? typstText(item.details) : '',
      ].filter(Boolean).join('\n'))].join('\n\n');
    }
    case 'extras': {
      const blocks = data.extras.filter((extra) => extra.title.trim() && nonEmpty(extra.items).length);
      return blocks.map((extra) => `#section(${typstString(extra.title)})\n${bullets(extra.items)}`).join('\n\n');
    }
  }
}

// ---------- keeping custom code in sync ----------

const HEADER_MARK = '// ─── Header ───';
const SECTION_START = /^#section\(/m;

/** Splits generated code into its header block and one block per section (keyed by the section call). */
function blocksOf(code: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const headerAt = code.indexOf(HEADER_MARK);
  const firstSection = code.search(SECTION_START);
  if (headerAt !== -1) blocks.set('header', code.slice(headerAt, firstSection === -1 ? undefined : firstSection).trimEnd());
  if (firstSection !== -1) {
    for (const part of code.slice(firstSection).split(/(?=^#section\()/m)) {
      const key = part.slice(0, part.indexOf('\n') === -1 ? undefined : part.indexOf('\n')).trim();
      blocks.set(key, part.trimEnd());
    }
  }
  return blocks;
}

/** Where a block sits in the user's code: [start, end) or null. */
function locate(code: string, key: string): [number, number] | null {
  if (key === 'header') {
    const start = code.indexOf(HEADER_MARK);
    if (start === -1) return null;
    const next = code.slice(start).search(SECTION_START);
    return [start, next === -1 ? code.length : start + next];
  }
  const start = code.indexOf(`\n${key}`) + 1;
  if (start === 0) return code.startsWith(key) ? [0, nextSection(code, key.length)] : null;
  return [start, nextSection(code, start + key.length)];
}
function nextSection(code: string, from: number) {
  const next = code.slice(from).search(SECTION_START);
  return next === -1 ? code.length : from + next;
}

/**
 * Applies a content change to edited (custom) code: every header/section block that the change affects
 * is replaced with freshly generated code; everything else the user wrote is kept.
 * Returns ok: false when a changed block can't be found (e.g. the section was renamed in the code).
 */
export function patchCustomCode(code: string, before: ResumeData, after: ResumeData, template: TemplateId, title: string): { code: string; ok: boolean } {
  const old = blocksOf(toTypst(before, template, title));
  const fresh = blocksOf(toTypst(after, template, title));
  let result = code;
  let ok = true;
  const keys = [...new Set([...old.keys(), ...fresh.keys()])];
  for (const key of keys) {
    const was = old.get(key);
    const now = fresh.get(key);
    if (was === now) continue;
    const at = locate(result, key);
    if (at) {
      const [start, end] = at;
      const tail = result.slice(end);
      result = `${result.slice(0, start)}${now ? `${now}\n${tail ? '\n' : ''}` : ''}${tail}`;
    } else if (now && key !== 'header') {
      // A section the code doesn't have yet (e.g. Education was just added): put it at the end.
      result = `${result.trimEnd()}\n\n${now}\n`;
    } else if (now) {
      ok = false;
    }
  }
  return { code: result, ok };
}
