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

// ---------------------------------------------------------------- Profile Grid (a social-profile page, from the owner's mockups)
// An original take on a social profile: no real app's name, logo, verified badge or colours. On big screens a
// sticky sidebar; on phones an app layout (top bar, photo beside the numbers, story circles, icon tabs, an
// edge-to-edge grid and a tab bar at the bottom). Every circle, row and tab is a link that scrolls smoothly.

const PG_BG = '#09090b';
const PG_LINE = 'rgba(255,255,255,0.1)';
const PG_RING_FROM = '#22d3ee';
const PG_RING_VIA = '#6366f1';
const PG_RING_TO = '#a855f7';

/** A gradient ring around something round (the photo, each story circle). */
const ring = (id: string, sizePx: number, thickness: number, inner: Block) => b('Box', id, {
  size: { width: `${sizePx}px`, height: `${sizePx}px`, minWidth: `${sizePx}px` },
  layout: { display: 'flex', direction: 'column', align: 'stretch', justify: 'center' },
  spacing: { padding: pad(thickness) },
  look: { fill: 'custom', fillColor: PG_RING_FROM, gradientVia: PG_RING_VIA, gradientTo: PG_RING_TO, gradientAngle: 45, radius: 999 },
  item: { shrink: false },
  content: [b('Box', `${id}-gap`, {
    size: { width: '100%', height: '100%' },
    layout: { display: 'flex', direction: 'column', align: 'center', justify: 'center' },
    spacing: { padding: pad(Math.max(3, Math.round(sizePx / 26))) },
    look: { fill: 'custom', fillColor: PG_BG, radius: 999 },
    advanced: { overflow: 'hidden' },
    content: [inner],
  })],
});

/** A box that is a link (whole area tappable). */
const linkBox = (id: string, href: string, label: string, props: Record<string, unknown>, content: Block[]) => b('Box', id, {
  ...props, advanced: { ...(props.advanced as object ?? {}), link: href, linkLabel: label }, content,
});

/** A sidebar menu row (desktop). */
const sideRow = (id: string, icon: string, label: string, href: string) => linkBox(id, href, '', {
  layout: { display: 'flex', direction: 'row', gap: 14, align: 'center', wrap: 'nowrap', stackOnMobile: false },
  spacing: { padding: { top: '11', right: '12', bottom: '11', left: '12' } },
  look: { radius: 12 },
}, [b('Icon', `${id}-icon`, { name: icon, size: 22, tone: 'text' }), b('Text', `${id}-label`, { source: 'custom', text: label, size: 'md', weight: 'medium', tone: 'normal' })]);

/** A story circle: the whole thing is a link. Ids start with the section, so switching it off hides the circle. */
const story = (id: string, icon: string, label: string, href: string) => linkBox(id, href, '', {
  layout: { display: 'flex', direction: 'column', gap: 7, align: 'center' }, spacing: { padding: pad(2) },
  size: { width: '84px', minWidth: '84px' }, item: { shrink: false }, look: { radius: 14 },
}, [
  ring(`${id}-ring`, 72, 3, b('Icon', `${id}-icon`, { name: icon, size: 24, tone: 'text', align: 'center' })),
  b('Text', `${id}-label`, { source: 'custom', text: label, sizePx: 12, align: 'center', tone: 'normal' }),
]);

/** An icon in the phone's top bar or bottom tab bar. */
const barIcon = (id: string, icon: string, label: string, href: string, sizePx = 25) => linkBox(id, href, label, {
  layout: { display: 'flex', direction: 'row', align: 'center', justify: 'center' },
  spacing: { padding: pad(9) }, look: { radius: 12 },
}, [b('Icon', `${id}-icon`, { name: icon, size: sizePx, tone: 'text', align: 'center' })]);

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

/** A text link in the header row ("Projects | Experience …"). */
const headLink = (id: string, label: string, href: string) => linkBox(id, href, '', {
  layout: { display: 'flex', direction: 'row', align: 'center' }, spacing: { padding: { top: '4', right: '8', bottom: '4', left: '8' } }, look: { radius: 8 },
}, [b('Text', `${id}-label`, { source: 'custom', text: label, sizePx: 14, weight: 'medium', tone: 'normal' })]);

