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
  size: { width: '97%', maxWidth: '1680px', center: true },
  layout: { display: 'flex', direction: 'column', gap: 26 },
  spacing: { padding: pad(36, 40), paddingMobile: pad(24, 18), margin: { top: '18' } },
  look: { glass: 'clear', radius: 28 },
  advanced: { tag: 'section', fitSections: true, anchor },
  content,
});

/** Fixed text, or `@source`: live Site text (Admin → Site text), e.g. '@projectsTitle'. */
const words = (value: string) => (value.startsWith('@') ? { source: value.slice(1) } : { source: 'custom', text: value });

/** Small uppercase label above a title, and something on the right. */
const header = (id: string, eyebrow: string, title: string, side?: Block) => b('Flex', `${id}-head`, {
  gap: 24, align: 'end', justify: 'between', stackOnMobile: true,
  items: [
    b('Box', `${id}-titles`, {
      layout: { display: 'flex', direction: 'column', gap: 4 }, spacing: none,
      content: [
        b('Text', `${id}-eyebrow`, { ...words(eyebrow), size: 'xs', weight: 'medium', tracking: 'wide', uppercase: true, tone: 'muted' }),
        b('Heading', `${id}-title`, { ...words(title), level: 'h2', size: 'md', weight: 'bold', tracking: 'tight' }),
      ],
    }),
    ...(side ? [side] : []),
  ],
});

const feature = (id: string, icon: string, color: string, title: string, text: string) => b('Box', id, {
  layout: { display: 'flex', direction: 'row', gap: 14, align: 'flex-start', wrap: 'nowrap', stackOnMobile: false },
  spacing: { padding: pad(20) },
  look: { glass: 'light', radius: 22 },
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
const fact = (id: string, icon: string, source: string, color = '') => b('Flex', id, {
  gap: 10, align: 'start', wrap: false,
  items: [
    // The icon sits centred on the first line of text (16px icon, 4px down, in a 24px line), also when the text wraps on a phone.
    b('Icon', `${id}-icon`, { name: icon, size: 16, ...(color ? { tone: 'custom', color } : { tone: 'muted' }), spacing: { margin: { top: '4' } } }),
    b('Text', `${id}-text`, { source, size: 'sm', tone: 'normal' }),
  ],
});

const glassStudio: DesignData = {
  root: {
    props: {
      theme: 'clean',
      colors: { bg: '#eef0f6', surface: '#ffffff', surface2: '#f5f5f7', text: INK, muted: '#6e6e73', line: '#e5e5ea', accent: INK, accent2: BLUE, accent3: PURPLE },
      headingFont: 'system', bodyFont: 'system', textSize: 'medium', headingWeight: 'bold', headingCase: 'normal',
      radius: 'large', buttonShape: 'pill', buttonStyle: 'solid', width: 'full', direction: 'ltr', effects: 'aurora', showAskAi: 'yes',
    },
  },
  content: [
    b('NavBar', 'nav', {
      style: 'glass', overlay: true, showResume: true, sticky: true,
      links: [{ label: 'Overview', href: '#home' }, { label: 'Projects', href: '#projects' }, { label: 'Experience', href: '#experience' }, { label: 'Skills', href: '#skills' }, { label: 'Contact', href: '#contact' }],
    }),

    // Hero: a sunrise wallpaper "desktop" with the intro, a glass profile window and an app dock.
    b('Box', 'home', {
      size: { width: '97%', maxWidth: '1680px', center: true },
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
                  gap: 16, align: 'center',
                  items: [
                    b('Flex', 'hero-where', { gap: 6, align: 'center', wrap: false, items: [
                      b('Icon', 'hero-where-icon', { name: 'pin', size: 15, tone: 'muted' }),
                      b('Text', 'hero-location', { source: 'location', size: 'sm', tone: 'normal', weight: 'medium' }),
                    ] }),
                    // Apple-style status: a green dot in a soft glass pill.
                    b('Flex', 'hero-open', {
                      gap: 6, align: 'center', wrap: false,
                      items: [
                        b('Icon', 'hero-open-dot', { name: 'dot', size: 12, tone: 'custom', color: GREEN }),
                        b('Text', 'hero-available', { source: 'availability', size: 'sm', tone: 'normal', weight: 'medium' }),
                      ],
                      spacing: { padding: { top: '4', right: '12', bottom: '4', left: '9' } },
                      colors: { background: 'rgba(255,255,255,0.55)' }, border: { borderWidth: 1, borderTone: 'custom', borderColor: 'rgba(255,255,255,0.8)', radius: '999px' },
                    }),
                  ],
                }),
                b('Heading', 'hero-title', { source: 'headline', text: 'Building digital products for a better tomorrow.', level: 'h1', size: 'lg', weight: 'bold', tracking: 'tight' }),
                b('Text', 'hero-summary', { source: 'summary', size: 'lg', tone: 'normal' }),
                b('Flex', 'hero-actions', {
                  gap: 12, align: 'center', stackOnMobile: true,
                  items: [
                    b('Button', 'hero-work', { action: 'projects', labelSource: 'primaryAction', label: 'Explore my work', style: 'primary', size: 'md', icon: 'arrow', fullWidthMobile: true }),
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
                        b('Image', 'profile-photo', { source: 'profilePhoto', alt: 'Profile photo', aspect: 'portrait', rounded: true, radiusPx: 14, maxWidth: 'xs', align: 'left', filter: 'none' }),
                        b('Box', 'profile-info', {
                          layout: { display: 'flex', direction: 'column', gap: 6 }, spacing: none, item: { grow: true, basis: '55%' },
                          content: [
                            b('Heading', 'profile-name', { source: 'name', level: 'h3', sizePx: 19, weight: 'bold' }),
                            b('Text', 'profile-role', { source: 'role', size: 'sm', tone: 'muted' }),
                            b('Text', 'profile-summary', { source: 'summary', size: 'xs', tone: 'muted' }),
                            b('Divider', 'profile-rule', { style: 'line' }),
                            fact('profile-location', 'pin', 'location'),
                            fact('profile-open', 'briefcase', 'availabilityNote'),
                            fact('profile-current', 'dot', 'currentJob', GREEN),
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
      // No "View all" link: there is no /projects page; the Featured / All projects switch shows every project.
      header('projects', '@projectsEyebrow', '@projectsTitle'),
      b('Projects', 'projects-list', {
        layout: 'grid', columns: '3', columnsMobile: '1', filter: 'all', sort: 'featured', limit: 6, image: 'video', frame: 'window', linkStyle: 'arrow', tabs: true, tagStyle: 'chips',
        cardStyle: 'glass', cardAlign: 'left', showDescription: true, showStack: true, showLinks: true, showType: false, hover: 'lift', eyebrow: '-', title: '-',
      }),
    ]),

    panel('skills-panel', [
      header('skills', '@skillsEyebrow', '@skillsTitle', b('Text', 'skills-intro', { source: 'skillsDescription', size: 'sm' })),
      b('Skills', 'skills-list', { layout: 'tabs', align: 'left', eyebrow: '-', title: '-', description: '-' }),
    ]),

    panel('experience-panel', [
      header('experience', '@experienceEyebrow', '@experienceTitle', b('Text', 'experience-intro', { source: 'experienceDescription', size: 'sm' })),
      b('Experience', 'experience-list', { layout: 'journey', maxBullets: 1, eyebrow: '-', title: '-', description: '-' }),
    ]),

    // Call to action: a soft glass strip.
    b('Box', 'contact', {
      size: { width: '97%', maxWidth: '1680px', center: true },
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
                b('Text', 'contact-eyebrow', { source: 'contactEyebrow', size: 'xs', weight: 'medium', tracking: 'wide', uppercase: true, tone: 'muted' }),
                b('Heading', 'contact-title', { source: 'contactTitle', level: 'h2', size: 'md', weight: 'bold', tracking: 'tight' }),
                b('Text', 'contact-text', { source: 'contactDescription', size: 'sm' }),
              ],
            }),
          ],
        }),
        b('Flex', 'contact-right', {
          direction: 'column', gap: 14, align: 'center',
          items: [b('Button', 'contact-button', { action: 'contact', labelSource: 'contactAction', label: 'Get in touch', style: 'primary', size: 'md', icon: 'arrow' }), b('SocialLinks', 'contact-social', { align: 'center' })],
        }),
      ],
    }),

    b('Footer', 'footer', { showSocial: false }),
  ],
} as unknown as DesignData;

