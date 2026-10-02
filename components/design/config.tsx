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
import { colorField, spacingField, sidesVars, type Sides } from './appearance';
import { STYLE_DEFAULTS, STYLE_KEYS, StyledBlock, styleFields, viewField, type StyleProps } from './style-panel';
import { addStarters } from './starters';
import { BUTTON_ACTIONS, IMAGE_SOURCES, TAG_SOURCES, TEXT_SOURCES, boundTags, boundText } from '@/lib/design/bindings';
import { ContactButtons } from './contact-buttons';
import {
  Box, ChoicesBlock, FaqBlock, FormBlock, IconBlock, InputBlock, LinkBlock, QuoteBlock, SelectBlock, TextAreaBlock, VideoBlock,
  type BoxProps, type ChoicesProps, type FaqProps, type FormProps, type IconProps, type InputProps, type LinkProps, type QuoteProps,
  type SelectProps, type TextAreaProps, type VideoProps,
} from './builder-blocks';

/** Passed to Puck as `metadata`: the live content blocks render. */
export type DesignMetadata = { portfolio: PortfolioData; assistant: boolean };
const meta = (puck: { metadata: Record<string, unknown> }) => puck.metadata as unknown as DesignMetadata;

type Align = 'left' | 'center' | 'right';

type Components = {
  // Classic (the original site, section by section)
  ClassicShell: { content: Slot; sidebar: boolean; topBar: boolean; panelWidth: 'default' | '5xl' | '6xl' | 'full'; panelPadding: Sides; panelPaddingMobile: Sides; sectionGap: number };
  ClassicHero: { extra: Slot };
  ClassicAbout: Record<string, never>;
  ClassicSkills: Record<string, never>;
  ClassicProjects: Record<string, never>;
  ClassicExperience: Record<string, never>;
  ClassicContact: { extra: Slot };
  ClassicFooter: Record<string, never>;
  // Portfolio (live content)
  NavBar: NavProps;
  Hero: HeroProps & { extra: Slot };
  HiringSnapshot: { title: string };
  Stats: { style: 'cards' | 'inline' };
  Skills: SkillsProps;
  Projects: ProjectsProps;
  Experience: ExperienceProps;
  Contact: ContactProps & { extra: Slot };
  SocialLinks: { align: 'left' | 'center'; labels: boolean };
  ResumeButton: { label: string; style: 'primary' | 'secondary'; align: Align };
  Footer: { text: string; showSocial: boolean };
  // Layout
  Section: { content: Slot; background: 'none' | 'surface' | 'soft' | 'accent' | 'inverted'; padding: 'sm' | 'md' | 'lg' | 'xl'; anchor: string; contained: boolean };
  Columns: { count: '2' | '3' | '4'; ratio: 'equal' | 'wide-left' | 'wide-right'; gap: 'sm' | 'md' | 'lg'; align: 'start' | 'center'; column1: Slot; column2: Slot; column3: Slot; column4: Slot };
  Card: { content: Slot; padding: 'sm' | 'md' | 'lg'; tone: 'surface' | 'soft' | 'accent' };
  Flex: { items: Slot; direction: 'row' | 'column'; gap: number; align: 'stretch' | 'start' | 'center' | 'end'; justify: 'start' | 'center' | 'end' | 'between' | 'around'; wrap: boolean; stackOnMobile: boolean };
  Grid: { items: Slot; columns: string; columnsTablet: string; columnsMobile: '1' | '2'; gap: number; align: 'stretch' | 'start' | 'center' | 'end' };
  Spacer: { size: 'sm' | 'md' | 'lg' | 'xl'; height: number };
  Divider: { style: 'line' | 'dots' };
  // Basic
  Heading: { source: string; text: string; eyebrow: string; level: 'h1' | 'h2' | 'h3' | 'h4'; size: string; sizePx: number; weight: string; font: string; tracking: string; align: Align; uppercase: boolean };
  Text: { source: string; text: string; size: string; sizePx: number; weight: string; font: string; tracking: string; align: Align; tone: 'normal' | 'muted' | 'accent' | 'accent2'; maxWidth: 'none' | 'prose'; uppercase: boolean };
  Button: { action: string; label: string; href: string; style: 'primary' | 'secondary' | 'ghost'; size: 'sm' | 'md' | 'lg'; icon: string; align: Align; fullWidthMobile: boolean; newTab: boolean };
  Image: { source: string; src: string; alt: string; aspect: 'auto' | 'square' | 'circle' | 'video' | 'portrait'; rounded: boolean; maxWidth: 'xs' | 'sm' | 'md' | 'lg' | 'full'; align: Align };
  Tags: { source: string; items: { text: string }[]; style: 'soft' | 'accent' | 'outline'; align: Align };
  Badge: { source: string; text: string; dot: boolean; style: 'pill' | 'plain'; align: Align };
  ContactButtons: { buttonLabel: string; align: 'left' | 'center' };
  List: { items: { text: string }[]; style: 'bullets' | 'checks' | 'numbers' };
  // Build from scratch (components/design/builder-blocks.tsx)
  Box: BoxProps;
  Link: LinkProps;
  Icon: IconProps;
  Video: VideoProps;
  Quote: QuoteProps;
  Faq: FaqProps;
  Form: FormProps;
  InputField: InputProps;
  TextAreaField: TextAreaProps;
  SelectField: SelectProps;
  ChoicesField: ChoicesProps;
  // Quick add: ready-made Box layouts (components/design/starters.ts)
  QuickBanner: BoxProps; QuickTextImage: BoxProps; QuickFeatures: BoxProps; QuickStats: BoxProps; QuickContact: BoxProps; QuickFaq: BoxProps; QuickTestimonials: BoxProps;
};

