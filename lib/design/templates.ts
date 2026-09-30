import type { Data } from '@puckeditor/core';
import { DEFAULT_ROOT, type RootProps } from './theme';

/**
 * Starting points in Admin → Design. A template only describes layout and style: names, projects,
 * experience and skills are filled in live from the other admin tabs, so every template shows your content.
 */
export type DesignData = Data;

type Block = { type: string; props: Record<string, unknown> & { id: string } };
const block = (type: string, id: string, props: Record<string, unknown> = {}): Block => ({ type, props: { id, ...props } });
const design = (root: Partial<RootProps>, content: Block[]): DesignData => ({ root: { props: { ...DEFAULT_ROOT, ...root } }, content } as DesignData);

const NAV_LINKS = [
  { label: 'Projects', href: '#projects' },
  { label: 'Experience', href: '#experience' },
  { label: 'Skills', href: '#skills' },
  { label: 'Contact', href: '#contact' },
];

// The original site, rebuilt from blocks: identical to the built-in homepage, but every section can be
// moved, removed, restyled, or mixed with other blocks.
const classic = design(
  { theme: 'classic', headingFont: 'arial', bodyFont: 'arial', radius: 'large', width: 'wide', effects: 'scanlines' },
  [
    block('ClassicShell', 'classic-shell', {
      content: [
        block('ClassicHero', 'classic-hero'),
        block('ClassicAbout', 'classic-about'),
        block('ClassicSkills', 'classic-skills'),
        block('ClassicProjects', 'classic-projects'),
        block('ClassicExperience', 'classic-experience'),
        block('ClassicContact', 'classic-contact'),
        block('ClassicFooter', 'classic-footer'),
      ],
    }),
  ],
);

const arcade = design(
  { theme: 'arcade', headingFont: 'arial', bodyFont: 'arial', radius: 'large', width: 'wide', effects: 'grid' },
  [
    block('NavBar', 'arcade-nav', { brand: '', links: NAV_LINKS, showResume: true, sticky: true }),
    block('Hero', 'arcade-hero', { variant: 'arcade', headline: '', subheading: '', showPhoto: false, showTags: true, showSocial: true, showStatus: true, primaryLabel: '', primaryHref: '#projects', secondaryLabel: '', secondaryHref: '#contact' }),
    block('HiringSnapshot', 'arcade-hiring', { title: 'Hiring snapshot' }),
    block('Stats', 'arcade-stats', { style: 'cards' }),
    block('Skills', 'arcade-skills', { layout: 'cards', align: 'left', eyebrow: '', title: '', description: '' }),
    block('Projects', 'arcade-projects', { layout: 'grid', columns: '3', filter: 'all', limit: 0, showStack: true, align: 'left', eyebrow: '', title: '' }),
    block('Experience', 'arcade-experience', { layout: 'timeline', maxBullets: 0, align: 'left', eyebrow: '', title: '', description: '' }),
    block('Contact', 'arcade-contact', { style: 'card', align: 'center', eyebrow: '', title: '', description: '', buttonLabel: '' }),
    block('Footer', 'arcade-footer', { text: '', showSocial: true }),
  ],
);

const minimal = design(
  { theme: 'paper', headingFont: 'serif', bodyFont: 'system', radius: 'small', width: 'narrow', effects: 'none' },
  [
    block('NavBar', 'minimal-nav', { brand: '', links: [{ label: 'Work', href: '#projects' }, { label: 'Experience', href: '#experience' }, { label: 'Contact', href: '#contact' }], showResume: true, sticky: false }),
    block('Hero', 'minimal-hero', { variant: 'centered', headline: '', subheading: '', showPhoto: true, showTags: false, showSocial: true, showStatus: true, primaryLabel: 'See my work', primaryHref: '#projects', secondaryLabel: 'Get in touch', secondaryHref: '#contact' }),
    block('Stats', 'minimal-stats', { style: 'inline' }),
    block('HiringSnapshot', 'minimal-hiring', { title: 'Currently' }),
    block('Projects', 'minimal-projects', { layout: 'list', columns: '2', filter: 'all', limit: 0, showStack: true, align: 'left', eyebrow: 'Selected work', title: 'Projects' }),
    block('Experience', 'minimal-experience', { layout: 'compact', maxBullets: 2, align: 'left', eyebrow: 'Career', title: 'Experience', description: '-' }),
    block('Skills', 'minimal-skills', { layout: 'list', align: 'left', eyebrow: 'Toolbox', title: 'Skills', description: '-' }),
    block('Contact', 'minimal-contact', { style: 'plain', align: 'center', eyebrow: 'Contact', title: '', description: '', buttonLabel: 'Email me' }),
    block('Footer', 'minimal-footer', { text: '', showSocial: false }),
  ],
);

