import type { DesignData } from './templates';

/**
 * Templates made for the platform owner: added once to the MAIN site's "Your templates" (private to that site)
 * the first time its Design tab opens. Like any of the owner's templates, nobody else sees them until the owner
 * publishes one. Deleting one doesn't bring it back. Also used as the worked example in the AI prompt.
 */

type Block = { type: string; props: Record<string, unknown> & { id: string } };
const b = (type: string, id: string, props: Record<string, unknown> = {}): Block => ({ type, props: { id, ...props } });
const pad = (top: number, side = top, bottom = top) => ({ top: String(top), right: String(side), bottom: String(bottom), left: String(side) });
const none = { padding: pad(0) };

// ---------------------------------------------------------------- Glass Studio (Liquid Glass, from the owner's mockup)

const INK = '#1d1d1f';
const BLUE = '#0a84ff';
const PURPLE = '#bf5af2';
const GREEN = '#30d158';

/** Traffic-light window buttons. */
const dots = (id: string, size = 12) => b('Flex', id, {
  gap: Math.round(size * 0.6), align: 'center', wrap: false,
  items: [['r', '#ff5f57'], ['y', '#febc2e'], ['g', '#28c840']].map(([k, color]) => b('Box', `${id}-${k}`, {
    size: { width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }, spacing: none,
    look: { fill: 'custom', fillColor: color, radius: 99, borderWidth: 1, borderTone: 'custom', borderColor: 'rgba(0,0,0,0.08)' },
  })),
});

/** A frosted white panel floating on the page: every section sits in one. */
const panel = (id: string, content: Block[], anchor = '') => b('Box', id, {
  size: { contained: true, width: '96%' },
  layout: { display: 'flex', direction: 'column', gap: 26 },
  spacing: { padding: pad(36, 40), paddingMobile: pad(24, 18), margin: { top: '18' } },
  look: { glass: 'light', radius: 28 },
  advanced: { tag: 'section', fitSections: true, anchor },
  content,
});

/** Small uppercase label above a title, and something on the right. */
const header = (id: string, eyebrow: string, title: string, side?: Block) => b('Flex', `${id}-head`, {
  gap: 24, align: 'end', justify: 'between', stackOnMobile: true,
  items: [
    b('Box', `${id}-titles`, {
      layout: { display: 'flex', direction: 'column', gap: 4 }, spacing: none,
      content: [
        b('Text', `${id}-eyebrow`, { source: 'custom', text: eyebrow, size: 'xs', weight: 'medium', tracking: 'wide', uppercase: true, tone: 'muted' }),
        b('Heading', `${id}-title`, { source: 'custom', text: title, level: 'h2', size: 'md', weight: 'bold', tracking: 'tight' }),
      ],
    }),
    ...(side ? [side] : []),
  ],
});

const feature = (id: string, icon: string, color: string, title: string, text: string) => b('Box', id, {
  layout: { display: 'flex', direction: 'row', gap: 14, align: 'flex-start', wrap: 'nowrap', stackOnMobile: false },
  spacing: { padding: pad(20) },
  look: { fill: 'custom', fillColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderTone: 'line', radius: 18, shadow: 'sm' },
  content: [
    b('Icon', `${id}-icon`, { name: icon, size: 20, tone: 'custom', color, background: 'circle' }),
    b('Box', `${id}-copy`, {
      layout: { display: 'flex', direction: 'column', gap: 6 }, spacing: none,
      content: [
        b('Heading', `${id}-title`, { source: 'custom', text: title, level: 'h3', sizePx: 15, weight: 'bold' }),
        b('Text', `${id}-text`, { source: 'custom', text, size: 'sm' }),
      ],
    }),
  ],
});

/** A line in the profile window: icon + live text. */
const fact = (id: string, icon: string, source: string) => b('Flex', id, {
  gap: 10, align: 'center', wrap: false,
  items: [b('Icon', `${id}-icon`, { name: icon, size: 15, tone: 'muted' }), b('Text', `${id}-text`, { source, size: 'sm', tone: 'normal' })],
});

