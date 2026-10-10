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
    // Built from individual elements (not one fixed Hero block), so every piece can be moved or restyled.
    block('Section', 'studio-intro', {
      background: 'none', padding: 'lg', anchor: 'home', contained: true,
      content: [
        block('Columns', 'studio-intro-columns', {
          count: '2', ratio: 'wide-left', gap: 'lg', align: 'center',
          column1: [
            block('Badge', 'studio-intro-badge', { source: 'availability', text: '', dot: true, style: 'pill', align: 'left' }),
            block('Heading', 'studio-intro-name', { source: 'name', text: '', eyebrow: '', level: 'h1', size: 'xl', sizePx: 0, weight: 'default', font: 'heading', tracking: 'default', align: 'left', uppercase: false }),
            block('Text', 'studio-intro-role', { source: 'role', text: '', size: 'lg', sizePx: 0, weight: 'bold', font: 'body', tracking: 'default', tone: 'accent2', align: 'left', maxWidth: 'none', uppercase: false }),
            block('Text', 'studio-intro-summary', { source: 'summary', text: '', size: 'md', sizePx: 0, weight: 'default', font: 'body', tracking: 'default', tone: 'muted', align: 'left', maxWidth: 'prose', uppercase: false }),
            block('Tags', 'studio-intro-tags', { source: 'technologies', items: [], style: 'soft', align: 'left' }),
            block('Flex', 'studio-intro-actions', {
              direction: 'row', gap: 12, align: 'center', justify: 'start', wrap: true, stackOnMobile: true,
              items: [
                block('Button', 'studio-intro-btn-work', { action: 'projects', label: 'View projects', href: '', style: 'primary', size: 'md', icon: 'auto', align: 'left', fullWidthMobile: true, newTab: false }),
                block('Button', 'studio-intro-btn-email', { action: 'email', label: 'Email me', href: '', style: 'secondary', size: 'md', icon: 'auto', align: 'left', fullWidthMobile: true, newTab: false }),
                block('Button', 'studio-intro-btn-resume', { action: 'resume', label: 'Resume', href: '', style: 'ghost', size: 'md', icon: 'auto', align: 'left', fullWidthMobile: false, newTab: false }),
              ],
            }),
          ],
          column2: [
            block('Image', 'studio-intro-photo', { source: 'profilePhoto', src: '', alt: '', aspect: 'portrait', rounded: true, maxWidth: 'md', align: 'center' }),
          ],
          column3: [], column4: [],
        }),
      ],
    }),
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


// ---------- project page templates (Admin → Design → Project pages) ----------
// Built from "This project" blocks, so one design shows every project's own content.

const pdfBlock = (id: string, props: Record<string, unknown> = {}) => block('Pdf', id, { source: 'project', file: '', title: '', display: 'embed', mode: 'spread', height: 0, thumbnails: true, download: false, coverLabel: 'View portfolio', ...props });
const column = (id: string, content: Block[], props: Record<string, unknown> = {}) => block('Box', id, {
  layout: { display: 'flex', direction: 'column', wrap: 'nowrap', justify: 'flex-start', align: 'stretch', gap: 28, rowGap: 16, columns: '2', columnsTablet: '2', columnsMobile: '1', stackOnMobile: true },
  size: { width: '', minWidth: '', maxWidth: '', height: '', minHeight: '', maxHeight: '', contained: true, center: false },
  spacing: { padding: { top: '32', right: '16', bottom: '48', left: '16' }, paddingMobile: {}, margin: {} },
  content,
  ...props,
});
const bar = (id: string) => block('ProjectBar', id, { backLabel: 'Projects', showName: true, sticky: true });
const title = (id: string, props: Record<string, unknown> = {}) => block('ProjectTitle', id, { level: 'h1', size: 'xl', align: 'left', eyebrow: true, uppercase: false, ...props });
const summary = (id: string, props: Record<string, unknown> = {}) => block('ProjectSummary', id, { size: 'lg', align: 'left', readable: true, ...props });
const tags = (id: string, props: Record<string, unknown> = {}) => block('ProjectTags', id, { align: 'left', style: 'tag', ...props });
const links = (id: string, props: Record<string, unknown> = {}) => block('ProjectLinks', id, { align: 'left', live: true, repo: true, external: true, fullWidthMobile: true, ...props });
const details = (id: string, props: Record<string, unknown> = {}) => block('ProjectDetails', id, { layout: 'grid', style: 'cards', objective: 'Objective', approach: 'Approach', architecture: 'Architecture', result: 'Result', ...props });
const contact = (id: string) => block('ProjectContact', id, { heading: 'Want to talk about this?', text: 'I’m happy to walk through the details, choices and results.', emailLabel: 'Email me', linkedinLabel: 'LinkedIn ↗' });
const projectNav = (id: string) => block('ProjectNav', id, { allLabel: '← All projects', showAll: true });

const projectClassic = design(
  { theme: 'classic', headingFont: 'arial', bodyFont: 'arial', radius: 'large', width: 'wide', effects: 'none' },
  [block('ProjectClassic', 'pc-classic')],
);

const projectCaseStudy = design({ theme: 'clean', radius: 'large', width: 'normal' }, [
  bar('cs-bar'),
  column('cs-main', [
    block('ProjectCover', 'cs-cover', { aspect: 'wide', rounded: true }),
    title('cs-title'), summary('cs-summary'), tags('cs-tags'), links('cs-links'),
    pdfBlock('cs-pdf', { title: '' }),
    details('cs-details'),
    block('ProjectStory', 'cs-story', { heading: 'Deep dive' }),
    contact('cs-contact'),
    projectNav('cs-nav'),
  ]),
]);

