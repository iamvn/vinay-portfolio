/**
 * Puck configuration for Admin → Design: every block a design can use, its settings, and the site-wide theme.
 * Used by both the editor (client) and the live homepage (server), so render functions must stay hook-free.
 */
import type { Config, Slot } from '@puckeditor/core';
import type { PortfolioData } from '@/lib/portfolio';
import { DEFAULT_ROOT, FONTS, PALETTE_FIELDS, THEME_PRESETS, recolorsClassic, safeHref, safeSrc, themeVars, type RootProps } from '@/lib/design/theme';
import { AskAssistant } from '../ask-assistant';
import { Icon } from '../icons';
import {
  Contact, Experience, Footer, Hero, Hiring, NavBar, Projects, Skills, SocialIcons, Stats,
  type ContactProps, type ExperienceProps, type HeroProps, type NavProps, type ProjectsProps, type SkillsProps,
} from './portfolio-blocks';
import { ClassicAbout, ClassicContact, ClassicExperience, ClassicFooter, ClassicHero, ClassicProjects, ClassicShell, ClassicSkills } from '../classic-sections';
import { DEFAULT_APPEARANCE, Styled, appearanceField, colorField, type Appearance } from './appearance';

/** Passed to Puck as `metadata`: the live content blocks render. */
export type DesignMetadata = { portfolio: PortfolioData; assistant: boolean };
const meta = (puck: { metadata: Record<string, unknown> }) => puck.metadata as unknown as DesignMetadata;

type Align = 'left' | 'center' | 'right';

type Components = {
  // Classic (the original site, section by section)
  ClassicShell: { content: Slot };
  ClassicHero: Record<string, never>;
  ClassicAbout: Record<string, never>;
  ClassicSkills: Record<string, never>;
  ClassicProjects: Record<string, never>;
  ClassicExperience: Record<string, never>;
  ClassicContact: Record<string, never>;
  ClassicFooter: Record<string, never>;
  // Portfolio (live content)
  NavBar: NavProps;
  Hero: HeroProps;
  HiringSnapshot: { title: string };
  Stats: { style: 'cards' | 'inline' };
  Skills: SkillsProps;
  Projects: ProjectsProps;
  Experience: ExperienceProps;
  Contact: ContactProps;
  SocialLinks: { align: 'left' | 'center'; labels: boolean };
  ResumeButton: { label: string; style: 'primary' | 'secondary'; align: Align };
  Footer: { text: string; showSocial: boolean };
  // Layout
  Section: { content: Slot; background: 'none' | 'surface' | 'soft' | 'accent' | 'inverted'; padding: 'sm' | 'md' | 'lg' | 'xl'; anchor: string; contained: boolean };
  Columns: { count: '2' | '3' | '4'; ratio: 'equal' | 'wide-left' | 'wide-right'; gap: 'sm' | 'md' | 'lg'; align: 'start' | 'center'; column1: Slot; column2: Slot; column3: Slot; column4: Slot };
  Card: { content: Slot; padding: 'sm' | 'md' | 'lg'; tone: 'surface' | 'soft' | 'accent' };
  Spacer: { size: 'sm' | 'md' | 'lg' | 'xl' };
  Divider: { style: 'line' | 'dots' };
  // Basic
  Heading: { text: string; eyebrow: string; level: 'h1' | 'h2' | 'h3' | 'h4'; size: 'sm' | 'md' | 'lg' | 'xl'; align: Align; uppercase: boolean };
  Text: { text: string; size: 'sm' | 'md' | 'lg'; align: Align; tone: 'normal' | 'muted' | 'accent'; maxWidth: 'none' | 'prose' };
  Button: { label: string; href: string; style: 'primary' | 'secondary' | 'ghost'; align: Align; newTab: boolean };
  Image: { src: string; alt: string; aspect: 'auto' | 'square' | 'video' | 'portrait'; rounded: boolean; maxWidth: 'sm' | 'md' | 'lg' | 'full'; align: Align };
  List: { items: { text: string }[]; style: 'bullets' | 'checks' | 'numbers' };
};