// ---------- reusable field definitions ----------
const yesNo = (label: string) => ({ type: 'radio' as const, label, options: [{ label: 'Show', value: true }, { label: 'Hide', value: false }] });
const alignField = { type: 'radio' as const, label: 'Align', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] };
const align2Field = { type: 'radio' as const, label: 'Align', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }] };
const fromSiteText = (label: string) => ({ type: 'text' as const, label: `${label} (empty = site text, - = hide)` });
const alignClass = (align: Align) => ({ left: 'text-left', center: 'text-center', right: 'text-right' })[align] ?? 'text-left';
const justifyClass = (align: Align) => ({ left: 'justify-start', center: 'justify-center', right: 'justify-end' })[align] ?? 'justify-start';

// Typography options shared by Heading and Text.
const HEADING_SIZES = [{ label: 'XS', value: 'xs' }, { label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }, { label: '2XL', value: '2xl' }];
const TEXT_SIZES = [{ label: 'XS', value: 'xs' }, { label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }];
const WEIGHT_OPTIONS = [{ label: 'Default', value: 'default' }, { label: 'Light', value: 'light' }, { label: 'Regular', value: 'normal' }, { label: 'Medium', value: 'medium' }, { label: 'Bold', value: 'bold' }, { label: 'Black', value: 'black' }];
const FONT_ROLE_OPTIONS = [{ label: 'Heading font', value: 'heading' }, { label: 'Body font', value: 'body' }, { label: 'Monospace', value: 'mono' }];
const TRACKING_OPTIONS = [{ label: 'Default', value: 'default' }, { label: 'Tight', value: 'tight' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }, { label: 'Extra wide', value: 'widest' }];
const weightClass = (weight: string, fallback: string) =>
  ({ light: 'font-light', normal: 'font-normal', medium: 'font-medium', bold: 'font-bold', black: 'font-black' } as Record<string, string>)[weight] ?? fallback;
function typeStyle(sizePx: number, font: string, tracking: string) {
  const style: Record<string, string> = {};
  if (Number(sizePx) > 0) { style.fontSize = `${Math.min(200, Number(sizePx))}px`; style.lineHeight = '1.2'; }
  if (font === 'heading') style.fontFamily = 'var(--d-heading-font)';
  if (font === 'body') style.fontFamily = 'var(--d-body-font)';
  if (font === 'mono') style.fontFamily = FONTS.mono.stack;
  const spacing = ({ tight: '-0.02em', normal: '0', wide: '0.08em', widest: '0.25em' } as Record<string, string>)[tracking];
  if (spacing) style.letterSpacing = spacing;
  return style;
}

/** Every block name; lib/design/store.ts checks its allow-list against this at compile time. */
export type DesignBlockName = keyof Components;