// ---------------------------------------------------------------- Geek Lab (a scientist-developer's cozy study)

const WOOD = '#2a1b11';
const PAPER = '#f8f1e3';
const ORANGE = '#c8501e';
const NAVY = '#2f5d8a';

/** A section title in the page's serif. */
const marker = (id: string, text: string, sizePx: number, level = 'h2', extra: Record<string, unknown> = {}) =>
  b('Heading', id, { source: 'custom', text, level, sizePx, weight: 'normal', font: 'heading', tracking: 'tight', ...extra });
/** A short supporting line in the body font. */
const hand = (id: string, text: string, sizePx = 16, extra: Record<string, unknown> = {}) =>
  b('Text', id, { source: 'custom', text, sizePx, font: 'body', tone: 'muted', maxWidth: 'none', ...extra });
/** A small uppercase label, like a lab notebook heading. */
const label = (id: string, text: string, extra: Record<string, unknown> = {}) =>
  b('Text', id, { source: 'custom', text, size: 'xs', font: 'mono', tracking: 'widest', uppercase: true, tone: 'muted', maxWidth: 'none', ...extra });

/** One item of the stats strip: an icon and two short lines (live or fixed). */
const labStat = (id: string, icon: string, first: Record<string, unknown>, second: Record<string, unknown>, motion = 'spin-hover') => b('Flex', id, {
  gap: 14, align: 'center', wrap: false,
  items: [
    b('Icon', `${id}-icon`, { name: icon, size: 34, tone: 'text', motion }),
    b('Box', `${id}-text`, {
      layout: { display: 'flex', direction: 'column', gap: 0 }, spacing: none, size: { maxWidth: '250px' },
      content: [
        b('Text', `${id}-a`, { size: 'md', tone: 'normal', weight: 'medium', maxWidth: 'none', ...first }),
        b('Text', `${id}-b`, { size: 'sm', tone: 'muted', maxWidth: 'none', ...second }),
      ],
    }),
  ],
});