// For portfolios that are a PDF (interior design, architecture, illustration…): the PDF is the star.
const projectPdfPortfolio = design({ theme: 'paper', headingFont: 'serif', bodyFont: 'system', radius: 'small', width: 'wide' }, [
  bar('pp-bar'),
  column('pp-main', [
    title('pp-title', { align: 'center', size: '2xl', eyebrow: false }),
    summary('pp-summary', { align: 'center' }),
    tags('pp-tags', { align: 'center', style: 'plain' }),
    pdfBlock('pp-pdf', { mode: 'spread', download: true }),
    links('pp-links', { align: 'center' }),
    contact('pp-contact'),
    projectNav('pp-nav'),
  ]),
]);

const projectVisual = design({ theme: 'mono', headingFont: 'system', bodyFont: 'system', radius: 'none', width: 'wide' }, [
  bar('pv-bar'),
  block('ProjectCover', 'pv-cover', { aspect: 'wide', rounded: false }),
  column('pv-main', [
    block('Box', 'pv-row', {
      layout: { display: 'flex', direction: 'row', wrap: 'nowrap', justify: 'space-between', align: 'flex-start', gap: 48, rowGap: 16, columns: '2', columnsTablet: '2', columnsMobile: '1', stackOnMobile: true },
      spacing: { padding: {}, paddingMobile: {}, margin: {} },
      content: [
        block('Box', 'pv-left', { item: { grow: true, shrink: true, basis: '0', alignSelf: 'auto', order: 0 }, spacing: { padding: {}, paddingMobile: {}, margin: {} }, layout: { display: 'flex', direction: 'column', wrap: 'nowrap', justify: 'flex-start', align: 'stretch', gap: 20, rowGap: 16, columns: '2', columnsTablet: '2', columnsMobile: '1', stackOnMobile: true },
          content: [title('pv-title', { size: 'lg' }), summary('pv-summary'), links('pv-links')] }),
        block('Box', 'pv-right', { size: { width: '320px', minWidth: '', maxWidth: '100%', height: '', minHeight: '', maxHeight: '', contained: false, center: false }, spacing: { padding: {}, paddingMobile: {}, margin: {} }, layout: { display: 'flex', direction: 'column', wrap: 'nowrap', justify: 'flex-start', align: 'stretch', gap: 16, rowGap: 16, columns: '2', columnsTablet: '2', columnsMobile: '1', stackOnMobile: true },
          content: [tags('pv-tags', { style: 'plain' }), details('pv-details', { layout: 'stack', style: 'plain', architecture: '' })] }),
      ],
    }),
    pdfBlock('pv-pdf', { display: 'cover', coverLabel: 'Open the full project' }),
    block('ProjectStory', 'pv-story', { heading: '' }),
    projectNav('pv-nav'),
  ]),
]);

const projectBlank = design({ theme: 'clean' }, []);

export type Template = { id: string; name: string; description: string; data: DesignData; kind?: 'home' | 'project' };
export const TEMPLATES: Template[] = [
  { id: 'classic', name: 'Classic', description: 'Your original site (the one live now): sidebar, controller buttons, XP bar. Fully editable: restyle, reorder or add sections.', data: classic },
  { id: 'arcade', name: 'Arcade', description: 'Dark, neon and bold, like the classic gaming look. Every section, ready to tweak.', data: arcade },
  { id: 'minimal', name: 'Minimal', description: 'Warm paper tones, serif headings, a narrow reading column. Calm and recruiter-friendly.', data: minimal },
  { id: 'studio', name: 'Studio', description: 'Clean and light. The intro is built from separate pieces (badge, name, role, buttons, photo) you can move and restyle freely.', data: studio },
  { id: 'blank', name: 'Blank', description: 'An empty page. Drag in any blocks and build your own layout from scratch.', data: blank },
  // project pages
  { kind: 'project', id: 'project-classic', name: 'Classic', description: 'The built-in project page (the one live now), as one block. Add blocks above or below it.', data: projectClassic },
  { kind: 'project', id: 'project-case-study', name: 'Case study', description: 'Cover, title and summary, links, the PDF if there is one, the case study details, the write-up, then “get in touch” and the next project.', data: projectCaseStudy },
  { kind: 'project', id: 'project-pdf', name: 'PDF portfolio', description: 'For work shown as a PDF (interior design, architecture, illustration…): a centered title and the PDF as a two-page book.', data: projectPdfPortfolio },
  { kind: 'project', id: 'project-visual', name: 'Visual story', description: 'A full-width cover, then title and links beside the details, with the PDF as a cover card.', data: projectVisual },
  { kind: 'project', id: 'project-blank', name: 'Blank', description: 'An empty page. Build it from the “This project” blocks and everything else.', data: projectBlank },
];

export const templateById = (id: string) => TEMPLATES.find((template) => template.id === id);
/** Templates for a page: homepage ones, or project page ones. */
export const templatesFor = (scope: string) => TEMPLATES.filter((template) => (template.kind ?? 'home') === (scope === 'home' ? 'home' : 'project'));

/** What the editor starts from when there's no draft: the Classic template, which matches the built-in homepage. */
export const DEFAULT_TEMPLATE_ID = 'classic';