export const designConfig: Config<Components, RootProps> = {
  categories: {
    quick: { title: 'Quick add: ready-made layouts', components: ['QuickBanner', 'QuickTextImage', 'QuickFeatures', 'QuickStats', 'QuickContact', 'QuickFaq', 'QuickTestimonials'], defaultExpanded: true },
    layout: { title: 'Layout: boxes & containers', components: ['Box', 'Section', 'Flex', 'Grid', 'Columns', 'Card', 'Spacer', 'Divider'], defaultExpanded: true },
    basic: { title: 'Basic elements', components: ['Heading', 'Text', 'Button', 'Link', 'Image', 'Icon', 'Video', 'List', 'Quote', 'Faq', 'Tags', 'Badge'], defaultExpanded: true },
    forms: { title: 'Forms', components: ['Form', 'InputField', 'TextAreaField', 'SelectField', 'ChoicesField'], defaultExpanded: true },
    yourData: { title: 'Your details (live)', components: ['ContactButtons', 'SocialLinks', 'ResumeButton'], defaultExpanded: true },
    portfolio: { title: 'Ready-made sections (live content)', components: ['NavBar', 'Hero', 'HiringSnapshot', 'Stats', 'Skills', 'Projects', 'Experience', 'Contact', 'Footer'], defaultExpanded: true },
    classic: { title: 'Classic (original site)', components: ['ClassicShell', 'ClassicHero', 'ClassicAbout', 'ClassicSkills', 'ClassicProjects', 'ClassicExperience', 'ClassicContact', 'ClassicFooter'], defaultExpanded: false },
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
      fields: {
        content: { type: 'slot', label: 'Page sections' },
        sidebar: { type: 'radio', label: 'Sidebar (desktop)', options: [{ label: 'Show', value: true }, { label: 'Hide', value: false }] },
        topBar: { type: 'radio', label: 'Top status bar', options: [{ label: 'Show', value: true }, { label: 'Hide', value: false }] },
        panelWidth: { type: 'select', label: 'Main panel width', options: [{ label: 'Default (1280px)', value: 'default' }, { label: 'Narrower (1024px)', value: '5xl' }, { label: 'Medium (1152px)', value: '6xl' }, { label: 'Full width', value: 'full' }] },
        panelPadding: spacingField('Main panel padding', 'Space around all sections. Empty = default (20px top/bottom, 32px sides).'),
        panelPaddingMobile: spacingField('Main panel padding on phones', 'Empty sides use the padding above, or the default (20px top/bottom, 16px sides).'),
        sectionGap: { type: 'number', label: 'Extra space between sections (px)', min: 0, max: 200 },
      },
      defaultProps: { content: [], sidebar: true, topBar: true, panelWidth: 'default', panelPadding: {}, panelPaddingMobile: {}, sectionGap: 0 },
      render: ({ content: Content, puck, sidebar, topBar, panelWidth, panelPadding, panelPaddingMobile, sectionGap }) => {
        const vars = sidesVars(panelPadding, panelPaddingMobile, { top: '20', right: '32', bottom: '20', left: '32' }, { top: '20', right: '16', bottom: '20', left: '16' });
        const custom = panelWidth !== 'default' || Object.keys(vars.set).length > 0;
        const width = { default: 'max-w-7xl', '5xl': 'max-w-5xl', '6xl': 'max-w-6xl', full: 'max-w-none' }[panelWidth] ?? 'max-w-7xl';
        const gap = Math.max(0, Math.min(200, Number(sectionGap) || 0));
        return (
          <div className="d-classic">
            <ClassicShell
              data={meta(puck).portfolio}
              options={{ hideSidebar: sidebar === false, hideTopBar: topBar === false, ...(custom ? { panelClassName: `d-padded mx-auto ${width}`, panelStyle: vars.style } : {}) }}
            >
              <Content className="d-section-inner" minEmptyHeight={200} style={gap ? { display: 'grid', gap: `${gap}px` } : undefined} />
            </ClassicShell>
          </div>
        );
      },
    },
    ClassicHero: {
      label: 'Classic hero',
      fields: { extra: { type: 'slot', label: 'Your blocks (under the buttons)' } },
      defaultProps: { extra: [] },
      render: ({ puck, extra: Extra }) => <div className="d-classic"><ClassicHero data={meta(puck).portfolio} extra={<Extra className="d-slot-extra" minEmptyHeight={48} />} /></div>,
    },
    ClassicAbout: { label: 'Classic hiring & stats', render: ({ puck }) => <div className="d-classic"><ClassicAbout data={meta(puck).portfolio} /></div> },
    ClassicSkills: { label: 'Classic tech stack', render: ({ puck }) => <div className="d-classic"><ClassicSkills data={meta(puck).portfolio} /></div> },
    ClassicProjects: { label: 'Classic projects', render: ({ puck }) => <div className="d-classic"><ClassicProjects data={meta(puck).portfolio} /></div> },
    ClassicExperience: { label: 'Classic experience', render: ({ puck }) => <div className="d-classic"><ClassicExperience data={meta(puck).portfolio} /></div> },
    ClassicContact: {
      label: 'Classic contact',
      fields: { extra: { type: 'slot', label: 'Your blocks (under the buttons)' } },
      defaultProps: { extra: [] },
      render: ({ puck, extra: Extra }) => <div className="d-classic"><ClassicContact data={meta(puck).portfolio} extra={<Extra className="d-slot-extra" minEmptyHeight={48} />} /></div>,
    },
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
        extra: { type: 'slot', label: 'Your blocks (under the buttons)' },
      },
      defaultProps: {
        variant: 'centered', headline: '', subheading: '', showPhoto: true, showTags: true, showSocial: true, showStatus: true,
        primaryLabel: '', primaryHref: '#projects', secondaryLabel: '', secondaryHref: '#contact', extra: [],
      },
      render: ({ puck, extra: Extra, ...props }) => <Hero {...props} portfolio={meta(puck).portfolio} extra={<Extra className="d-slot-extra" minEmptyHeight={48} />} />,
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
        extra: { type: 'slot', label: 'Your blocks (under the buttons)' },
      },
      defaultProps: { style: 'card', align: 'center', eyebrow: '', title: '', description: '', buttonLabel: '', extra: [] },
      render: ({ puck, extra: Extra, ...props }) => <Contact {...props} portfolio={meta(puck).portfolio} extra={<Extra className="d-slot-extra" minEmptyHeight={48} />} />,
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

    Flex: {
      label: 'Row / Stack (flex)',
      fields: {
        items: { type: 'slot', label: 'Items' },
        direction: { type: 'radio', label: 'Direction', options: [{ label: 'Row →', value: 'row' }, { label: 'Stack ↓', value: 'column' }] },
        gap: { type: 'number', label: 'Space between items (gap, px)', min: 0, max: 200 },
        align: { type: 'select', label: 'Line up across (align items)', options: [{ label: 'Stretch', value: 'stretch' }, { label: 'Start', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'end' }] },
        justify: { type: 'select', label: 'Spread along the row (justify)', options: [{ label: 'Start', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'end' }, { label: 'Space between', value: 'between' }, { label: 'Space around', value: 'around' }] },
        wrap: { type: 'radio', label: 'Wrap onto the next line (wrap)', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
        stackOnMobile: { type: 'radio', label: 'On phones', options: [{ label: 'Stack items', value: true }, { label: 'Keep direction', value: false }] },
      },
      defaultProps: { items: [], direction: 'row', gap: 16, align: 'center', justify: 'start', wrap: true, stackOnMobile: false },
      render: ({ items: Items, direction, gap, align, justify, wrap, stackOnMobile }) => {
        const dir = direction === 'column' ? 'flex-col' : stackOnMobile ? 'flex-col md:flex-row' : 'flex-row';
        const alignCls = { stretch: 'items-stretch', start: 'items-start', center: 'items-center', end: 'items-end' }[align] ?? 'items-stretch';
        const justifyCls = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around' }[justify] ?? 'justify-start';
        return (
          <div className="d-prim">
            <Items className={`d-flex flex min-w-0 ${dir} ${wrap ? 'flex-wrap' : ''} ${alignCls} ${justifyCls} ${direction === 'row' && stackOnMobile ? 'max-md:items-stretch' : ''}`} style={{ gap: `${Math.max(0, Math.min(200, Number(gap) || 0))}px` }} minEmptyHeight={64} />
          </div>
        );
      },
    },

    Grid: {
      label: 'Grid',
      fields: {
        items: { type: 'slot', label: 'Items' },
        columns: { type: 'select', label: 'Columns (desktop)', options: ['1', '2', '3', '4', '5', '6'].map((value) => ({ label: value, value })) },
        columnsTablet: { type: 'select', label: 'Columns (tablet)', options: ['1', '2', '3', '4'].map((value) => ({ label: value, value })) },
        columnsMobile: { type: 'radio', label: 'Columns (phone)', options: [{ label: '1', value: '1' }, { label: '2', value: '2' }] },
        gap: { type: 'number', label: 'Space between items (gap, px)', min: 0, max: 200 },
        align: { type: 'select', label: 'Align items', options: [{ label: 'Stretch', value: 'stretch' }, { label: 'Top', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'Bottom', value: 'end' }] },
      },
      defaultProps: { items: [], columns: '3', columnsTablet: '2', columnsMobile: '1', gap: 16, align: 'stretch' },
      render: ({ items: Items, columns, columnsTablet, columnsMobile, gap, align }) => {
        const desktop = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }[Number(columns) as 1] ?? 'lg:grid-cols-3';
        const tablet = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[Number(columnsTablet) as 1] ?? 'md:grid-cols-2';
        const phone = columnsMobile === '2' ? 'grid-cols-2' : 'grid-cols-1';
        const alignCls = { stretch: 'items-stretch', start: 'items-start', center: 'items-center', end: 'items-end' }[align] ?? 'items-stretch';
        return (
          <div className="d-prim">
            <Items className={`d-grid grid min-w-0 ${phone} ${tablet} ${desktop} ${alignCls}`} style={{ gap: `${Math.max(0, Math.min(200, Number(gap) || 0))}px` }} minEmptyHeight={64} />
          </div>
        );
      },
    },

    Spacer: {
      label: 'Spacer',
      fields: {
        size: { type: 'radio', label: 'Size', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }] },
        height: { type: 'number', label: 'Exact height (px, overrides size)', min: 0, max: 600 },
      },
      defaultProps: { size: 'md', height: 0 },
      render: ({ size, height }) => Number(height) > 0
        ? <div aria-hidden="true" style={{ height: `${Math.min(600, Number(height))}px` }} />
        : <div aria-hidden="true" className={{ sm: 'h-4', md: 'h-10', lg: 'h-20', xl: 'h-32' }[size]} />,
    },

    Divider: {
      label: 'Divider',
      fields: { style: { type: 'radio', label: 'Style', options: [{ label: 'Line', value: 'line' }, { label: 'Dots', value: 'dots' }] } },
      defaultProps: { style: 'line' },
      render: ({ style }) => style === 'dots'
        ? <div className="d-prim d-muted py-4 text-center tracking-[1em]" aria-hidden="true">•••</div>
        : <div className="d-prim py-4"><hr className="border-0 border-t" style={{ borderColor: 'var(--d-line)' }} /></div>,
    },

    /* ======================= Elements (text & media, optionally showing live data) ======================= */
    Heading: {
      label: 'Heading',
      fields: {
        source: { type: 'select', label: 'Content', options: TEXT_SOURCES.map(({ value, label }) => ({ value, label })) },
        text: { type: 'text', label: 'Heading (when content is “My own text”)', contentEditable: true },
        eyebrow: { type: 'text', label: 'Small label above (optional)' },
        level: { type: 'select', label: 'HTML level (SEO)', options: [{ label: 'H1 (page title)', value: 'h1' }, { label: 'H2', value: 'h2' }, { label: 'H3', value: 'h3' }, { label: 'H4', value: 'h4' }] },
        size: { type: 'select', label: 'Size', options: HEADING_SIZES },
        sizePx: { type: 'number', label: 'Exact size (px, overrides size)', min: 0, max: 200 },
        weight: { type: 'select', label: 'Weight', options: WEIGHT_OPTIONS },
        font: { type: 'select', label: 'Font', options: FONT_ROLE_OPTIONS },
        tracking: { type: 'select', label: 'Letter spacing', options: TRACKING_OPTIONS },
        align: alignField,
        uppercase: { type: 'radio', label: 'Uppercase', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
      },
      defaultProps: { source: 'custom', text: 'Heading', eyebrow: '', level: 'h2', size: 'lg', sizePx: 0, weight: 'default', font: 'heading', tracking: 'default', align: 'left', uppercase: false },
      render: ({ source, eyebrow, text, level, size, sizePx, weight, font, tracking, align, uppercase, puck }) => {
        const Tag = (['h1', 'h2', 'h3', 'h4'].includes(level) ? level : 'h2') as 'h2';
        const content = boundText(source, text, meta(puck).portfolio);
        if (!content && !puck.isEditing) return <></>;
        const sizes: Record<string, string> = { xs: 'text-base', sm: 'text-xl', md: 'text-2xl md:text-3xl', lg: 'text-3xl md:text-5xl', xl: 'text-4xl md:text-7xl', '2xl': 'text-5xl md:text-8xl' };
        return (
          <div className={`d-prim ${alignClass(align)}`}>
            {eyebrow && <p className="d-eyebrow mb-2">{eyebrow}</p>}
            <Tag className={`${Number(sizePx) > 0 ? '' : sizes[size] ?? sizes.lg} ${weightClass(weight, 'font-black')} tracking-tight ${uppercase ? 'uppercase' : ''}`} style={typeStyle(sizePx, font, tracking)}>
              {content || <span className="d-muted">(empty: fill this in the admin)</span>}
            </Tag>
          </div>
        );
      },
    },

    Text: {
      label: 'Text',
      fields: {
        source: { type: 'select', label: 'Content', options: TEXT_SOURCES.map(({ value, label }) => ({ value, label })) },
        text: { type: 'textarea', label: 'Text (when content is “My own text”; blank line = new paragraph)', contentEditable: true },
        size: { type: 'select', label: 'Size', options: TEXT_SIZES },
        sizePx: { type: 'number', label: 'Exact size (px, overrides size)', min: 0, max: 120 },
        weight: { type: 'select', label: 'Weight', options: WEIGHT_OPTIONS },
        font: { type: 'select', label: 'Font', options: FONT_ROLE_OPTIONS },
        tracking: { type: 'select', label: 'Letter spacing', options: TRACKING_OPTIONS },
        tone: { type: 'radio', label: 'Color', options: [{ label: 'Normal', value: 'normal' }, { label: 'Muted', value: 'muted' }, { label: 'Accent', value: 'accent' }, { label: '2nd accent', value: 'accent2' }] },
        align: alignField,
        maxWidth: { type: 'radio', label: 'Line length', options: [{ label: 'Full', value: 'none' }, { label: 'Readable', value: 'prose' }] },
        uppercase: { type: 'radio', label: 'Uppercase', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
      },
      defaultProps: { source: 'custom', text: 'Write something here.', size: 'md', sizePx: 0, weight: 'default', font: 'body', tracking: 'default', tone: 'muted', align: 'left', maxWidth: 'prose', uppercase: false },
      render: ({ source, text, size, sizePx, weight, font, tracking, tone, align, maxWidth, uppercase, puck }) => {
        const content = boundText(source, text, meta(puck).portfolio);
        if (!content && !puck.isEditing) return <></>;
        const sizes: Record<string, string> = { xs: 'text-xs leading-5', sm: 'text-sm leading-6', md: 'text-base leading-7', lg: 'text-lg leading-8 md:text-xl', xl: 'text-xl leading-8 md:text-2xl' };
        const toneCls = tone === 'muted' ? 'd-muted' : tone === 'accent' ? 'd-accent' : tone === 'accent2' ? 'd-accent-2' : '';
        return (
          <div className={`d-prim grid gap-3 ${alignClass(align)} ${Number(sizePx) > 0 ? '' : sizes[size] ?? sizes.md} ${weightClass(weight, '')} ${toneCls} ${uppercase ? 'uppercase' : ''}`} style={typeStyle(sizePx, font, tracking)}>
            {/* While editing, Puck passes an inline-editable element instead of the plain string. */}
            {(typeof content === 'string' ? content.split(/\n\s*\n/) : [content]).map((paragraph, index) => (
              <p key={index} className={`whitespace-pre-line ${maxWidth === 'prose' ? `max-w-[65ch] ${align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : ''}` : ''}`}>{paragraph || <span className="d-muted">(empty: fill this in the admin)</span>}</p>
            ))}
          </div>
        );
      },
    },

    Button: {
      label: 'Button',
      fields: {
        action: { type: 'select', label: 'When clicked', options: BUTTON_ACTIONS.map(({ value, label }) => ({ value, label })) },
        label: { type: 'text', label: 'Label (empty = default for the action)' },
        href: { type: 'text', label: 'Link (for “Open a link”: #section, /path, https://… or mailto:)' },
        style: { type: 'radio', label: 'Style', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }, { label: 'Link', value: 'ghost' }] },
        size: { type: 'radio', label: 'Size', options: [{ label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }] },
        icon: { type: 'select', label: 'Icon', options: [{ label: 'Automatic', value: 'auto' }, { label: 'None', value: 'none' }, { label: 'Arrow', value: 'arrow' }, { label: 'Download', value: 'download' }, { label: 'Mail', value: 'mail' }, { label: 'LinkedIn', value: 'linkedin' }, { label: 'GitHub', value: 'github' }, { label: 'External', value: 'external' }] },
        align: alignField,
        fullWidthMobile: { type: 'radio', label: 'Full width on phones', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
        newTab: { type: 'radio', label: 'Open in new tab', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
      },
      defaultProps: { action: 'custom', label: 'Button', href: '#contact', style: 'primary', size: 'md', icon: 'auto', align: 'left', fullWidthMobile: false, newTab: false },
      render: ({ action, label, href, style, size, icon, align, fullWidthMobile, newTab, puck }) => {
        const chosen = BUTTON_ACTIONS.find((item) => item.value === action) ?? BUTTON_ACTIONS[0];
        const url = chosen.value === 'custom' ? safeHref(href) : chosen.href?.(meta(puck).portfolio);
        if (!url && !puck.isEditing) return <></>;
        const iconName = icon === 'auto' ? chosen.icon : icon === 'none' ? '' : icon;
        const sizeCls = { sm: 'min-h-10 px-4 py-2 text-xs', md: '', lg: 'min-h-14 px-7 text-base' }[size] ?? '';
        const openNew = newTab || chosen.external;
        return (
          <div className={`d-prim flex py-1 ${justifyClass(align)}`}>
            <a href={url ?? '#'} className={`d-btn d-btn-${style} ${sizeCls} ${fullWidthMobile ? 'max-sm:w-full' : ''}`} {...(openNew ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {iconName && <Icon name={iconName} size={size === 'lg' ? 18 : 16} />}
              {label || chosen.defaultLabel}
            </a>
          </div>
        );
      },
    },

    Image: {
      label: 'Image',
      fields: {
        source: { type: 'radio', label: 'Image', options: IMAGE_SOURCES.map(({ value, label }) => ({ value, label })) },
        src: { type: 'text', label: 'Image URL (https://… or /images/…)' },
        alt: { type: 'text', label: 'Description (for screen readers & SEO)' },
        aspect: { type: 'select', label: 'Shape', options: [{ label: 'Original', value: 'auto' }, { label: 'Square', value: 'square' }, { label: 'Circle', value: 'circle' }, { label: 'Wide (16:9)', value: 'video' }, { label: 'Portrait (4:5)', value: 'portrait' }] },
        rounded: { type: 'radio', label: 'Rounded corners', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
        maxWidth: { type: 'radio', label: 'Size', options: [{ label: 'XS', value: 'xs' }, { label: 'S', value: 'sm' }, { label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'Full', value: 'full' }] },
        align: alignField,
      },
      defaultProps: { source: 'custom', src: '', alt: '', aspect: 'auto', rounded: true, maxWidth: 'full', align: 'center' },
      render: ({ source, src, alt, aspect, rounded, maxWidth, align, puck }) => {
        const { profile } = meta(puck).portfolio;
        const url = safeSrc(source === 'profilePhoto' ? profile.profileImage : src);
        const width = { xs: 'max-w-[8rem]', sm: 'max-w-xs', md: 'max-w-md', lg: 'max-w-2xl', full: 'max-w-full' }[maxWidth] ?? 'max-w-full';
        const shape = { auto: '', square: 'aspect-square object-cover', circle: 'aspect-square rounded-full object-cover', video: 'aspect-video object-cover', portrait: 'aspect-[4/5] object-cover' }[aspect] ?? '';
        if (!url) return puck.isEditing ? <div className="d-prim d-placeholder">{source === 'profilePhoto' ? 'No profile photo yet: upload one in Admin → Profile.' : 'Add an image URL in the settings panel.'}</div> : <></>;
        return (
          <div className={`d-prim flex ${justifyClass(align)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt || (source === 'profilePhoto' ? profile.name : '')} loading="lazy" className={`w-full ${width} ${shape}`} style={rounded && aspect !== 'circle' ? { borderRadius: 'var(--d-radius)' } : undefined} />
          </div>
        );
      },
    },

    Tags: {
      label: 'Tags',
      fields: {
        source: { type: 'radio', label: 'Tags', options: TAG_SOURCES.map(({ value, label }) => ({ value, label })) },
        items: { type: 'array', label: 'My own tags', arrayFields: { text: { type: 'text', label: 'Tag' } }, defaultItemProps: { text: 'Tag' }, getItemSummary: (item) => item.text || 'Tag' },
        style: { type: 'radio', label: 'Style', options: [{ label: 'Soft', value: 'soft' }, { label: 'Accent', value: 'accent' }, { label: 'Outline', value: 'outline' }] },
        align: alignField,
      },
      defaultProps: { source: 'technologies', items: [], style: 'soft', align: 'left' },
      render: ({ source, items, style, align, puck }) => {
        const tags = boundTags(source, items, meta(puck).portfolio);
        if (tags.length === 0) return puck.isEditing ? <div className="d-prim d-placeholder">No tags yet.</div> : <></>;
        return (
          <ul className={`d-prim flex flex-wrap gap-2 ${justifyClass(align)}`}>
            {tags.map((tag) => <li key={tag} className={`d-tag ${style === 'accent' ? 'd-tag-accent' : ''}`} style={style === 'outline' ? { background: 'transparent' } : undefined}>{tag}</li>)}
          </ul>
        );
      },
    },

    Badge: {
      label: 'Status badge',
      fields: {
        source: { type: 'select', label: 'Content', options: TEXT_SOURCES.map(({ value, label }) => ({ value, label })) },
        text: { type: 'text', label: 'Text (when content is “My own text”)' },
        dot: { type: 'radio', label: 'Pulsing dot', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
        style: { type: 'radio', label: 'Style', options: [{ label: 'Pill', value: 'pill' }, { label: 'Plain', value: 'plain' }] },
        align: alignField,
      },
      defaultProps: { source: 'availability', text: 'Open to work', dot: true, style: 'pill', align: 'left' },
      render: ({ source, text, dot, style, align, puck }) => {
        const content = boundText(source, text, meta(puck).portfolio);
        if (!content && !puck.isEditing) return <></>;
        return (
          <div className={`d-prim flex ${justifyClass(align)}`}>
            <span className={`inline-flex items-center gap-2 text-sm font-bold ${style === 'pill' ? 'd-tag d-tag-accent px-3 py-1.5' : 'd-accent'}`}>
              {dot && <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: 'var(--d-accent)' }} /><span className="d-dot relative size-2" /></span>}
              {content || '(empty)'}
            </span>
          </div>
        );
      },
    },

    ContactButtons: {
      label: 'Contact buttons',
      fields: { buttonLabel: fromSiteText('Email button'), align: align2Field },
      defaultProps: { buttonLabel: '', align: 'left' },
      render: ({ buttonLabel, align, puck }) => {
        const { profile, copy } = meta(puck).portfolio;
        return <div className="d-prim"><ContactButtons email={profile.socialLinks.email} linkedin={profile.socialLinks.linkedin} actionLabel={buttonLabel && buttonLabel.trim() !== '-' ? buttonLabel : copy.contact.action} align={align} /></div>;
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

    /* ======================= Build from scratch ======================= */
    Box,
    Link: LinkBlock,
    Icon: IconBlock,
    Video: VideoBlock,
    Quote: QuoteBlock,
    Faq: FaqBlock,
    Form: FormBlock,
    InputField: InputBlock,
    TextAreaField: TextAreaBlock,
    SelectField: SelectBlock,
    ChoicesField: ChoicesBlock,
    // Filled in by addStarters (below) once every block's defaults are complete.
    QuickBanner: Box, QuickTextImage: Box, QuickFeatures: Box, QuickStats: Box, QuickContact: Box, QuickFaq: Box, QuickTestimonials: Box,
  },
};

// Any block can go inside any container, except the Classic layout itself (it's a whole page).
for (const component of Object.values(designConfig.components) as { fields?: Record<string, { type: string; disallow?: string[] }> }[]) {
  for (const field of Object.values(component.fields ?? {})) if (field.type === 'slot') field.disallow = ['ClassicShell'];
}

// Box has its own complete design panel; form fields sit in the form's grid, so no extra wrapper around them.
const NO_STYLE_WRAPPER = new Set(['Box', 'InputField', 'TextAreaField', 'SelectField', 'ChoicesField', 'QuickBanner', 'QuickTextImage', 'QuickFeatures', 'QuickStats', 'QuickContact', 'QuickFaq', 'QuickTestimonials']);

// Every block gets the same Design settings (spacing, size, colors, border, flex/grid item, visibility), applied by
// <StyledBlock>. A "Content | Design" switch at the top of each block's panel shows one side or the other.
for (const [name, component] of Object.entries(designConfig.components) as [string, {
  fields?: Record<string, { type: string; visible?: boolean }>; defaultProps?: Record<string, unknown>; render: (props: never) => React.ReactNode;
  resolveFields?: unknown;
}][]) {
  if (NO_STYLE_WRAPPER.has(name)) continue;
  const render = component.render;
  const panel = name.startsWith('Classic');
  const own = component.fields ?? {};
  const contentKeys = Object.entries(own).filter(([, field]) => field.type !== 'slot').map(([key]) => key);
  const hasContent = contentKeys.length > 0;
  component.fields = { ...(hasContent ? { _view: viewField } : {}), ...own, ...styleFields } as never;
  component.defaultProps = { ...(component.defaultProps ?? {}), ...STYLE_DEFAULTS, _view: 'content' };
  if (hasContent) {
    component.resolveFields = ((data: { props?: StyleProps }, { fields }: { fields: Record<string, { type: string; visible?: boolean }> }) => {
      const design = data.props?._view === 'design';
      return Object.fromEntries(Object.entries(fields).map(([key, field]) => {
        if (key === '_view' || field.type === 'slot') return [key, field];
        const isStyle = (STYLE_KEYS as readonly string[]).includes(key);
        return [key, { ...field, visible: isStyle ? design : !design }];
      }));
    }) as never;
  }
  component.render = ((props: StyleProps & { puck: { isEditing: boolean } }) => (
    <StyledBlock props={props} editing={props.puck.isEditing} panel={panel}>{render(props as never)}</StyledBlock>
  )) as never;
}

// Quick add: ready-made layouts, built from the blocks above (after their defaults are complete).
addStarters(designConfig as never);