// ---------- reusable field definitions ----------
const yesNo = (label: string) => ({ type: 'radio' as const, label, options: [{ label: 'Show', value: true }, { label: 'Hide', value: false }] });
const alignField = { type: 'radio' as const, label: 'Align', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] };
const align2Field = { type: 'radio' as const, label: 'Align', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }] };
const fromSiteText = (label: string) => ({ type: 'text' as const, label: `${label} (empty = site text, - = hide)` });
const alignClass = (align: Align) => ({ left: 'text-left', center: 'text-center', right: 'text-right' })[align] ?? 'text-left';
const justifyClass = (align: Align) => ({ left: 'justify-start', center: 'justify-center', right: 'justify-end' })[align] ?? 'justify-start';

/** Every block name; lib/design/store.ts checks its allow-list against this at compile time. */
export type DesignBlockName = keyof Components;
const INNER_BLOCKS = ['Heading', 'Text', 'Button', 'Image', 'List', 'Spacer', 'Divider', 'Card', 'Columns', 'SocialLinks', 'ResumeButton'];

export const designConfig: Config<Components, RootProps> = {
  categories: {
    classic: { title: 'Classic (original site)', components: ['ClassicShell', 'ClassicHero', 'ClassicAbout', 'ClassicSkills', 'ClassicProjects', 'ClassicExperience', 'ClassicContact', 'ClassicFooter'] },
    portfolio: { title: 'Portfolio (live content)', components: ['NavBar', 'Hero', 'HiringSnapshot', 'Stats', 'Skills', 'Projects', 'Experience', 'Contact', 'SocialLinks', 'ResumeButton', 'Footer'] },
    layout: { title: 'Layout', components: ['Section', 'Columns', 'Card', 'Spacer', 'Divider'] },
    basic: { title: 'Text & media', components: ['Heading', 'Text', 'Button', 'Image', 'List'] },
  },

  root: {
    fields: {
      theme: { type: 'select', label: 'Color theme', options: Object.entries(THEME_PRESETS).map(([value, preset]) => ({ label: preset.label, value })) },
      colors: {
        type: 'object', label: 'Colors (empty = theme color)',
        objectFields: Object.fromEntries(PALETTE_FIELDS.map(({ key, label }) => [key, colorField(label)])) as never,
      },
      headingFont: { type: 'select', label: 'Heading font', options: Object.entries(FONTS).map(([value, font]) => ({ label: font.label, value })) },
      bodyFont: { type: 'select', label: 'Body font', options: Object.entries(FONTS).map(([value, font]) => ({ label: font.label, value })) },
      textSize: { type: 'radio', label: 'Text size', options: [{ label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }] },
      headingWeight: { type: 'radio', label: 'Heading weight', options: [{ label: 'Regular', value: 'normal' }, { label: 'Bold', value: 'bold' }, { label: 'Black', value: 'black' }] },
      headingCase: { type: 'radio', label: 'Heading case', options: [{ label: 'As typed', value: 'normal' }, { label: 'UPPERCASE', value: 'uppercase' }] },
      radius: { type: 'select', label: 'Corners', options: [{ label: 'Square', value: 'none' }, { label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }, { label: 'Extra large', value: 'xl' }] },
      buttonShape: { type: 'radio', label: 'Button shape', options: [{ label: 'Like corners', value: 'theme' }, { label: 'Pill', value: 'pill' }, { label: 'Square', value: 'square' }] },
      buttonStyle: { type: 'radio', label: 'Main buttons', options: [{ label: 'Filled', value: 'solid' }, { label: 'Outline', value: 'outline' }] },
      width: { type: 'select', label: 'Page width', options: [{ label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }, { label: 'Full width', value: 'full' }] },
      direction: { type: 'radio', label: 'Text direction', options: [{ label: 'Left → right', value: 'ltr' }, { label: 'Right → left', value: 'rtl' }] },
      effects: { type: 'radio', label: 'Background effect', options: [{ label: 'None', value: 'none' }, { label: 'Grid', value: 'grid' }, { label: 'Scanlines', value: 'scanlines' }] },
      showAskAi: { type: 'radio', label: '“Ask AI” button', options: [{ label: 'Show', value: 'yes' }, { label: 'Hide', value: 'no' }] },
    },
    defaultProps: DEFAULT_ROOT,
    render: ({ children, puck, ...props }) => {
      const { portfolio, assistant } = meta(puck);
      const classes = [
        'd-root',
        props.effects === 'grid' || props.effects === 'scanlines' ? `d-effect-${props.effects}` : '',
        recolorsClassic(props) ? 'd-recolor' : '',
        props.buttonStyle === 'outline' ? 'd-buttons-outline' : '',
        props.headingWeight === 'bold' ? 'd-headings-bold' : props.headingWeight === 'normal' ? 'd-headings-normal' : '',
        props.headingCase === 'uppercase' ? 'd-headings-upper' : '',
      ].filter(Boolean).join(' ');
      return (
        <div className={classes} style={themeVars(props)} dir={props.direction === 'rtl' ? 'rtl' : 'ltr'}>
          {children}
          {props.showAskAi !== 'no' && assistant && !puck.isEditing && (
            <AskAssistant name={portfolio.profile.name} email={portfolio.profile.socialLinks.email} linkedin={portfolio.profile.socialLinks.linkedin} />
          )}
        </div>
      );
    },
  },

  components: {
    /* ======================= Classic (original site) ======================= */
    ClassicShell: {
      label: 'Classic layout (sidebar + top bar)',
      fields: { content: { type: 'slot', label: 'Page sections' } },
      defaultProps: { content: [] },
      render: ({ content: Content, puck }) => (
        <div className="d-classic">
          <ClassicShell data={meta(puck).portfolio}><Content className="d-section-inner" minEmptyHeight={200} /></ClassicShell>
        </div>
      ),
    },
    ClassicHero: { label: 'Classic hero', render: ({ puck }) => <div className="d-classic"><ClassicHero data={meta(puck).portfolio} /></div> },
    ClassicAbout: { label: 'Classic hiring & stats', render: ({ puck }) => <div className="d-classic"><ClassicAbout data={meta(puck).portfolio} /></div> },
    ClassicSkills: { label: 'Classic tech stack', render: ({ puck }) => <div className="d-classic"><ClassicSkills data={meta(puck).portfolio} /></div> },
    ClassicProjects: { label: 'Classic projects', render: ({ puck }) => <div className="d-classic"><ClassicProjects data={meta(puck).portfolio} /></div> },
    ClassicExperience: { label: 'Classic experience', render: ({ puck }) => <div className="d-classic"><ClassicExperience data={meta(puck).portfolio} /></div> },
    ClassicContact: { label: 'Classic contact', render: ({ puck }) => <div className="d-classic"><ClassicContact data={meta(puck).portfolio} /></div> },
    ClassicFooter: { label: 'Classic footer', render: ({ puck }) => <div className="d-classic"><ClassicFooter data={meta(puck).portfolio} /></div> },

    /* ======================= Portfolio ======================= */
    NavBar: {
      label: 'Navigation bar',
      fields: {
        brand: { type: 'text', label: 'Brand (empty = your name)' },
        links: {
          type: 'array', label: 'Links',
          arrayFields: { label: { type: 'text', label: 'Label' }, href: { type: 'text', label: 'Link (#projects, /path or https://…)' } },
          defaultItemProps: { label: 'Link', href: '#' },
          getItemSummary: (item) => item.label || 'Link',
        },
        showResume: yesNo('Resume button'),
        sticky: { type: 'radio', label: 'Stick to top when scrolling', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
      },
      defaultProps: {
        brand: '', showResume: true, sticky: true,
        links: [{ label: 'Projects', href: '#projects' }, { label: 'Experience', href: '#experience' }, { label: 'Skills', href: '#skills' }, { label: 'Contact', href: '#contact' }],
      },
      render: ({ puck, ...props }) => <NavBar {...props} portfolio={meta(puck).portfolio} editing={puck.isEditing} />,
    },

    Hero: {
      label: 'Hero (name & intro)',
      fields: {
        variant: { type: 'select', label: 'Style', options: [{ label: 'Arcade (bold, terminal card)', value: 'arcade' }, { label: 'Centered with photo', value: 'centered' }, { label: 'Split (text + big photo)', value: 'split' }] },
        headline: { type: 'text', label: 'Headline (empty = your name)' },
        subheading: { type: 'text', label: 'Subheading (empty = your role)' },
        showPhoto: yesNo('Photo'), showTags: yesNo('Technology tags'), showSocial: yesNo('Social icons'), showStatus: yesNo('Availability & location'),
        primaryLabel: fromSiteText('Main button'), primaryHref: { type: 'text', label: 'Main button link' },
        secondaryLabel: fromSiteText('Second button'), secondaryHref: { type: 'text', label: 'Second button link' },
      },
      defaultProps: {
        variant: 'centered', headline: '', subheading: '', showPhoto: true, showTags: true, showSocial: true, showStatus: true,
        primaryLabel: '', primaryHref: '#projects', secondaryLabel: '', secondaryHref: '#contact',
      },
      render: ({ puck, ...props }) => <Hero {...props} portfolio={meta(puck).portfolio} />,
    },

    HiringSnapshot: {
      label: 'Hiring snapshot',
      fields: { title: { type: 'text', label: 'Title' } },
      defaultProps: { title: 'Hiring snapshot' },
      render: ({ puck, title }) => <Hiring portfolio={meta(puck).portfolio} title={title} editing={puck.isEditing} />,
    },

    Stats: {
      label: 'Stats',
      fields: { style: { type: 'radio', label: 'Style', options: [{ label: 'Cards', value: 'cards' }, { label: 'Inline', value: 'inline' }] } },
      defaultProps: { style: 'cards' },
      render: ({ puck, style }) => <Stats portfolio={meta(puck).portfolio} style={style} />,
    },

    Skills: {
      label: 'Skills',
      fields: {
        layout: { type: 'radio', label: 'Layout', options: [{ label: 'Cards', value: 'cards' }, { label: 'Tag cloud', value: 'tags' }, { label: 'List', value: 'list' }] },
        align: align2Field,
        eyebrow: fromSiteText('Small label'), title: fromSiteText('Title'), description: fromSiteText('Description'),
      },
      defaultProps: { layout: 'cards', align: 'left', eyebrow: '', title: '', description: '' },
      render: ({ puck, ...props }) => <Skills {...props} portfolio={meta(puck).portfolio} />,
    },

    Projects: {
      label: 'Projects',
      fields: {
        layout: { type: 'radio', label: 'Layout', options: [{ label: 'Grid', value: 'grid' }, { label: 'List', value: 'list' }] },
        columns: { type: 'radio', label: 'Columns (grid)', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }] },
        filter: { type: 'radio', label: 'Show', options: [{ label: 'All published', value: 'all' }, { label: 'Featured only', value: 'featured' }] },
        limit: { type: 'number', label: 'Max projects (0 = all)', min: 0, max: 50 },
        showStack: yesNo('Tech stack tags'),
        align: align2Field,
        eyebrow: fromSiteText('Small label'), title: fromSiteText('Title'),
      },
      defaultProps: { layout: 'grid', columns: '3', filter: 'all', limit: 0, showStack: true, align: 'left', eyebrow: '', title: '' },
      render: ({ puck, ...props }) => <Projects {...props} portfolio={meta(puck).portfolio} />,
    },

    Experience: {
      label: 'Experience',
      fields: {
        layout: { type: 'radio', label: 'Layout', options: [{ label: 'Timeline', value: 'timeline' }, { label: 'Cards', value: 'cards' }, { label: 'Compact', value: 'compact' }] },
        maxBullets: { type: 'number', label: 'Highlights per job (0 = all)', min: 0, max: 20 },
        align: align2Field,
        eyebrow: fromSiteText('Small label'), title: fromSiteText('Title'), description: fromSiteText('Description'),
      },
      defaultProps: { layout: 'timeline', maxBullets: 0, align: 'left', eyebrow: '', title: '', description: '' },
      render: ({ puck, ...props }) => <Experience {...props} portfolio={meta(puck).portfolio} />,
    },

    Contact: {
      label: 'Contact',
      fields: {
        style: { type: 'radio', label: 'Style', options: [{ label: 'Card', value: 'card' }, { label: 'Plain', value: 'plain' }] },
        align: align2Field,
        eyebrow: fromSiteText('Small label'), title: fromSiteText('Title'), description: fromSiteText('Description'), buttonLabel: fromSiteText('Email button'),
      },
      defaultProps: { style: 'card', align: 'center', eyebrow: '', title: '', description: '', buttonLabel: '' },
      render: ({ puck, ...props }) => <Contact {...props} portfolio={meta(puck).portfolio} />,
    },

    SocialLinks: {
      label: 'Social links',
      fields: { align: align2Field, labels: { type: 'radio', label: 'Labels', options: [{ label: 'Icons only', value: false }, { label: 'Icons + names', value: true }] } },
      defaultProps: { align: 'left', labels: false },
      render: ({ puck, align, labels }) => <div className="d-prim py-2"><SocialIcons profile={meta(puck).portfolio.profile} align={align} labels={labels} /></div>,
    },

    ResumeButton: {
      label: 'Resume download',
      fields: { label: { type: 'text', label: 'Label' }, style: { type: 'radio', label: 'Style', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }] }, align: alignField },
      defaultProps: { label: 'Download resume', style: 'primary', align: 'left' },
      render: ({ label, style, align }) => (
        <div className={`d-prim flex py-2 ${justifyClass(align)}`}>
          <a href="/api/resume" className={`d-btn d-btn-${style}`}><Icon name="download" size={16} /> {label || 'Download resume'}</a>
        </div>
      ),
    },

    Footer: {
      label: 'Footer',
      fields: { text: fromSiteText('Text'), showSocial: yesNo('Social icons') },
      defaultProps: { text: '', showSocial: true },
      render: ({ puck, text, showSocial }) => <Footer portfolio={meta(puck).portfolio} text={text} showSocial={showSocial} />,
    },

    /* ======================= Layout ======================= */
    Section: {
      label: 'Section',
      fields: {
        content: { type: 'slot', label: 'Content' },
        background: { type: 'select', label: 'Background', options: [{ label: 'None', value: 'none' }, { label: 'Surface', value: 'surface' }, { label: 'Soft', value: 'soft' }, { label: 'Accent tint', value: 'accent' }, { label: 'Inverted', value: 'inverted' }] },
        padding: { type: 'radio', label: 'Spacing', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }] },
        anchor: { type: 'text', label: 'Anchor id (for links like #about)' },
        contained: { type: 'radio', label: 'Width', options: [{ label: 'Page width', value: true }, { label: 'Full width', value: false }] },
      },
      defaultProps: { content: [], background: 'none', padding: 'md', anchor: '', contained: true },
      render: ({ content: Content, background, padding, anchor, contained }) => {
        const id = anchor.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || undefined;
        const pad = { sm: 'py-6', md: 'py-10 md:py-14', lg: 'py-14 md:py-20', xl: 'py-20 md:py-32' }[padding];
        return (
          <section id={id} className={`d-section scroll-mt-20 ${background !== 'none' ? `d-section-${background}` : ''} ${pad}`}>
            <div className={contained ? 'd-container' : 'px-4'}><Content className="d-section-inner grid gap-4" minEmptyHeight={120} /></div>
          </section>
        );
      },
    },

    Columns: {
      label: 'Columns',
      fields: {
        count: { type: 'radio', label: 'Columns', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }] },
        ratio: { type: 'select', label: 'Widths (2 columns)', options: [{ label: 'Equal', value: 'equal' }, { label: 'Wide left', value: 'wide-left' }, { label: 'Wide right', value: 'wide-right' }] },
        gap: { type: 'radio', label: 'Gap', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }] },
        align: { type: 'radio', label: 'Vertical align', options: [{ label: 'Top', value: 'start' }, { label: 'Center', value: 'center' }] },
        column1: { type: 'slot', label: 'Column 1' }, column2: { type: 'slot', label: 'Column 2' },
        column3: { type: 'slot', label: 'Column 3' }, column4: { type: 'slot', label: 'Column 4' },
      },
      defaultProps: { count: '2', ratio: 'equal', gap: 'md', align: 'start', column1: [], column2: [], column3: [], column4: [] },
      render: ({ count, ratio, gap, align, column1: C1, column2: C2, column3: C3, column4: C4 }) => {
        const n = Number(count) || 2;
        const template = n === 2 ? { equal: 'md:grid-cols-2', 'wide-left': 'md:grid-cols-[2fr_1fr]', 'wide-right': 'md:grid-cols-[1fr_2fr]' }[ratio] : n === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
        const gaps = { sm: 'gap-3', md: 'gap-6', lg: 'gap-10' }[gap];
        const slots = [C1, C2, C3, C4].slice(0, n);
        return (
          <div className={`d-prim d-columns grid ${template} ${gaps} ${align === 'center' ? 'items-center' : 'items-start'}`}>
            {slots.map((Slot, index) => <Slot key={index} className="d-col grid min-w-0 gap-4" minEmptyHeight={80} />)}
          </div>
        );
      },
    },

    Card: {
      label: 'Card',
      fields: {
        content: { type: 'slot', label: 'Content' },
        padding: { type: 'radio', label: 'Padding', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }] },
        tone: { type: 'radio', label: 'Tone', options: [{ label: 'Surface', value: 'surface' }, { label: 'Soft', value: 'soft' }, { label: 'Accent', value: 'accent' }] },
      },
      defaultProps: { content: [], padding: 'md', tone: 'surface' },
      render: ({ content: Content, padding, tone }) => (
        <div className="d-prim"><div className={`d-card ${{ sm: 'p-4', md: 'p-6', lg: 'p-8 md:p-10' }[padding]}`}
          style={tone === 'soft' ? { background: 'var(--d-surface-2)' } : tone === 'accent' ? { background: 'color-mix(in srgb, var(--d-accent) 9%, var(--d-surface))', borderColor: 'color-mix(in srgb, var(--d-accent) 35%, transparent)' } : undefined}>
          <Content className="d-cardbox grid gap-3" minEmptyHeight={60} />
        </div></div>
      ),
    },

    Spacer: {
      label: 'Spacer',
      fields: { size: { type: 'radio', label: 'Size', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }] } },
      defaultProps: { size: 'md' },
      render: ({ size }) => <div aria-hidden="true" className={{ sm: 'h-4', md: 'h-10', lg: 'h-20', xl: 'h-32' }[size]} />,
    },

    Divider: {
      label: 'Divider',
      fields: { style: { type: 'radio', label: 'Style', options: [{ label: 'Line', value: 'line' }, { label: 'Dots', value: 'dots' }] } },
      defaultProps: { style: 'line' },
      render: ({ style }) => style === 'dots'
        ? <div className="d-prim d-muted py-4 text-center tracking-[1em]" aria-hidden="true">•••</div>
        : <div className="d-prim py-4"><hr className="border-0 border-t" style={{ borderColor: 'var(--d-line)' }} /></div>,
    },

    /* ======================= Text & media ======================= */
    Heading: {
      label: 'Heading',
      fields: {
        eyebrow: { type: 'text', label: 'Small label above (optional)' },
        text: { type: 'text', label: 'Heading', contentEditable: true },
        level: { type: 'select', label: 'HTML level', options: [{ label: 'H1 (page title)', value: 'h1' }, { label: 'H2', value: 'h2' }, { label: 'H3', value: 'h3' }, { label: 'H4', value: 'h4' }] },
        size: { type: 'radio', label: 'Size', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }] },
        align: alignField,
        uppercase: { type: 'radio', label: 'Uppercase', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
      },
      defaultProps: { eyebrow: '', text: 'Heading', level: 'h2', size: 'lg', align: 'left', uppercase: false },
      render: ({ eyebrow, text, level, size, align, uppercase }) => {
        const Tag = (['h1', 'h2', 'h3', 'h4'].includes(level) ? level : 'h2') as 'h2';
        const sizes = { sm: 'text-xl', md: 'text-2xl md:text-3xl', lg: 'text-3xl md:text-5xl', xl: 'text-4xl md:text-7xl' };
        return (
          <div className={`d-prim ${alignClass(align)}`}>
            {eyebrow && <p className="d-eyebrow mb-2">{eyebrow}</p>}
            <Tag className={`${sizes[size]} font-black tracking-tight ${uppercase ? 'uppercase' : ''}`}>{text}</Tag>
          </div>
        );
      },
    },

    Text: {
      label: 'Text',
      fields: {
        text: { type: 'textarea', label: 'Text (blank line = new paragraph)', contentEditable: true },
        size: { type: 'radio', label: 'Size', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }] },
        tone: { type: 'radio', label: 'Color', options: [{ label: 'Normal', value: 'normal' }, { label: 'Muted', value: 'muted' }, { label: 'Accent', value: 'accent' }] },
        align: alignField,
        maxWidth: { type: 'radio', label: 'Line length', options: [{ label: 'Full', value: 'none' }, { label: 'Readable', value: 'prose' }] },
      },
      defaultProps: { text: 'Write something here.', size: 'md', tone: 'muted', align: 'left', maxWidth: 'prose' },
      render: ({ text, size, tone, align, maxWidth }) => (
        <div className={`d-prim grid gap-3 ${alignClass(align)} ${{ sm: 'text-sm leading-6', md: 'text-base leading-7', lg: 'text-lg leading-8 md:text-xl' }[size]} ${tone === 'muted' ? 'd-muted' : tone === 'accent' ? 'd-accent' : ''}`}>
          {/* While editing, Puck passes an inline-editable element instead of the plain string. */}
          {(typeof text === 'string' ? text.split(/\n\s*\n/) : [text]).map((paragraph, index) => (
            <p key={index} className={`whitespace-pre-line ${maxWidth === 'prose' ? `max-w-[65ch] ${align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : ''}` : ''}`}>{paragraph}</p>
          ))}
        </div>
      ),
    },

    Button: {
      label: 'Button',
      fields: {
        label: { type: 'text', label: 'Label' },
        href: { type: 'text', label: 'Link (#section, /path, https://… or mailto:)' },
        style: { type: 'radio', label: 'Style', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }, { label: 'Link', value: 'ghost' }] },
        align: alignField,
        newTab: { type: 'radio', label: 'Open in new tab', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
      },
      defaultProps: { label: 'Button', href: '#contact', style: 'primary', align: 'left', newTab: false },
      render: ({ label, href, style, align, newTab }) => (
        <div className={`d-prim flex py-1 ${justifyClass(align)}`}>
          <a href={safeHref(href) ?? '#'} className={`d-btn d-btn-${style}`} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{label}</a>
        </div>
      ),
    },

    Image: {
      label: 'Image',
      fields: {
        src: { type: 'text', label: 'Image URL (https://… or /images/…)' },
        alt: { type: 'text', label: 'Description (for screen readers & SEO)' },
        aspect: { type: 'select', label: 'Shape', options: [{ label: 'Original', value: 'auto' }, { label: 'Square', value: 'square' }, { label: 'Wide (16:9)', value: 'video' }, { label: 'Portrait (4:5)', value: 'portrait' }] },
        rounded: { type: 'radio', label: 'Rounded corners', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
        maxWidth: { type: 'radio', label: 'Size', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'Full', value: 'full' }] },
        align: alignField,
      },
      defaultProps: { src: '', alt: '', aspect: 'auto', rounded: true, maxWidth: 'full', align: 'center' },
      render: ({ src, alt, aspect, rounded, maxWidth, align, puck }) => {
        const url = safeSrc(src);
        const width = { sm: 'max-w-xs', md: 'max-w-md', lg: 'max-w-2xl', full: 'max-w-full' }[maxWidth];
        const shape = { auto: '', square: 'aspect-square object-cover', video: 'aspect-video object-cover', portrait: 'aspect-[4/5] object-cover' }[aspect];
        if (!url) return puck.isEditing ? <div className="d-prim d-placeholder">Add an image URL in the settings panel.</div> : <></>;
        return (
          <div className={`d-prim flex ${justifyClass(align)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} loading="lazy" className={`w-full ${width} ${shape}`} style={rounded ? { borderRadius: 'var(--d-radius)' } : undefined} />
          </div>
        );
      },
    },

    List: {
      label: 'List',
      fields: {
        items: { type: 'array', label: 'Items', arrayFields: { text: { type: 'text', label: 'Text' } }, defaultItemProps: { text: 'New item' }, getItemSummary: (item) => item.text || 'Item' },
        style: { type: 'radio', label: 'Style', options: [{ label: '• Bullets', value: 'bullets' }, { label: '✓ Checks', value: 'checks' }, { label: '1. Numbers', value: 'numbers' }] },
      },
      defaultProps: { items: [{ text: 'First point' }, { text: 'Second point' }], style: 'checks' },
      render: ({ items, style }) => {
        const Tag = style === 'numbers' ? 'ol' : 'ul';
        return (
          <Tag className={`d-prim grid gap-2 text-base ${style === 'numbers' ? 'list-decimal pl-6' : 'list-none'}`}>
            {(items ?? []).map((item, index) => (
              <li key={index} className={style === 'numbers' ? '' : 'flex gap-3'}>
                {style !== 'numbers' && <span className="d-accent shrink-0 font-black">{style === 'checks' ? '✓' : '•'}</span>}
                <span>{item.text}</span>
              </li>
            ))}
          </Tag>
        );
      },
    },
  },
};

// Only small, safe blocks go inside Sections, Columns and Cards (no nav bars inside columns, etc.).
for (const name of ['Columns', 'Card'] as const) {
  const fields = designConfig.components[name].fields as Record<string, { type: string; allow?: string[] }>;
  for (const field of Object.values(fields)) if (field.type === 'slot') field.allow = INNER_BLOCKS;
}

// Every block gets the same "Style" settings (colors, background, spacing, width, corners…), applied by <Styled>.
for (const [name, component] of Object.entries(designConfig.components) as [string, { fields?: Record<string, unknown>; defaultProps?: Record<string, unknown>; render: (props: never) => React.ReactNode }][]) {
  const render = component.render;
  const panel = name.startsWith('Classic');
  component.fields = { ...(component.fields ?? {}), appearance: appearanceField };
  component.defaultProps = { ...(component.defaultProps ?? {}), appearance: DEFAULT_APPEARANCE };
  component.render = ((props: { appearance?: Appearance; puck: { isEditing: boolean } }) => (
    <Styled appearance={props.appearance} editing={props.puck.isEditing} panel={panel}>{render(props as never)}</Styled>
  )) as never;
}