const studio = design(
  { theme: 'clean', headingFont: 'system', bodyFont: 'system', radius: 'medium', width: 'normal', effects: 'none' },
  [
    block('NavBar', 'studio-nav', { brand: '', links: NAV_LINKS, showResume: true, sticky: true }),
    block('Hero', 'studio-hero', { variant: 'split', headline: '', subheading: '', showPhoto: true, showTags: true, showSocial: false, showStatus: true, primaryLabel: 'View projects', primaryHref: '#projects', secondaryLabel: 'Contact me', secondaryHref: '#contact' }),
    block('HiringSnapshot', 'studio-hiring', { title: 'Open to work' }),
    block('Section', 'studio-highlights', {
      background: 'soft', padding: 'md', anchor: 'about', contained: true,
      content: [
        block('Heading', 'studio-highlights-heading', { eyebrow: 'Why work with me', text: 'What I bring to a team', level: 'h2', size: 'md', align: 'left', uppercase: false }),
        block('Columns', 'studio-highlights-columns', {
          count: '3', ratio: 'equal', gap: 'md', align: 'start',
          column1: [block('Card', 'studio-card-1', { padding: 'md', tone: 'surface', content: [
            block('Heading', 'studio-card-1-h', { eyebrow: '', text: 'Ship fast', level: 'h3', size: 'sm', align: 'left', uppercase: false }),
            block('Text', 'studio-card-1-t', { text: 'Edit this text in Admin → Design. Describe how you take features from idea to production.', size: 'sm', tone: 'muted', align: 'left', maxWidth: 'none' }),
          ] })],
          column2: [block('Card', 'studio-card-2', { padding: 'md', tone: 'surface', content: [
            block('Heading', 'studio-card-2-h', { eyebrow: '', text: 'Performance first', level: 'h3', size: 'sm', align: 'left', uppercase: false }),
            block('Text', 'studio-card-2-t', { text: 'A line about fast, accessible interfaces and the results you measured.', size: 'sm', tone: 'muted', align: 'left', maxWidth: 'none' }),
          ] })],
          column3: [block('Card', 'studio-card-3', { padding: 'md', tone: 'surface', content: [
            block('Heading', 'studio-card-3-h', { eyebrow: '', text: 'AI-ready', level: 'h3', size: 'sm', align: 'left', uppercase: false }),
            block('Text', 'studio-card-3-t', { text: 'A line about the AI features and tooling you build with.', size: 'sm', tone: 'muted', align: 'left', maxWidth: 'none' }),
          ] })],
          column4: [],
        }),
      ],
    }),
    block('Projects', 'studio-projects', { layout: 'grid', columns: '2', filter: 'all', limit: 0, showStack: true, align: 'left', eyebrow: '', title: '' }),
    block('Experience', 'studio-experience', { layout: 'cards', maxBullets: 3, align: 'left', eyebrow: '', title: '', description: '' }),
    block('Skills', 'studio-skills', { layout: 'tags', align: 'center', eyebrow: '', title: '', description: '' }),
    block('Contact', 'studio-contact', { style: 'card', align: 'center', eyebrow: '', title: '', description: '', buttonLabel: '' }),
    block('Footer', 'studio-footer', { text: '', showSocial: true }),
  ],
);

const blank = design({ theme: 'clean' }, []);

export const TEMPLATES: { id: string; name: string; description: string; data: DesignData }[] = [
  { id: 'classic', name: 'Classic', description: 'Your original site (the one live now): sidebar, controller buttons, XP bar. Fully editable: restyle, reorder or add sections.', data: classic },
  { id: 'arcade', name: 'Arcade', description: 'Dark, neon and bold, like the classic gaming look. Every section, ready to tweak.', data: arcade },
  { id: 'minimal', name: 'Minimal', description: 'Warm paper tones, serif headings, a narrow reading column. Calm and recruiter-friendly.', data: minimal },
  { id: 'studio', name: 'Studio', description: 'Clean and light with a split hero, “why me” cards, and project and experience cards.', data: studio },
  { id: 'blank', name: 'Blank', description: 'An empty page. Drag in any blocks and build your own layout from scratch.', data: blank },
];

export const templateById = (id: string) => TEMPLATES.find((template) => template.id === id);

/** What the editor starts from when there's no draft: the Classic template, which matches the built-in homepage. */
export const DEFAULT_TEMPLATE_ID = 'classic';
