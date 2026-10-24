/**
 * Homepage sections a site can switch off (Admin → Site text → "Sections on your site", or the switch at the
 * top of Projects, Experience and Skills). All are on by default; a section that's off disappears from the
 * homepage, from its menus and from buttons that jump to it, on the classic site and on designed pages.
 * Shared by the browser and the server.
 */
export const SECTIONS = {
  about: { label: 'About & stats', hint: 'Hiring snapshot and the number cards' },
  skills: { label: 'Skills', hint: 'Your tech stack' },
  projects: { label: 'Projects', hint: 'Your projects and case studies' },
  experience: { label: 'Experience', hint: 'Your work history' },
  contact: { label: 'Contact', hint: 'The “get in touch” section' },
} as const;
export type SectionKey = keyof typeof SECTIONS;
export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

export const cleanHidden = (value: unknown): SectionKey[] =>
  Array.isArray(value) ? SECTION_KEYS.filter((key) => value.includes(key)) : [];

/** Design blocks that are, by themselves, one of the sections. */
const BLOCK_SECTION: Record<string, SectionKey> = {
  Projects: 'projects', ClassicProjects: 'projects',
  Experience: 'experience', ClassicExperience: 'experience',
  Skills: 'skills', ClassicSkills: 'skills',
  ClassicAbout: 'about', Stats: 'about', HiringSnapshot: 'about',
  Contact: 'contact', ClassicContact: 'contact',
};
/** Blocks that only hold other blocks: removed when everything inside them was removed. */
const CONTAINERS = new Set(['Section', 'Box', 'Card', 'Flex', 'Grid', 'Columns']);

type Block = { type: string; props: Record<string, unknown> };
const isBlock = (value: unknown): value is Block =>
  Boolean(value) && typeof value === 'object' && typeof (value as Block).type === 'string' && typeof (value as Block).props === 'object';
const isBlockList = (value: unknown): value is Block[] => Array.isArray(value) && value.length > 0 && value.every(isBlock);
const anchorOf = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/**
 * A design (Puck data) without the switched-off sections: their blocks, sections anchored to them (#projects),
 * blocks named after them (projects-head…), buttons and menu links that jump to them, and containers left empty.
 */
export function withoutSections<T>(data: T, hidden: readonly SectionKey[]): T {
  if (!hidden.length) return data;
  const off = new Set<string>(hidden);
  const dropLink = (href: unknown) => typeof href === 'string' && href.startsWith('#') && off.has(href.slice(1).toLowerCase());

  const keep = (block: Block): boolean => {
    const p = block.props;
    if (off.has(BLOCK_SECTION[block.type] ?? '')) return false;
    if (off.has(anchorOf(p.anchor))) return false;
    const id = anchorOf(p.id);
    if ([...off].some((key) => id === key || id.startsWith(`${key}-`))) return false;
    if (block.type === 'Button' && (off.has(String(p.action ?? '')) || dropLink(p.href))) return false;
    return true;
  };

  const prune = (blocks: Block[]): Block[] => blocks.filter(keep).flatMap((block) => {
    let hadChildren = false;
    let hasChildren = false;
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(block.props)) {
      if (isBlockList(value)) {
        hadChildren = true;
        const next = prune(value);
        if (next.length) hasChildren = true;
        props[key] = next;
      } else if (Array.isArray(value) && value.some((item) => item && typeof item === 'object' && 'href' in item)) {
        props[key] = value.filter((item) => !dropLink((item as { href?: unknown }).href)); // menu links
      } else {
        props[key] = value;
      }
    }
    if (CONTAINERS.has(block.type) && hadChildren && !hasChildren) return [];
    return [{ ...block, props }];
  });

  const source = data as unknown as { content?: unknown; zones?: Record<string, unknown> };
  const next: Record<string, unknown> = { ...source };
  if (Array.isArray(source.content)) next.content = prune(source.content.filter(isBlock));
  if (source.zones && typeof source.zones === 'object') {
    next.zones = Object.fromEntries(Object.entries(source.zones).map(([zone, list]) => [zone, Array.isArray(list) ? prune(list.filter(isBlock)) : list]));
  }
  return next as T;
}