const glassStudio: DesignData = {
  root: {
    props: {
      theme: 'clean',
      colors: { bg: '#eef0f6', surface: '#ffffff', surface2: '#f5f5f7', text: INK, muted: '#6e6e73', line: '#e5e5ea', accent: INK, accent2: BLUE, accent3: PURPLE },
      headingFont: 'system', bodyFont: 'system', textSize: 'medium', headingWeight: 'bold', headingCase: 'normal',
      radius: 'large', buttonShape: 'pill', buttonStyle: 'solid', width: 'wide', direction: 'ltr', effects: 'none', showAskAi: 'yes',
    },
  },
  content: [
    b('NavBar', 'nav', {
      style: 'glass', overlay: true, showResume: true, sticky: true,
      links: [{ label: 'Overview', href: '#home' }, { label: 'Projects', href: '#projects' }, { label: 'Experience', href: '#experience' }, { label: 'Skills', href: '#skills' }, { label: 'Contact', href: '#contact' }],
    }),

    // Hero: a sunrise wallpaper "desktop" with the intro, a glass profile window and an app dock.
    b('Box', 'home', {
      size: { contained: true, width: '96%' },
      layout: { display: 'flex', direction: 'column', gap: 24 },
      spacing: { padding: { top: '108', right: '48', bottom: '32', left: '48' }, paddingMobile: { top: '96', right: '18', bottom: '22', left: '18' }, margin: { top: '10' } },
      look: { fill: 'custom', fillColor: '#f3dcef', image: '/design/wallpapers/sunrise-hills.svg', imageFit: 'cover', radius: 32, shadow: 'md', borderWidth: 1, borderTone: 'custom', borderColor: 'rgba(255,255,255,0.75)' },
      advanced: { tag: 'header', anchor: 'home', overflow: 'hidden' },
      content: [
        b('Flex', 'hero-row', {
          gap: 40, align: 'center', justify: 'between', stackOnMobile: true,
          items: [
            b('Box', 'hero-copy', {
              layout: { display: 'flex', direction: 'column', gap: 18 }, spacing: none, item: { grow: true, basis: '48%' },
              content: [
                dots('hero-dots', 11),
                b('Flex', 'hero-status', {
                  gap: 8, align: 'center',
                  items: [
                    b('Text', 'hero-location', { source: 'location', size: 'sm', tone: 'normal', weight: 'medium' }),
                    b('Text', 'hero-sep', { source: 'custom', text: '•', size: 'sm', tone: 'muted' }),
                    b('Text', 'hero-available', { source: 'availability', size: 'sm', tone: 'normal', weight: 'medium' }),
                  ],
                }),
                b('Heading', 'hero-title', { source: 'custom', text: 'Building digital products for a better tomorrow.', level: 'h1', size: 'lg', weight: 'bold', tracking: 'tight' }),
                b('Text', 'hero-summary', { source: 'summary', size: 'lg', tone: 'normal' }),
                b('Flex', 'hero-actions', {
                  gap: 12, align: 'center', stackOnMobile: true,
                  items: [
                    b('Button', 'hero-work', { action: 'projects', label: 'Explore my work', style: 'primary', size: 'md', icon: 'arrow', fullWidthMobile: true }),
                    b('Button', 'hero-resume', { action: 'resume', label: 'View resume', style: 'secondary', size: 'md', icon: 'none', fullWidthMobile: true }),
                  ],
                }),
                b('SocialLinks', 'hero-social', { align: 'left', labels: false }),
              ],
            }),
            b('Box', 'hero-side', {
              layout: { display: 'flex', direction: 'column', gap: 18, align: 'stretch' }, spacing: none, item: { grow: true, basis: '42%' },
              content: [
                // The profile, in a Liquid Glass app window.
                b('Box', 'profile-window', {
                  layout: { display: 'flex', direction: 'column', gap: 16 },
                  spacing: { padding: pad(16, 20, 22) },
                  look: { glass: 'light', radius: 22 },
                  content: [
                    b('Flex', 'profile-bar', {
                      justify: 'between', align: 'center', wrap: false,
                      items: [dots('profile-dots', 11), b('Flex', 'profile-tools', { gap: 12, align: 'center', wrap: false, items: [b('Icon', 'profile-grid', { name: 'grid', size: 14, tone: 'muted' }), b('Icon', 'profile-more', { name: 'more', size: 16, tone: 'muted' })] })],
                    }),
                    b('Flex', 'profile-body', {
                      gap: 20, align: 'start', stackOnMobile: true,
                      items: [
                        b('Image', 'profile-photo', { source: 'profilePhoto', alt: 'Profile photo', aspect: 'portrait', rounded: true, radiusPx: 14, maxWidth: 'xs', align: 'left', filter: 'grayscale' }),
                        b('Box', 'profile-info', {
                          layout: { display: 'flex', direction: 'column', gap: 6 }, spacing: none, item: { grow: true, basis: '55%' },
                          content: [
                            b('Heading', 'profile-name', { source: 'name', level: 'h3', sizePx: 19, weight: 'bold' }),
                            b('Text', 'profile-role', { source: 'role', size: 'sm', tone: 'muted' }),
                            b('Text', 'profile-summary', { source: 'summary', size: 'xs', tone: 'muted' }),
                            b('Divider', 'profile-rule', { style: 'line' }),
                            fact('profile-location', 'pin', 'location'),
                            fact('profile-open', 'briefcase', 'availabilityNote'),
                            b('Flex', 'profile-current', {
                              gap: 10, align: 'center', wrap: false,
                              items: [
                                b('Box', 'profile-current-dot', { size: { width: '9px', height: '9px', minWidth: '9px' }, spacing: { padding: pad(0), margin: { left: '3', right: '2' } }, look: { fill: 'custom', fillColor: GREEN, radius: 99, shadow: 'sm' } }),
                                b('Text', 'profile-current-text', { source: 'currentJob', size: 'sm', tone: 'normal' }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                // A dock of app icons (original glyphs, not real apps' logos).
                b('Box', 'dock', {
                  layout: { display: 'flex', direction: 'row', gap: 9, align: 'center', justify: 'center', wrap: 'nowrap', stackOnMobile: false },
                  size: { center: true },
                  spacing: { padding: pad(9, 11) },
                  look: { glass: 'clear', radius: 22 },
                  advanced: { visibility: 'desktop' },
                  content: [
                    ['folder', '#1e90ff'], ['grid', '#ff9f0a'], ['code', BLUE], ['terminal', '#2c2c2e'], ['palette', '#ff375f'], ['notes', '#ffb800'], ['chat', GREEN],
                  ].map(([name, color]) => b('Icon', `dock-${name}`, { name, size: 19, tone: 'custom', color, background: 'tile' }))
                    .concat([b('Box', 'dock-sep', { size: { width: '1px', height: '34px' }, spacing: none, look: { fill: 'custom', fillColor: 'rgba(0,0,0,0.12)' } }),
                      b('Icon', 'dock-trash', { name: 'trash', size: 19, tone: 'muted', background: 'glass' })]),
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    panel('services', [
      header('services', 'What I do', 'Turn ideas into real products.', b('Text', 'services-intro', { source: 'custom', text: 'From idea to production, I design, develop and ship products with modern technologies and AI.', size: 'sm', maxWidth: 'prose' })),
      b('Grid', 'services-grid', {
        columns: '4', columnsTablet: '2', columnsMobile: '1', gap: 14,
        items: [
          feature('svc-fullstack', 'code', BLUE, 'Full-Stack Development', 'Build scalable and maintainable web applications with clean architecture.'),
          feature('svc-ai', 'sparkle', PURPLE, 'AI & Automation', 'Create AI agents, automation workflows and developer tools that improve productivity.'),
          feature('svc-product', 'cube', BLUE, 'Product Thinking', 'Turn ideas into real-world products with focus on user experience and impact.'),
          feature('svc-performance', 'chart', BLUE, 'Performance', 'Optimize for speed, reliability and scalability across the entire stack.'),
        ],
      }),
    ]),

    panel('projects-panel', [
      header('projects', 'Featured work', 'Projects', b('Link', 'projects-all', { label: 'View all', href: '/projects', style: 'accent', size: 'sm', icon: 'arrow', colors: { accentColor: BLUE } })),
      b('Projects', 'projects-list', {
        layout: 'grid', columns: '3', columnsMobile: '1', filter: 'all', sort: 'featured', limit: 6, image: 'video', frame: 'window', linkStyle: 'arrow', tabs: true,
        cardStyle: 'card', cardAlign: 'left', showDescription: true, showStack: true, showLinks: true, showType: false, hover: 'lift', eyebrow: '-', title: '-',
      }),
    ], 'projects'),

    panel('skills-panel', [
      header('skills', 'Skills', 'Tech Stack & Tools'),
      b('Skills', 'skills-list', { layout: 'tabs', align: 'left', eyebrow: '-', title: '-', description: '-' }),
    ], 'skills'),

    panel('experience-panel', [
      header('experience', 'Experience', 'My Journey', b('Text', 'experience-intro', { source: 'custom', text: 'A journey of continuous learning, building and creating impact.', size: 'sm' })),
      b('Experience', 'experience-list', { layout: 'journey', maxBullets: 1, eyebrow: '-', title: '-', description: '-' }),
    ], 'experience'),

    // Call to action: a soft glass strip.
    b('Box', 'contact', {
      size: { contained: true, width: '96%' },
      layout: { display: 'flex', direction: 'row', gap: 24, align: 'center', justify: 'space-between', wrap: 'wrap', stackOnMobile: true },
      spacing: { padding: pad(28, 32), paddingMobile: pad(22, 18), margin: { top: '18', bottom: '28' } },
      look: { glass: 'tinted', radius: 28 },
      advanced: { tag: 'section', anchor: 'contact' },
      content: [
        b('Flex', 'contact-left', {
          gap: 20, align: 'center', stackOnMobile: true, item: { grow: true },
          items: [
            b('Icon', 'contact-icon', { name: 'chat', size: 28, tone: 'custom', color: BLUE, background: 'tile' }),
            b('Box', 'contact-copy', {
              layout: { display: 'flex', direction: 'column', gap: 4 }, spacing: none,
              content: [
                b('Text', 'contact-eyebrow', { source: 'custom', text: 'Let’s connect', size: 'xs', weight: 'medium', tracking: 'wide', uppercase: true, tone: 'muted' }),
                b('Heading', 'contact-title', { source: 'custom', text: 'Let’s build something meaningful.', level: 'h2', size: 'md', weight: 'bold', tracking: 'tight' }),
                b('Text', 'contact-text', { source: 'contactDescription', size: 'sm' }),
              ],
            }),
          ],
        }),
        b('Flex', 'contact-right', {
          direction: 'column', gap: 14, align: 'center',
          items: [b('Button', 'contact-button', { action: 'contact', label: 'Get in touch', style: 'primary', size: 'md', icon: 'arrow' }), b('SocialLinks', 'contact-social', { align: 'center' })],
        }),
      ],
    }),

    b('Footer', 'footer', { showSocial: false }),
  ],
} as unknown as DesignData;

export const OWNER_TEMPLATES: { key: string; name: string; description: string; data: DesignData }[] = [
  {
    key: 'glass-studio',
    name: 'Glass Studio',
    description: 'Apple-style Liquid Glass: a floating glass navigation bar, a sunrise-wallpaper hero with a frosted profile window and an app dock, glass panels on a soft grey page, projects in app windows with a Featured / All switch, tabbed skill chips and a side-by-side journey.',
    data: glassStudio,
  },
];