/** A paper sheet for a section: grain, soft shadow, a strip of tape on top. (No anchor when the live block inside has its own id.) */
const sheet = (id: string, anchor: string, content: Block[]) => b('Box', id, {
  size: { width: '96%', maxWidth: '1560px', center: true },
  layout: { display: 'flex', direction: 'column', gap: 26 },
  spacing: { padding: pad(44, 44, 40), paddingMobile: pad(30, 18, 26), margin: { top: '44' } },
  look: { texture: 'paper', radius: 6, shadow: 'md' },
  advanced: { tag: 'section', anchor },
  content,
});

/** A handwritten section header: marker title and a note beside it. */
const labHeader = (id: string, eyebrow: string, title: string, note: string) => b('Flex', `${id}-head`, {
  gap: 18, align: 'end', justify: 'between', stackOnMobile: true,
  items: [
    b('Box', `${id}-titles`, { layout: { display: 'flex', direction: 'column', gap: 6 }, spacing: none, content: [label(`${id}-label`, eyebrow), marker(`${id}-title`, title, 40)] }),
    hand(`${id}-note`, note),
  ],
});

/** Your profile photo stuck on the whiteboard as a sticky note, with tape and a handwritten caption. */
const photoNote = (id: string, visibility: 'desktop' | 'mobile', width: number, tilt: number) => b('Box', id, {
  layout: { display: 'flex', direction: 'column', gap: 6, align: 'center' },
  size: { width: `${width}px`, minWidth: `${width}px` },
  spacing: { padding: pad(10, 10, 8) },
  look: { fill: 'custom', fillColor: '#fdfbf6', tilt, shadow: 'md', radius: 2, borderWidth: 1, borderTone: 'custom', borderColor: 'rgba(0,0,0,0.06)' },
  item: { shrink: false, alignSelf: 'flex-start' },
  advanced: { tag: 'div', visibility },
  content: [
    b('Image', `${id}-photo`, { source: 'profilePhoto', alt: 'Profile photo', aspect: 'square', rounded: false, radiusPx: 2, maxWidth: 'full', align: 'center', filter: 'none' }),
    b('Text', `${id}-caption`, { source: 'location', size: 'xs', font: 'mono', tracking: 'wide', tone: 'muted', align: 'center', maxWidth: 'none' }),
  ],
});