/** "● Available for opportunities": a soft green pill (hidden when you're not available). */
const availablePill = (id: string) => b('Flex', id, {
  gap: 7, align: 'center', wrap: false,
  items: [b('Icon', `${id}-dot`, { name: 'dot', size: 11, tone: 'custom', color: '#22c55e' }), b('Text', `${id}-text`, { source: 'availability', sizePx: 13, weight: 'medium', tone: 'normal' })],
  spacing: { padding: { top: '4', right: '12', bottom: '4', left: '9' } },
  colors: { background: 'rgba(34,197,94,0.12)' }, border: { borderWidth: 1, borderTone: 'custom', borderColor: 'rgba(34,197,94,0.45)', radius: '999px' },
});

/** A big button-like link: light (primary) or outlined. */
const bigButton = (id: string, icon: string, label: string, href: string, light: boolean) => linkBox(id, href, '', {
  layout: { display: 'flex', direction: 'row', gap: 9, align: 'center', justify: 'center', wrap: 'nowrap', stackOnMobile: false },
  spacing: { padding: { top: '11', right: '22', bottom: '11', left: '22' }, paddingMobile: { top: '10', right: '12', bottom: '10', left: '12' } },
  look: light ? { fill: 'custom', fillColor: '#f5f5f7', radius: 10, textTone: 'custom', textColor: '#0a0a0b' } : { borderWidth: 1, borderTone: 'custom', borderColor: 'rgba(255,255,255,0.55)', radius: 10 },
  item: { grow: true, basis: '0' },
}, [b('Icon', `${id}-icon`, { name: icon, size: 17, tone: light ? 'custom' : 'text', ...(light ? { color: '#0a0a0b' } : {}) }), b('Text', `${id}-label`, { source: 'custom', text: label, sizePx: 15, weight: 'bold', tone: 'normal' })]);

/** A "post": your photo and name on top, a big picture (icon and title on a colour), the caption below. */
const postCard = (id: string, icon: string, color: string, title: string, text: string) => b('Box', id, {
  layout: { display: 'flex', direction: 'column', gap: 0 }, spacing: none,
  look: { fill: 'custom', fillColor: '#111114', borderWidth: 1, borderTone: 'custom', borderColor: PG_LINE, radius: 18 },
  advanced: { overflow: 'hidden', tag: 'article' },
  content: [
    b('Flex', `${id}-head`, { gap: 10, align: 'center', wrap: false, spacing: { padding: { top: '10', right: '14', bottom: '10', left: '12' } }, items: [
      ring(`${id}-avatar`, 34, 2, b('Image', `${id}-avatar-img`, { source: 'profilePhoto', alt: '', aspect: 'circle', rounded: true, maxWidth: 'full', align: 'center' })),
      b('Text', `${id}-who`, { source: 'name', sizePx: 14, weight: 'bold', tone: 'normal' }),
    ] }),
    b('Box', `${id}-visual`, {
      size: { minHeight: '230px' },
      layout: { display: 'flex', direction: 'column', gap: 14, align: 'center', justify: 'center' },
      spacing: { padding: pad(28) },
      look: { fill: 'custom', fillColor: color, gradientVia: '#1e1b4b', gradientTo: PG_BG, gradientAngle: 160, textTone: 'custom', textColor: '#ffffff', textAlign: 'center' },
      content: [
        b('Icon', `${id}-icon`, { name: icon, size: 54, tone: 'custom', color: '#ffffff', align: 'center' }),
        b('Heading', `${id}-title`, { source: 'custom', text: title, level: 'h3', sizePx: 24, weight: 'bold', tracking: 'tight', align: 'center' }),
      ],
    }),
    b('Box', `${id}-caption`, {
      layout: { display: 'flex', direction: 'column', gap: 4 }, spacing: { padding: { top: '12', right: '14', bottom: '16', left: '14' } },
      content: [
        b('Text', `${id}-cap-title`, { source: 'custom', text: title, sizePx: 14, weight: 'bold', tone: 'normal' }),
        b('Text', `${id}-cap-text`, { source: 'custom', text, sizePx: 14, tone: 'muted' }),
      ],
    }),
  ],
});

/** A tab's area, with side room on phones. */
const tabArea = (id: string, content: Block[]) => b('Box', id, {
  layout: { display: 'flex', direction: 'column', gap: 14 },
  spacing: { padding: pad(0), paddingMobile: { top: '4', right: '12', bottom: '4', left: '12' } },
  advanced: { fitSections: true },
  content,
});