const geekLab: DesignData = {
  root: {
    props: {
      theme: 'clean',
      colors: { bg: '#efe3cb', surface: PAPER, surface2: '#efe3cb', text: '#2b2118', muted: '#6b5a48', line: 'rgba(60,40,20,0.16)', accent: ORANGE, accent2: NAVY, accent3: '#e4b93a' },
      headingFont: 'serif', bodyFont: 'system', textSize: 'medium', headingWeight: 'normal', headingCase: 'normal',
      radius: 'small', buttonShape: 'pill', buttonStyle: 'solid', width: 'full', direction: 'ltr', effects: 'none', showAskAi: 'yes',
    },
  },
  content: [
    // A dark wooden top bar that stays on top while scrolling.
    b('Box', 'lab-nav', {
      spacing: { padding: { top: '0', right: '20', bottom: '0', left: '20' } },
      look: { texture: 'wood', shadow: 'md' },
      advanced: { tag: 'div', sticky: true },
      content: [b('NavBar', 'nav', {
        style: 'bar', showResume: true, sticky: false,
        links: [{ label: 'Home', href: '#home' }, { label: 'Projects', href: '#projects' }, { label: 'Skills', href: '#skills' }, { label: 'Experience', href: '#experience' }, { label: 'Contact', href: '#contact' }],
      })],
    }),

    // The study: whiteboard intro, a terminal and sticky-note shortcuts over an illustrated room.
    b('Box', 'home', {
      layout: { display: 'flex', direction: 'column', justify: 'flex-end', gap: 0 },
      size: { minHeight: '660px' },
      spacing: { padding: { top: '40', right: '40', bottom: '64', left: '40' }, paddingMobile: { top: '22', right: '14', bottom: '48', left: '14' } },
      look: { fill: 'custom', fillColor: WOOD, image: '/design/wallpapers/geek-lab.svg', imageFit: 'cover', edge: 'torn-bottom' },
      advanced: { tag: 'header', anchor: 'home', overflow: 'hidden' },
      content: [
        b('Flex', 'lab-hero-row', {
          gap: 28, align: 'end', justify: 'between', stackOnMobile: true,
          items: [
            // Whiteboard
            b('Box', 'lab-board', {
              layout: { display: 'flex', direction: 'row', gap: 18, align: 'flex-start', wrap: 'nowrap' },
              size: { maxWidth: '780px' },
              spacing: { padding: pad(26, 26, 28), paddingMobile: pad(18, 16, 20) },
              look: { texture: 'whiteboard' },
              item: { grow: true, basis: '50%' },
              content: [
                b('Image', 'lab-doodles', { source: 'custom', src: '/design/wallpapers/whiteboard-doodles.svg', alt: '', aspect: 'auto', rounded: false, maxWidth: 'full', align: 'left', size: { width: '118px', minWidth: '118px' }, more: { visibility: 'desktop' } }),
                b('Box', 'lab-board-text', {
                  layout: { display: 'flex', direction: 'column', gap: 10 }, spacing: none, item: { grow: true },
                  content: [
                    // Phones: the photo note sits above the greeting.
                    photoNote('lab-photo-m', 'mobile', 132, 3),
                    label('lab-hi', 'Hello, I’m'),
                    b('Heading', 'lab-name', { source: 'name', level: 'h1', sizePx: 58, weight: 'normal', font: 'heading', tracking: 'tight' }),
                    b('Text', 'lab-role', { source: 'role', font: 'body', sizePx: 18, weight: 'medium', tone: 'normal', maxWidth: 'none' }),
                    b('Text', 'lab-summary', { source: 'summary', font: 'body', sizePx: 15, tone: 'muted', maxWidth: 'prose' }),
                    b('Flex', 'lab-hero-actions', {
                      gap: 10, align: 'center', stackOnMobile: true, wrap: true,
                      items: [
                        b('Button', 'lab-work', { action: 'projects', labelSource: 'own', label: 'See my experiments', style: 'primary', size: 'md', icon: 'arrow', fullWidthMobile: true }),
                        b('Button', 'lab-resume', { action: 'resume', labelSource: 'own', label: 'Resume', style: 'secondary', size: 'md', icon: 'download', fullWidthMobile: true }),
                      ],
                    }),
                  ],
                }),
                // Desktop: the photo note pinned at the top right of the board.
                photoNote('lab-photo', 'desktop', 150, 4),
              ],
            }),
            // Terminal
            b('Box', 'lab-term-wrap', {
              layout: { display: 'flex', direction: 'column', justify: 'flex-end', gap: 0 }, spacing: none,
              item: { grow: true, basis: '30%' },
              content: [b('Terminal', 'lab-terminal', {
                title: 'Currently:', speed: 26, align: 'right',
                lines: [
                  { source: 'custom', text: 'Building cool products' },
                  { source: 'currentRole', text: '' },
                  { source: 'custom', text: 'Exploring AI & automation' },
                  { source: 'custom', text: 'Lifting weights' },
                  { source: 'custom', text: 'Rewatching my favourite sitcom (again…)' },
                ],
              })],
            }),
            // Sticky notes
            b('StickyNotes', 'lab-notes', {
              layout: 'column', size: 'md', look: 'card',
              notes: [
                { label: 'Projects', icon: 'code', href: '#projects', color: '#a4532c' },
                { label: 'Toolbox', icon: 'bulb', href: '#skills', color: '#b08d57' },
                { label: 'Journey', icon: 'users', href: '#experience', color: '#5b7a5a' },
                { label: 'Resume', icon: 'notes', href: '/api/resume', color: '#2f5d8a' },
                { label: 'Coffee chat', icon: 'coffee', href: '#contact', color: '#7a4b28' },
              ],
            }),
          ],
        }),
      ],
    }),

    // Stats strip on the paper below the torn edge.
    b('Flex', 'lab-stats', {
      gap: 24, align: 'center', justify: 'between', wrap: true, stackOnMobile: false,
      spacing: { padding: { top: '26', right: '48', bottom: '6', left: '48' }, paddingMobile: { top: '20', right: '18', bottom: '0', left: '18' } },
      items: [
        labStat('lab-years', 'atom', { source: 'years' }, { source: 'custom', text: 'Years of experience' }),
        labStat('lab-build', 'code', { source: 'custom', text: 'Scalable web apps' }, { source: 'custom', text: '& AI tools' }),
        labStat('lab-job', 'building', { source: 'custom', text: 'Day job' }, { source: 'currentJob' }),
        labStat('lab-where', 'pin', { source: 'custom', text: 'Based in' }, { source: 'location' }),
        labStat('lab-fuel', 'coffee', { source: 'custom', text: 'Fueled by' }, { source: 'custom', text: 'coffee & curiosity' }, 'wiggle'),
      ],
    }),

    // Projects: a pinned note, paper cards and a rotating-quotes card.
    b('Box', 'projects-area', {
      size: { width: '96%', maxWidth: '1560px', center: true },
      layout: { display: 'flex', direction: 'row', wrap: 'wrap', gap: 30, align: 'flex-start', stackOnMobile: true },
      spacing: { padding: pad(34, 0, 0), paddingMobile: pad(24, 0, 0), margin: { top: '20' } },
      advanced: { tag: 'section' }, // #projects comes from the Projects block itself
      content: [
        b('Box', 'lab-proj-note', {
          layout: { display: 'flex', direction: 'column', gap: 12 },
          spacing: { padding: pad(6, 0, 0) },
          item: { basis: '220px', shrink: false },
          content: [
            label('lab-proj-label', 'Selected work'),
            marker('lab-proj-title', 'Featured projects', 40),
            hand('lab-proj-sub', 'Some of the things I’ve built recently.'),
            b('Divider', 'lab-proj-rule', {}),
            b('Icon', 'lab-proj-icon', { name: 'atom', size: 26, tone: 'muted', motion: 'spin-hover' }),
          ],
        }),
        b('Projects', 'projects-list', {
          layout: 'grid', columns: '3', columnsMobile: '1', filter: 'all', sort: 'featured', limit: 6, image: 'video', frame: 'none', linkStyle: 'arrow', tabs: false, tagStyle: 'tags',
          cardStyle: 'paper', cardAlign: 'left', showDescription: true, showStack: true, showLinks: true, showType: false, hover: 'none', eyebrow: '-', title: '-',
          item: { grow: true, basis: '520px' },
        }),
        b('QuoteRotator', 'lab-quotes', {
          look: 'navy', icon: 'atom', interval: 9, font: 'serif',
          quotes: [
            { quote: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
            { quote: 'Imagination is more important than knowledge.', author: 'Albert Einstein' },
            { quote: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra' },
            { quote: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
            { quote: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
          ],
          item: { basis: '240px', shrink: false },
          size: { maxWidth: '300px' },
        }),
      ],
    }),

    sheet('skills-sheet', '', [
      labHeader('skills', 'Skills', 'The toolbox', 'Tools I reach for, sorted by shelf.'),
      b('Skills', 'skills-list', { layout: 'tabs', align: 'left', eyebrow: '-', title: '-', description: '-' }),
    ]),

    sheet('experience-sheet', '', [
      labHeader('experience', 'Experience', 'The journey so far', 'Every stop taught me something new.'),
      b('Experience', 'experience-list', { layout: 'journey', maxBullets: 1, eyebrow: '-', title: '-', description: '-' }),
    ]),

    // Contact: a dark wooden board with a chalk-yellow headline.
    b('Box', 'contact', {
      size: { width: '96%', maxWidth: '1560px', center: true },
      layout: { display: 'flex', direction: 'row', gap: 28, align: 'center', justify: 'space-between', wrap: 'wrap', stackOnMobile: true },
      spacing: { padding: pad(44, 48), paddingMobile: pad(30, 20), margin: { top: '44', bottom: '36' } },
      look: { texture: 'wood', radius: 10, shadow: 'lg' },
      advanced: { tag: 'section', anchor: 'contact' },
      content: [
        b('Box', 'contact-copy', {
          layout: { display: 'flex', direction: 'column', gap: 10 }, spacing: none, item: { grow: true },
          content: [
            label('contact-label', 'Contact', { colors: { textColor: '#c8b49a' } }),
            marker('contact-title', 'Let’s build something worth shipping.', 44, 'h2', { colors: { textColor: '#e6c88a' } }),
            hand('contact-text', 'An idea, a role or an ambitious experiment: I’m always happy to talk.', 17),
          ],
        }),
        b('Flex', 'contact-actions', {
          direction: 'column', gap: 14, align: 'stretch', item: { alignSelf: 'stretch' }, // phones: full-width button
          items: [
            b('Button', 'contact-email', { action: 'email', labelSource: 'own', label: 'Say hello', style: 'primary', size: 'lg', icon: 'mail', fullWidthMobile: true }),
            b('SocialLinks', 'contact-social', { align: 'center', labels: false }),
          ],
        }),
      ],
    }),

    b('Footer', 'footer', { showSocial: false }),
  ],
} as unknown as DesignData;

// ---------------------------------------------------------------- Profile Grid (a social-profile page, from the owner's mockup)
// An original take on a social profile: no real app's name, logo, verified badge or colours.

const PG_BG = '#09090b';
const PG_LINE = 'rgba(255,255,255,0.09)';
const PG_RING_FROM = '#22d3ee';
const PG_RING_VIA = '#6366f1';
const PG_RING_TO = '#a855f7';

/** A gradient ring around something round (the photo, each highlight). */
const ring = (id: string, sizePx: number, thickness: number, inner: Block) => b('Box', id, {
  size: { width: `${sizePx}px`, height: `${sizePx}px`, minWidth: `${sizePx}px` },
  layout: { display: 'flex', direction: 'column', align: 'stretch', justify: 'center' },
  spacing: { padding: pad(thickness) },
  look: { fill: 'custom', fillColor: PG_RING_FROM, gradientVia: PG_RING_VIA, gradientTo: PG_RING_TO, gradientAngle: 45, radius: 999 },
  content: [b('Box', `${id}-gap`, {
    size: { width: '100%', height: '100%' },
    layout: { display: 'flex', direction: 'column', align: 'center', justify: 'center' },
    spacing: { padding: pad(Math.max(3, Math.round(sizePx / 24))) },
    look: { fill: 'custom', fillColor: PG_BG, radius: 999 },
    advanced: { overflow: 'hidden' },
    content: [inner],
  })],
});

/** A sidebar menu row: icon + link. */
const sideLink = (id: string, icon: string, label: string, href: string) => b('Flex', id, {
  gap: 14, align: 'center', wrap: false,
  spacing: { padding: { top: '10', right: '12', bottom: '10', left: '12' } },
  items: [b('Icon', `${id}-icon`, { name: icon, size: 22, tone: 'text' }), b('Link', `${id}-link`, { label, href, style: 'plain', size: 'md', icon: 'none', newTab: false })],
});

/** One number in the profile header. */
const stat = (id: string, source: string, label: string) => b('Box', id, {
  layout: { display: 'flex', direction: 'column', gap: 2, align: 'center' }, spacing: none,
  content: [
    b('Text', `${id}-value`, { source, size: 'lg', weight: 'bold', align: 'center', tone: 'normal' }),
    b('Text', `${id}-label`, { source: 'custom', text: label, size: 'sm', tone: 'muted', align: 'center' }),
  ],
});

/** A round "highlight": gradient ring with an icon, and its label. Ids start with the section, so switching that section off hides it. */
const highlight = (id: string, icon: string, label: string, href: string) => b('Box', id, {
  layout: { display: 'flex', direction: 'column', gap: 8, align: 'center' }, spacing: none,
  size: { width: '86px', minWidth: '86px' }, item: { shrink: false },
  content: [
    ring(`${id}-ring`, 76, 3, b('Icon', `${id}-icon`, { name: icon, size: 26, tone: 'text', align: 'center' })),
    b('Link', `${id}-link`, { label, href, style: 'plain', size: 'sm', icon: 'none', newTab: false, align: 'center' }),
  ],
});

/** A tab in the row above the grid. */
const feedTab = (id: string, icon: string, label: string, href: string, active = false) => b('Flex', id, {
  gap: 8, align: 'center', wrap: false,
  spacing: { padding: { top: '14', right: '6', bottom: '14', left: '6' } },
  items: [b('Icon', `${id}-icon`, { name: icon, size: 18, tone: active ? 'text' : 'muted' }), b('Link', `${id}-link`, { label, href, style: active ? 'plain' : 'muted', size: 'md', icon: 'none', newTab: false })],
});

/** A titled block in the main column. */
const feedSection = (id: string, anchor: string, content: Block[]) => b('Box', id, {
  layout: { display: 'flex', direction: 'column', gap: 18 },
  spacing: { padding: pad(24, 24), paddingMobile: pad(18, 14) },
  look: { fill: 'custom', fillColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderTone: 'custom', borderColor: PG_LINE, radius: 20 },
  advanced: { tag: 'section', anchor },
  content,
});

/** Stacked (column) boxes must not wrap: a wrapping column squeezes tall content like the project grid. */
function noWrapColumns<T>(value: T): T {
  if (Array.isArray(value)) return value.map(noWrapColumns) as T;
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) out[key] = noWrapColumns(v);
  const layout = out.layout as Record<string, unknown> | undefined;
  if (layout && typeof layout === 'object' && layout.direction === 'column' && layout.wrap === undefined) out.layout = { ...layout, wrap: 'nowrap' };
  return out as T;
}

const profileGrid: DesignData = noWrapColumns({
  root: {
    props: {
      theme: 'arcade',
      colors: { bg: PG_BG, surface: '#111114', surface2: '#18181b', text: '#f5f5f7', muted: '#a1a1aa', line: PG_LINE, accent: '#fafafa', accent2: PG_RING_FROM, accent3: PG_RING_TO },
      headingFont: 'system', bodyFont: 'system', textSize: 'medium', headingWeight: 'bold', headingCase: 'normal',
      radius: 'large', buttonShape: 'theme', buttonStyle: 'solid', width: 'full', direction: 'ltr', effects: 'none', showAskAi: 'yes',
    },
  },
  content: [
    // Phones and tablets: a plain top bar (the sidebar is for big screens).
    b('Box', 'pg-topbar', {
      spacing: { padding: { top: '0', right: '14', bottom: '0', left: '14' } }, look: { fill: 'custom', fillColor: 'rgba(9,9,11,0.92)', borderWidth: 0 },
      advanced: { visibility: 'mobile', sticky: true },
      content: [b('NavBar', 'pg-nav', {
        style: 'bar', overlay: false, showResume: true, sticky: false,
        links: [{ label: 'Projects', href: '#projects' }, { label: 'About', href: '#about' }, { label: 'Experience', href: '#experience' }, { label: 'Skills', href: '#skills' }, { label: 'Contact', href: '#contact' }],
      })],
    }),

    b('Box', 'pg-shell', {
      layout: { display: 'grid', columns: '260px 1fr', columnsTablet: '1fr', columnsMobile: '1fr', gap: 0, rowGap: 0 },
      spacing: none,
      content: [
        // Left: a sticky sidebar with your name, the menu, the resume button and you at the bottom.
        b('Box', 'pg-sidebar', {
          size: { height: '100vh' },
          layout: { display: 'flex', direction: 'column', justify: 'space-between', gap: 24 },
          spacing: { padding: { top: '30', right: '18', bottom: '24', left: '18' } },
          look: { borderWidth: 0, fill: 'none' },
          item: { alignSelf: 'flex-start' },
          advanced: { tag: 'aside', visibility: 'desktop', sticky: true },
          content: [
            b('Box', 'pg-side-top', {
              layout: { display: 'flex', direction: 'column', gap: 4 }, spacing: none,
              content: [
                b('Heading', 'pg-brand', { source: 'name', level: 'h4', sizePx: 22, weight: 'bold', tracking: 'tight' }),
                b('Spacer', 'pg-brand-gap', { size: 'sm', height: 18 }),
                sideLink('pg-side-home', 'home', 'Home', '#home'),
                sideLink('about-side', 'user', 'About', '#about'),
                sideLink('projects-side', 'grid', 'Projects', '#projects'),
                sideLink('experience-side', 'briefcase', 'Experience', '#experience'),
                sideLink('skills-side', 'chart', 'Skills', '#skills'),
                sideLink('contact-side', 'mail', 'Contact', '#contact'),
                b('Spacer', 'pg-side-gap', { size: 'sm', height: 14 }),
                b('Button', 'pg-side-resume', { action: 'resume', label: 'Download resume', style: 'secondary', size: 'md', icon: 'download', fullWidthMobile: true }),
              ],
            }),
            b('Flex', 'pg-side-me', {
              gap: 12, align: 'center', wrap: false,
              items: [
                b('Box', 'pg-side-photo', { size: { width: '40px', height: '40px', minWidth: '40px' }, spacing: none, look: { radius: 999 }, advanced: { overflow: 'hidden' },
                  content: [b('Image', 'pg-side-photo-img', { source: 'profilePhoto', alt: '', aspect: 'circle', rounded: true, maxWidth: 'full', align: 'left' })] }),
                b('Box', 'pg-side-who', { layout: { display: 'flex', direction: 'column', gap: 0 }, spacing: none, content: [
                  b('Text', 'pg-side-name', { source: 'name', size: 'sm', weight: 'bold', tone: 'normal' }),
                  b('Text', 'pg-side-tag', { source: 'custom', text: 'Portfolio', size: 'xs', tone: 'muted' }),
                ] }),
              ],
            }),
          ],
        }),

        // Right: the profile and its feed.
        b('Box', 'pg-main', {
          size: { maxWidth: '1180px' },
          layout: { display: 'flex', direction: 'column', gap: 26 },
          spacing: { padding: { top: '34', right: '40', bottom: '28', left: '40' }, paddingMobile: { top: '20', right: '14', bottom: '20', left: '14' } },
          look: { borderWidth: 0 },
          advanced: { tag: 'main' },
          content: [
            // Profile header: ringed photo, then name, numbers, bio and actions.
            b('Flex', 'pg-profile', {
              gap: 48, align: 'center', stackOnMobile: true,
              items: [
                ring('pg-photo-ring', 176, 4, b('Image', 'pg-photo', { source: 'profilePhoto', alt: 'Profile photo', aspect: 'circle', rounded: true, maxWidth: 'full', align: 'center' })),
                b('Box', 'pg-info', {
                  layout: { display: 'flex', direction: 'column', gap: 14 }, spacing: none, item: { grow: true, basis: '60%' },
                  advanced: { anchor: 'home' },
                  content: [
                    b('Flex', 'pg-name-row', {
                      gap: 14, align: 'center', justify: 'between', stackOnMobile: false,
                      items: [
                        b('Heading', 'pg-name', { source: 'name', level: 'h1', sizePx: 28, weight: 'bold', tracking: 'tight' }),
                        b('Button', 'pg-talk', { action: 'contact', labelSource: 'own', label: 'Let’s talk', style: 'primary', size: 'md', icon: 'arrow', fullWidthMobile: false }),
                      ],
                    }),
                    b('Flex', 'pg-stats', {
                      gap: 36, align: 'center', wrap: true,
                      items: [stat('pg-stat-years', 'years', 'Years exp'), stat('pg-stat-products', 'products', 'Products shipped'), stat('pg-stat-users', 'users', 'Users reached')],
                    }),
                    b('Box', 'pg-bio', {
                      layout: { display: 'flex', direction: 'column', gap: 4 }, spacing: none,
                      content: [
                        b('Text', 'pg-role', { source: 'role', size: 'md', weight: 'medium', tone: 'normal' }),
                        b('Text', 'pg-summary', { source: 'summary', size: 'md', tone: 'normal' }),
                        b('Text', 'pg-current', { source: 'currentRole', size: 'sm', tone: 'muted' }),
                        b('Flex', 'pg-where', { gap: 6, align: 'center', wrap: false, items: [
                          b('Icon', 'pg-where-icon', { name: 'pin', size: 15, tone: 'accent2' }),
                          b('Text', 'pg-where-text', { source: 'location', size: 'sm', tone: 'accent2' }),
                        ] }),
                      ],
                    }),
                    b('Flex', 'pg-actions', {
                      gap: 10, align: 'center', wrap: true, stackOnMobile: false,
                      items: [
                        b('Button', 'pg-resume', { action: 'resume', label: 'Resume', style: 'primary', size: 'sm', icon: 'none', fullWidthMobile: false }),
                        b('Button', 'pg-email', { action: 'email', label: 'Message', style: 'secondary', size: 'sm', icon: 'none', fullWidthMobile: false }),
                        b('Button', 'pg-linkedin', { action: 'linkedin', label: 'LinkedIn', style: 'secondary', size: 'sm', icon: 'linkedin', fullWidthMobile: false }),
                        b('Button', 'pg-github', { action: 'github', label: 'GitHub', style: 'secondary', size: 'sm', icon: 'github', fullWidthMobile: false }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            // Highlights: round shortcuts to each part of the page.
            // One row; on small screens it scrolls sideways.
            b('Box', 'pg-highlights', {
              layout: { display: 'flex', direction: 'row', gap: 22, align: 'flex-start', wrap: 'nowrap', stackOnMobile: false },
              spacing: { padding: { top: '2', right: '2', bottom: '6', left: '2' } },
              advanced: { overflow: 'auto' },
              content: [
                highlight('about-hl', 'user', 'About me', '#about'),
                highlight('skills-hl', 'layers', 'Tech stack', '#skills'),
                highlight('projects-hl', 'code', 'Projects', '#projects'),
                highlight('experience-hl', 'briefcase', 'Work', '#experience'),
                highlight('pg-hl-resume', 'notes', 'Resume', '/api/resume'),
                highlight('contact-hl', 'chat', 'Say hi', '#contact'),
              ],
            }),

            // Tabs over the feed, under a thin line.
            b('Divider', 'pg-tabs-rule', { style: 'line' }),
            b('Box', 'pg-tabs', {
              layout: { display: 'flex', direction: 'row', gap: 40, justify: 'center', wrap: 'wrap', stackOnMobile: false },
              spacing: { padding: { top: '0', right: '0', bottom: '4', left: '0' }, margin: { top: '-18' } },
              content: [
                feedTab('projects-tab', 'grid', 'Posts', '#projects', true),
                feedTab('experience-tab', 'briefcase', 'Journey', '#experience'),
                feedTab('skills-tab', 'layers', 'Stack', '#skills'),
              ],
            }),

            // The feed: projects as image tiles, three across.
            b('Box', 'projects', {
              layout: { display: 'flex', direction: 'column', gap: 12 }, spacing: none,
              advanced: { tag: 'section', anchor: 'projects' },
              content: [
                b('Projects', 'pg-projects', {
                  layout: 'gallery', columns: '3', columnsMobile: '1', filter: 'all', sort: 'featured', limit: 0, image: 'video', hover: 'zoom',
                  frame: 'none', linkStyle: 'arrow', tabs: false, tagStyle: 'chips', showDescription: true, showStack: true, showLinks: false, showType: false,
                  cardStyle: 'plain', cardAlign: 'left', eyebrow: '-', title: '-',
                }),
              ],
            }),

            feedSection('about', 'about', [
              b('Heading', 'about-title', { source: 'custom', text: 'At a glance', level: 'h2', size: 'sm', weight: 'bold' }),
              b('HiringSnapshot', 'about-hiring', { title: '' }),
              b('Stats', 'about-stats', { style: 'inline' }),
            ]),

            feedSection('experience-wrap', 'experience', [
              b('Heading', 'experience-title', { source: 'experienceTitle', level: 'h2', size: 'sm', weight: 'bold' }),
              b('Experience', 'experience-list', { layout: 'timeline', maxBullets: 3, eyebrow: '-', title: '-', description: '-' }),
            ]),

            feedSection('skills-wrap', 'skills', [
              b('Heading', 'skills-title', { source: 'skillsTitle', level: 'h2', size: 'sm', weight: 'bold' }),
              b('Skills', 'skills-list', { layout: 'tabs', align: 'left', eyebrow: '-', title: '-', description: '-' }),
            ]),

            // Contact: a gradient strip.
            b('Box', 'contact', {
              layout: { display: 'flex', direction: 'row', gap: 20, align: 'center', justify: 'space-between', wrap: 'wrap', stackOnMobile: true },
              spacing: { padding: pad(28, 30), paddingMobile: pad(22, 18) },
              look: { fill: 'custom', fillColor: '#0e7490', gradientVia: '#4338ca', gradientTo: '#7e22ce', gradientAngle: 120, radius: 22, textTone: 'custom', textColor: '#ffffff' },
              advanced: { tag: 'section', anchor: 'contact' },
              content: [
                b('Box', 'contact-copy', {
                  layout: { display: 'flex', direction: 'column', gap: 6 }, spacing: none, item: { grow: true, basis: '55%' },
                  content: [
                    b('Heading', 'contact-title', { source: 'contactTitle', level: 'h2', size: 'md', weight: 'bold', tracking: 'tight' }),
                    b('Text', 'contact-text', { source: 'contactDescription', size: 'sm', tone: 'normal' }),
                  ],
                }),
                b('Flex', 'contact-actions', {
                  gap: 12, align: 'center', wrap: true,
                  items: [b('Button', 'contact-button', { action: 'contact', labelSource: 'contactAction', label: 'Get in touch', style: 'primary', size: 'md', icon: 'arrow' }), b('SocialLinks', 'contact-social', { align: 'left', labels: false })],
                }),
              ],
            }),

            b('Footer', 'pg-footer', { showSocial: false }),
          ],
        }),
      ],
    }),
  ],
} as unknown as DesignData);

/**
 * `version`: raise it when a template changes; the owner's copy (in Your templates) is then updated to match the next
 * time the Design tab opens. Pages already made from it don't change until the owner starts from it again.
 */
export const OWNER_TEMPLATES: { key: string; version: number; name: string; description: string; data: DesignData }[] = [
  {
    key: 'glass-studio',
    version: 6,
    name: 'Glass Studio',
    description: 'Apple-style Liquid Glass: a floating glass navigation bar, a sunrise-wallpaper hero with a frosted profile window and an app dock, glass panels on a soft grey page, projects in app windows with a Featured / All switch, tabbed skill chips and a side-by-side journey.',
    data: glassStudio,
  },
  {
    key: 'geek-lab',
    version: 4,
    name: 'Geek Lab',
    description: 'A refined scientist-developer’s study: a soft-focus room behind a whiteboard intro with your photo, a terminal that types itself out, index-card shortcuts, a torn-paper stats strip, paper project cards, rotating quotes in serif and calm paper sheets for skills and experience.',
    data: geekLab,
  },
  {
    key: 'profile-grid',
    version: 1,
    name: 'Profile Grid',
    description: 'A dark social-profile page: a sticky sidebar menu, your photo in a gradient ring with your numbers and bio, round highlight shortcuts, Posts / Journey / Stack tabs, projects as a grid of image tiles, then about, experience, skills and a gradient contact strip.',
    data: profileGrid,
  },
];