const PG_SERVICES = [
  ['code', '#a78bfa', 'Full-Stack Development', 'Build end-to-end, scalable web applications.'],
  ['cpu', '#c084fc', 'AI & Automation', 'Build AI tools, agents and automate engineering workflows.'],
  ['layers', '#fb923c', 'Product Thinking', 'Turn ideas into usable and valuable products.'],
  ['bolt', '#facc15', 'Performance', 'Improve speed, Core Web Vitals and the overall user experience.'],
] as const;

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
    // Phones: a top bar with your name, resume and contact.
    b('Box', 'pg-topbar', {
      layout: { display: 'flex', direction: 'row', align: 'center', justify: 'space-between', wrap: 'nowrap', stackOnMobile: false },
      spacing: { padding: { top: '6', right: '6', bottom: '6', left: '16' } },
      look: { fill: 'custom', fillColor: 'rgba(9,9,11,0.88)', blur: 16 },
      advanced: { visibility: 'mobile', sticky: true },
      content: [
        b('Heading', 'pg-top-name', { source: 'name', level: 'h4', sizePx: 21, weight: 'bold', tracking: 'tight' }),
        b('Flex', 'pg-top-icons', { gap: 2, align: 'center', wrap: false, items: [
          barIcon('pg-top-resume', 'download', 'Download resume', '/api/resume', 24),
          barIcon('contact-top', 'mail', 'Contact', '#contact', 24),
        ] }),
      ],
    }),

    b('Box', 'pg-shell', {
      layout: { display: 'grid', columns: '260px 1fr', columnsTablet: '1fr', columnsMobile: '1fr', gap: 0, rowGap: 0 },
      spacing: none,
      content: [
        // Big screens: a sticky sidebar.
        b('Box', 'pg-sidebar', {
          size: { height: '100vh' },
          layout: { display: 'flex', direction: 'column', justify: 'space-between', gap: 20 },
          spacing: { padding: { top: '28', right: '16', bottom: '22', left: '16' } },
          look: { borderWidth: 0 },
          item: { alignSelf: 'flex-start' },
          advanced: { tag: 'aside', visibility: 'desktop', sticky: true, overflow: 'auto' },
          content: [
            b('Box', 'pg-side-top', {
              layout: { display: 'flex', direction: 'column', gap: 2 }, spacing: none,
              content: [
                b('Flex', 'pg-brand-row', { gap: 10, align: 'center', wrap: false, spacing: { padding: { top: '0', right: '0', bottom: '0', left: '10' } }, items: [
                  b('Icon', 'pg-brand-icon', { name: 'sparkle', size: 22, tone: 'custom', color: PG_RING_TO }),
                  b('Heading', 'pg-brand', { source: 'name', level: 'h4', sizePx: 21, weight: 'bold', tracking: 'tight' }),
                ] }),
                b('Spacer', 'pg-brand-gap', { size: 'sm', height: 18 }),
                sideRow('pg-side-home', 'home', 'Home', '#home'),
                sideRow('pg-side-about', 'user', 'About', '#profile'),
                sideRow('projects-side', 'grid', 'Projects', '#projects'),
                sideRow('pg-side-what', 'layers', 'What I Do', '#what-i-do'),
                sideRow('skills-side', 'sparkle', 'Tech Stack', '#skills'),
                sideRow('experience-side', 'briefcase', 'Experience', '#experience'),
                sideRow('contact-side', 'send', 'Contact', '#contact'),
              ],
            }),
            b('Box', 'pg-side-bottom', {
              layout: { display: 'flex', direction: 'column', gap: 14 }, spacing: none,
              content: [
                // View resume, in a gradient frame.
                b('Box', 'pg-side-resume-ring', {
                  spacing: { padding: pad(2) },
                  look: { fill: 'custom', fillColor: '#f59e0b', gradientVia: '#ec4899', gradientTo: PG_RING_TO, gradientAngle: 90, radius: 14 },
                  content: [linkBox('pg-side-resume', '/api/resume', '', {
                    layout: { display: 'flex', direction: 'row', gap: 9, align: 'center', justify: 'center', wrap: 'nowrap', stackOnMobile: false },
                    spacing: { padding: pad(12) }, look: { fill: 'custom', fillColor: '#111114', radius: 12 },
                  }, [b('Icon', 'pg-side-resume-icon', { name: 'download', size: 17, tone: 'text' }), b('Text', 'pg-side-resume-label', { source: 'custom', text: 'View Resume', sizePx: 15, weight: 'bold', tone: 'normal' })])],
                }),
                // Availability and where.
                b('Box', 'pg-side-card', {
                  layout: { display: 'flex', direction: 'column', gap: 10 },
                  spacing: { padding: pad(14) },
                  look: { fill: 'custom', fillColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderTone: 'custom', borderColor: PG_LINE, radius: 14 },
                  content: [
                    b('Flex', 'pg-side-open', { gap: 10, align: 'start', wrap: false, items: [b('Icon', 'pg-side-open-icon', { name: 'bolt', size: 17, tone: 'custom', color: '#facc15', spacing: { margin: { top: '2' } } }), b('Text', 'pg-side-open-text', { source: 'availability', sizePx: 13, weight: 'medium', tone: 'normal' })] }),
                    b('Flex', 'pg-side-where', { gap: 10, align: 'center', wrap: false, items: [b('Icon', 'pg-side-where-icon', { name: 'pin', size: 17, tone: 'muted' }), b('Text', 'pg-side-where-text', { source: 'location', sizePx: 13, tone: 'normal' })] }),
                  ],
                }),
                b('SocialLinks', 'pg-side-social', { align: 'left', labels: false }),
              ],
            }),
          ],
        }),

        // The profile and its feed.
        b('Box', 'pg-main', {
          size: { maxWidth: '1180px' },
          layout: { display: 'flex', direction: 'column', gap: 22 },
          spacing: { padding: { top: '30', right: '40', bottom: '20', left: '40' }, paddingMobile: { top: '10', right: '0', bottom: '6', left: '0' } },
          advanced: { tag: 'main', anchor: 'home' },
          content: [
            // The profile: photo, links, who you are, availability, bio and two buttons.
            b('Box', 'pg-profile', {
              layout: { display: 'flex', direction: 'column', gap: 12 },
              spacing: { padding: pad(0), paddingMobile: { top: '6', right: '16', bottom: '0', left: '16' } },
              advanced: { anchor: 'profile' },
              content: [
                b('Box', 'pg-profile-row', {
                  layout: { display: 'flex', direction: 'row', gap: 36, align: 'center', wrap: 'nowrap', stackOnMobile: false }, spacing: none,
                  content: [
                    b('Box', 'pg-photo-big', { spacing: none, advanced: { visibility: 'desktop' }, content: [
                      ring('pg-photo-ring', 168, 4, b('Image', 'pg-photo', { source: 'profilePhoto', alt: 'Profile photo', aspect: 'circle', rounded: true, maxWidth: 'full', align: 'center' })),
                    ] }),
                    b('Box', 'pg-photo-small', { spacing: none, advanced: { visibility: 'mobile' }, content: [
                      ring('pg-m-photo-ring', 92, 3, b('Image', 'pg-m-photo', { source: 'profilePhoto', alt: 'Profile photo', aspect: 'circle', rounded: true, maxWidth: 'full', align: 'center' })),
                    ] }),
                    b('Box', 'pg-profile-side', {
                      layout: { display: 'flex', direction: 'column', gap: 10 }, spacing: none, item: { grow: true, basis: '0' },
                      content: [
                        b('Heading', 'pg-name', { source: 'name', level: 'h1', sizePx: 26, weight: 'bold', tracking: 'tight', more: { visibility: 'desktop' } }),
                        b('Flex', 'pg-head-links', { gap: 4, align: 'center', wrap: true, items: [
                          headLink('projects-head-link', 'Projects', '#projects'),
                          headLink('pg-head-what', 'What I Do', '#what-i-do'),
                          headLink('experience-head-link', 'Experience', '#experience'),
                          headLink('skills-head-link', 'Tech Stack', '#skills'),
                        ] }),
                        // Big screens: the rest beside the photo.
                        b('Box', 'pg-bio', {
                          layout: { display: 'flex', direction: 'column', gap: 6 }, spacing: none, advanced: { visibility: 'desktop' },
                          content: [
                            b('Flex', 'pg-who', { gap: 14, align: 'center', wrap: true, items: [
                              b('Heading', 'pg-full-name', { source: 'name', level: 'h2', sizePx: 18, weight: 'bold' }),
                              availablePill('pg-open'),
                            ] }),
                            b('Flex', 'pg-where', { gap: 8, align: 'center', wrap: true, items: [
                              b('Text', 'pg-current', { source: 'currentRole', sizePx: 14, tone: 'normal' }),
                              b('Text', 'pg-dot', { source: 'custom', text: '·', sizePx: 14, tone: 'muted' }),
                              b('Icon', 'pg-where-icon', { name: 'pin', size: 14, tone: 'muted' }),
                              b('Text', 'pg-where-text', { source: 'location', sizePx: 14, tone: 'normal' }),
                            ] }),
                            b('Text', 'pg-summary', { source: 'summary', sizePx: 15, tone: 'muted', maxWidth: 'prose' }),
                            b('Box', 'pg-buttons', {
                              layout: { display: 'flex', direction: 'row', gap: 12, align: 'center', wrap: 'nowrap', stackOnMobile: false },
                              size: { maxWidth: '360px' }, spacing: { padding: { top: '8', right: '0', bottom: '0', left: '0' } },
                              content: [bigButton('pg-resume', 'download', 'View Resume', '/api/resume', true), bigButton('contact-button-top', 'send', 'Contact', '#contact', false)],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                // Phones: the rest under the photo.
                b('Box', 'pg-m-bio', {
                  layout: { display: 'flex', direction: 'column', gap: 6 }, spacing: none, advanced: { visibility: 'mobile' },
                  content: [
                    b('Text', 'pg-m-name', { source: 'name', sizePx: 17, weight: 'bold', tone: 'normal' }),
                    b('Text', 'pg-m-current', { source: 'currentRole', sizePx: 14, tone: 'normal' }),
                    b('Flex', 'pg-m-where', { gap: 10, align: 'center', wrap: true, items: [
                      b('Flex', 'pg-m-place', { gap: 5, align: 'center', wrap: false, items: [b('Icon', 'pg-m-where-icon', { name: 'pin', size: 15, tone: 'text' }), b('Text', 'pg-m-where-text', { source: 'location', sizePx: 14, tone: 'normal' })] }),
                      availablePill('pg-m-open'),
                    ] }),
                    b('Text', 'pg-m-summary', { source: 'summary', sizePx: 14, tone: 'normal' }),
                    b('Box', 'pg-m-buttons', {
                      layout: { display: 'flex', direction: 'row', gap: 10, align: 'stretch', wrap: 'nowrap', stackOnMobile: false }, spacing: { padding: { top: '6', right: '0', bottom: '0', left: '0' } },
                      content: [bigButton('pg-m-resume', 'download', 'View Resume', '/api/resume', true), bigButton('contact-m-button', 'send', 'Contact', '#contact', false)],
                    }),
                  ],
                }),
              ],
            }),

            // Story circles: one row; on phones it scrolls sideways.
            b('Box', 'pg-stories', {
              layout: { display: 'flex', direction: 'row', gap: 22, align: 'flex-start', justify: 'center', wrap: 'nowrap', stackOnMobile: false },
              spacing: { padding: { top: '2', right: '2', bottom: '6', left: '2' }, paddingMobile: { top: '4', right: '12', bottom: '4', left: '12' } },
              advanced: { overflow: 'auto' },
              content: [
                story('pg-story-about', 'user', 'About', '#profile'),
                story('pg-story-what', 'layers', 'What I Do', '#what-i-do'),
                story('projects-story', 'code', 'Projects', '#projects'),
                story('skills-story', 'sparkle', 'Tech Stack', '#skills'),
                story('experience-story', 'briefcase', 'Experience', '#experience'),
                story('contact-story', 'mail', 'Contact', '#contact'),
              ],
            }),

            // Tabs like a social profile: one area at a time. Menu rows, story circles and the bottom bar open them too.
            b('ProfileTabs', 'pg-tabs', {
              stickyTopMobile: 54, stickyTopDesktop: 0,
              tabs: [
                { label: 'Projects', icon: 'grid', href: '#projects', panel: 'panel1' },
                { label: 'What I Do', icon: 'bolt', href: '#what-i-do', panel: 'panel2' },
                { label: 'Tech Stack', icon: 'layers', href: '#skills', panel: 'panel3' },
                { label: 'Experience', icon: 'briefcase', href: '#experience', panel: 'panel4' },
              ],
              panel1: [b('Box', 'projects-area', {
                layout: { display: 'flex', direction: 'column', gap: 0 }, spacing: none, advanced: { fitSections: true },
                content: [b('Projects', 'pg-projects', {
                  layout: 'feed', columns: '3', columnsMobile: '2', filter: 'all', sort: 'featured', limit: 0, image: 'video', hover: 'zoom',
                  frame: 'none', linkStyle: 'arrow', tabs: false, tagStyle: 'chips', showDescription: true, showStack: true, showLinks: false, showType: false,
                  cardStyle: 'plain', cardAlign: 'left', eyebrow: '-', title: '-',
                })],
              })],
              panel2: [tabArea('pg-what', [
                b('Grid', 'pg-what-grid', { columns: '2', columnsTablet: '2', columnsMobile: '1', gap: 16,
                  items: PG_SERVICES.map(([icon, color, title, text], i) => postCard(`pg-what-${i}`, icon, color, title, text)) }),
              ])],
              panel3: [tabArea('skills-area', [
                b('Skills', 'skills-list', { layout: 'cards', align: 'left', eyebrow: '-', title: '-', description: '-' }),
              ])],
              panel4: [tabArea('experience-area', [
                b('Experience', 'experience-list', { layout: 'cards', maxBullets: 3, eyebrow: '-', title: '-', description: '-' }),
              ])],
            }),

            // Contact: a small, quiet card (the header and the bottom bar link here).
            b('Box', 'pg-contact-wrap', {
              spacing: { padding: pad(0), paddingMobile: { top: '0', right: '12', bottom: '0', left: '12' } },
              content: [b('Box', 'contact', {
                layout: { display: 'flex', direction: 'row', gap: 16, align: 'center', justify: 'space-between', wrap: 'wrap', stackOnMobile: true },
                spacing: { padding: pad(20, 22), paddingMobile: pad(16, 16) },
                look: { fill: 'custom', fillColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderTone: 'custom', borderColor: PG_LINE, radius: 18 },
                advanced: { tag: 'section', anchor: 'contact' },
                content: [
                  b('Box', 'contact-copy', {
                    layout: { display: 'flex', direction: 'column', gap: 3 }, spacing: none, item: { grow: true, basis: '50%' },
                    content: [
                      b('Heading', 'contact-title', { source: 'custom', text: 'Let’s work together', level: 'h2', sizePx: 18, weight: 'bold', tracking: 'tight' }),
                      b('Text', 'contact-text', { source: 'contactDescription', sizePx: 14, tone: 'muted' }),
                    ],
                  }),
                  b('Flex', 'contact-actions', {
                    gap: 10, align: 'center', wrap: true, stackOnMobile: false,
                    items: [
                      b('Button', 'contact-button', { action: 'email', label: 'Email me', style: 'primary', size: 'sm', icon: 'mail', fullWidthMobile: false }),
                      b('SocialLinks', 'contact-social', { align: 'left', labels: false }),
                    ],
                  }),
                ],
              })],
            }),
            b('Footer', 'pg-footer', { showSocial: false }),
          ],
        }),
      ],
    }),

    // Phones: an app tab bar pinned to the bottom.
    b('Box', 'pg-dock', {
      layout: { display: 'flex', direction: 'row', align: 'center', justify: 'space-around', wrap: 'nowrap', stackOnMobile: false },
      spacing: { padding: { top: '4', right: '8', bottom: '4', left: '8' } },
      look: { fill: 'custom', fillColor: 'rgba(9,9,11,0.9)', borderWidth: 0 },
      advanced: { visibility: 'mobile', dock: true, tag: 'nav' },
      content: [
        barIcon('pg-dock-home', 'home', 'Home', '#home'),
        barIcon('projects-dock', 'grid', 'Projects', '#projects'),
        barIcon('pg-dock-what', 'bolt', 'What I Do', '#what-i-do'),
        barIcon('experience-dock', 'briefcase', 'Experience', '#experience'),
        barIcon('contact-dock', 'mail', 'Contact', '#contact'),
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
    version: 5,
    name: 'Profile Grid',
    description: 'A dark social-profile page. Big screens: a sticky sidebar (menu, View Resume, availability, socials), your photo in a gradient ring with quick links, an availability pill, bio and two buttons, story circles and tabs over a grid of project tiles, with tabs that show one area at a time: Projects, What I Do (as post cards), Tech Stack and Experience. Phones: an app layout with a top bar, swipeable story circles, icon tabs, an edge-to-edge 3-across grid and a tab bar at the bottom. Everything scrolls smoothly to its section.',
    data: profileGrid,
  },
];
