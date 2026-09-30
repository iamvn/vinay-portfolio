/**
 * Blocks that show the portfolio's live content (profile, projects, experience, skills, site text).
 * The words come from the other admin tabs; a design only decides how they look and where they go.
 * Server-safe: no hooks here (interactive parts live in client components).
 */
import type { ReactNode } from 'react';
import type { PortfolioData } from '@/lib/portfolio';
import { safeHref, safeSrc } from '@/lib/design/theme';
import { Icon } from '../icons';
import { ContactButtons } from './contact-buttons';

type Portfolio = PortfolioData;
type Project = Portfolio['projects'][number];

/** A block setting, or the site text when it's empty. "-" hides the line altogether. */
export const or = (value: string | undefined | null, fallback: string) => (value?.trim() === '-' ? '' : value && value.trim() ? value : fallback);
const initialsOf = (text: string) => text.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
const mailto = (email: string) => (email.startsWith('mailto:') ? email : `mailto:${email}`);

/** Standard vertical rhythm + width for a portfolio block. */
function Block({ id, pad = 'md', children, className = '' }: { id?: string; pad?: 'sm' | 'md' | 'lg'; children: ReactNode; className?: string }) {
  const padding = { sm: 'py-6', md: 'py-10 md:py-14', lg: 'py-14 md:py-24' }[pad];
  return <section id={id} className={`d-block scroll-mt-20 ${padding} ${className}`}><div className="d-container">{children}</div></section>;
}

export function SectionHeading({ eyebrow, title, description, align = 'left' }: { eyebrow?: string; title?: string; description?: string; align?: 'left' | 'center' }) {
  if (!eyebrow && !title && !description) return null;
  return (
    <div className={`mb-8 ${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-3xl'}`}>
      {eyebrow && <p className="d-eyebrow">{eyebrow}</p>}
      {title && <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{title}</h2>}
      {description && <p className="d-muted mt-3 text-sm md:text-base">{description}</p>}
    </div>
  );
}

/* ---------- Social icons ---------- */

export function SocialIcons({ profile, size = 'md', align = 'left', labels = false }: { profile: Portfolio['profile']; size?: 'sm' | 'md'; align?: 'left' | 'center'; labels?: boolean }) {
  const links = profile.socialLinks;
  const items = [
    links.github && { href: links.github, icon: 'github', label: 'GitHub', external: true },
    links.linkedin && { href: links.linkedin, icon: 'linkedin', label: 'LinkedIn', external: true },
    links.instagram && { href: links.instagram, icon: 'instagram', label: 'Instagram', external: true },
    links.email && { href: mailto(links.email), icon: 'gmail', label: 'Email', external: false },
  ].filter(Boolean) as { href: string; icon: string; label: string; external: boolean }[];
  if (items.length === 0) return null;
  const box = size === 'sm' ? 'min-h-10 min-w-10' : 'min-h-12 min-w-12';
  return (
    <div className={`flex flex-wrap gap-2 ${align === 'center' ? 'justify-center' : ''}`}>
      {items.map((item) => (
        <a key={item.label} href={item.href} aria-label={item.label} {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className={`d-card inline-flex ${box} items-center justify-center gap-2 px-3 text-sm font-bold no-underline transition hover:-translate-y-0.5`}>
          <Icon name={item.icon} size={size === 'sm' ? 16 : 19} />{labels && <span>{item.label}</span>}
        </a>
      ))}
    </div>
  );
}

/* ---------- Hero ---------- */

export type HeroProps = {
  variant: 'arcade' | 'centered' | 'split';
  headline: string; subheading: string;
  showPhoto: boolean; showTags: boolean; showSocial: boolean; showStatus: boolean;
  primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string;
};

function Avatar({ profile, className }: { profile: Portfolio['profile']; className: string }) {
  const src = safeSrc(profile.profileImage);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={profile.name} className={`d-avatar ${className}`} />
    : <span className={`d-avatar flex items-center justify-center text-3xl font-black ${className}`}>{initialsOf(profile.name)}</span>;
}

export function Hero(props: HeroProps & { portfolio: Portfolio; extra?: ReactNode }) {
  const { portfolio: { profile, copy } } = props;
  const name = or(props.headline, profile.name);
  const role = or(props.subheading, profile.role);
  const primary = { label: or(props.primaryLabel, copy.hero.primaryAction), href: safeHref(props.primaryHref) ?? '#projects' };
  const secondary = { label: or(props.secondaryLabel, copy.hero.secondaryAction), href: safeHref(props.secondaryHref) ?? '#contact' };
  const buttons = (
    <div className={`mt-8 grid gap-3 sm:flex sm:flex-wrap ${props.variant === 'centered' ? 'sm:justify-center' : ''}`}>
      {primary.label && <a href={primary.href} className="d-btn d-btn-primary">{primary.label}</a>}
      {secondary.label && <a href={secondary.href} className="d-btn d-btn-secondary">{secondary.label}</a>}
    </div>
  );
  const tags = props.showTags && copy.hero.technologies.length > 0 && (
    <div className={`mt-6 flex flex-wrap gap-2 ${props.variant === 'centered' ? 'justify-center' : ''}`}>
      {copy.hero.technologies.map((tech) => <span key={tech} className="d-tag">{tech}</span>)}
    </div>
  );
  const status = props.showStatus && (
    <div className={`d-muted mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs ${props.variant === 'centered' ? 'justify-center' : ''}`}>
      {profile.available && <span className="inline-flex items-center gap-2"><span className="d-dot" /> <span className="d-accent font-bold">{copy.hero.availability}</span></span>}
      {profile.location && <span>⌖ {profile.location}</span>}
    </div>
  );
  const social = props.showSocial && <div className="mt-6"><SocialIcons profile={profile} align={props.variant === 'centered' ? 'center' : 'left'} /></div>;

  if (props.variant === 'centered') {
    return (
      <Block id="home" pad="lg">
        <div className="mx-auto max-w-3xl text-center">
          {props.showPhoto && <Avatar profile={profile} className="mx-auto mb-6 size-28 rounded-full md:size-36" />}
          <p className="d-eyebrow">{copy.hero.greeting}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">{name}</h1>
          <p className="d-accent-2 mt-3 text-base font-bold md:text-xl">{role}</p>
          <p className="d-muted mx-auto mt-6 max-w-2xl text-base leading-7">{profile.summary}</p>
          {tags}{buttons}{social}{status}{props.extra}
        </div>
      </Block>
    );
  }

  if (props.variant === 'split') {
    return (
      <Block id="home" pad="lg">
        <div className="grid items-center gap-10 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="d-eyebrow">{copy.hero.greeting}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">{name}</h1>
            <p className="d-accent-2 mt-3 text-lg font-bold">{role}</p>
            <p className="d-muted mt-6 max-w-xl text-base leading-7">{profile.summary}</p>
            {tags}{buttons}{social}{status}{props.extra}
          </div>
          {props.showPhoto && <Avatar profile={profile} className="aspect-[4/5] w-full max-w-[16rem] justify-self-center md:max-w-sm rounded-[var(--d-radius)] md:justify-self-end" />}
        </div>
      </Block>
    );
  }

  // Arcade: bold uppercase name, terminal card on the right.
  return (
    <Block id="home" pad="sm">
      <div className="d-card relative overflow-hidden px-5 py-10 sm:px-8 md:px-12 md:py-16">
        <div className="relative z-10 max-w-2xl">
          {props.showPhoto && <Avatar profile={profile} className="mb-6 size-20 rounded-[var(--d-radius)]" />}
          <p className="d-accent font-mono text-lg">{copy.hero.greeting}</p>
          <h1 className="mt-2 text-5xl font-black uppercase tracking-tight md:text-7xl">{name}</h1>
          <p className="d-accent-2 mt-2 text-sm font-black uppercase tracking-[.3em] md:text-lg">{role}</p>
          <p className="d-muted mt-6 max-w-xl text-base leading-7">{profile.summary}</p>
          {tags}{buttons}{social}{status}{props.extra}
        </div>
        {copy.hero.terminalLines.length > 0 && (
          <div className="d-card-soft absolute bottom-8 right-8 hidden w-80 p-5 font-mono text-xs leading-6 lg:block">
            {copy.hero.terminalLines.map((line) => <div key={line}><span className="d-accent">&gt;</span> {line}</div>)}
          </div>
        )}
      </div>
    </Block>
  );
}

/* ---------- Hiring snapshot ---------- */

const HIRING_ROWS = [
  { key: 'targetRoles', label: 'Looking for' },
  { key: 'workPreference', label: 'Location & work mode' },
  { key: 'availability', label: 'Availability' },
  { key: 'noticePeriod', label: 'Notice period' },
] as const;

export function Hiring({ portfolio, title, editing }: { portfolio: Portfolio; title: string; editing: boolean }) {
  const profile = portfolio.profile;
  const rows = HIRING_ROWS.filter(({ key }) => profile[key]?.trim());
  if (!profile.available || rows.length === 0) {
    return editing ? <Block pad="sm"><div className="d-placeholder">Hiring snapshot is hidden: turn on “Available for opportunities” and fill in the hiring fields in Admin → Profile.</div></Block> : <></>;
  }
  return (
    <Block pad="sm">
      <div className="d-card p-5 md:p-6" style={{ borderColor: 'color-mix(in srgb, var(--d-accent) 40%, transparent)' }}>
        <p className="d-eyebrow flex items-center gap-2"><span className="d-dot" /> {or(title, 'Hiring snapshot')}</p>
        <dl className={`mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 ${rows.length > 2 ? 'lg:grid-cols-4' : ''}`}>
          {rows.map(({ key, label }) => (
            <div key={key} className="min-w-0">
              <dt className="d-muted text-[11px] font-bold uppercase tracking-wider">{label}</dt>
              <dd className="mt-1 text-sm font-bold">{profile[key]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Block>
  );
}

/* ---------- Stats ---------- */

export function Stats({ portfolio, style }: { portfolio: Portfolio; style: 'cards' | 'inline' }) {
  const { profile, copy } = portfolio;
  const stats = [profile.yearsExperience, profile.productsShipped, profile.performanceMetric, profile.lighthouse, profile.usersImpacted]
    .map((value, index) => ({ value, label: copy.statsLabels[index] ?? '' }))
    .filter((stat) => stat.value?.trim());
  if (stats.length === 0) return <></>;
  if (style === 'inline') {
    return (
      <Block pad="sm">
        <div className={`grid grid-cols-2 gap-6 border-y py-6 ${stats.length >= 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`} style={{ borderColor: 'var(--d-line)' }}>
          {stats.map((stat) => <div key={stat.label} className="min-w-0"><div className="text-2xl font-black md:text-3xl">{stat.value}</div><div className="d-muted mt-1 text-xs font-bold uppercase tracking-wider">{stat.label}</div></div>)}
        </div>
      </Block>
    );
  }
  return (
    <Block pad="sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((stat, index) => (
          <div key={stat.label} className={`d-card p-5 ${index === stats.length - 1 && stats.length % 2 === 1 ? 'col-span-2 md:col-span-1' : ''}`}>
            <div className="text-2xl font-black">{stat.value}</div>
            <div className="d-muted mt-2 text-[11px] font-bold uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>
    </Block>
  );
}

/* ---------- Skills ---------- */

export type SkillsProps = { layout: 'cards' | 'tags' | 'list'; eyebrow: string; title: string; description: string; align: 'left' | 'center' };

export function Skills(props: SkillsProps & { portfolio: Portfolio }) {
  const { skills, copy } = props.portfolio;
  const heading = <SectionHeading align={props.align} eyebrow={or(props.eyebrow, copy.skills.eyebrow)} title={or(props.title, copy.skills.title)} description={or(props.description, copy.skills.description)} />;
  let body: ReactNode;
  if (props.layout === 'tags') {
    body = <div className={`flex flex-wrap gap-2 ${props.align === 'center' ? 'justify-center' : ''}`}>{[...new Set(skills.flatMap((group) => group.items))].map((item) => <span key={item} className="d-tag">{item}</span>)}</div>;
  } else if (props.layout === 'list') {
    body = (
      <dl className="d-line divide-y border-y" style={{ borderColor: 'var(--d-line)' }}>
        {skills.map((group) => (
          <div key={group.group} className="grid gap-2 py-4 md:grid-cols-[14rem_1fr]" style={{ borderColor: 'var(--d-line)' }}>
            <dt className="font-bold">{group.group}</dt>
            <dd className="d-muted text-sm">{group.items.join(' · ')}</dd>
          </div>
        ))}
      </dl>
    );
  } else {
    body = (
      <div className="grid gap-3 md:grid-cols-3">
        {skills.map((group) => (
          <article key={group.group} className="d-card p-5">
            <h3 className="d-accent-2 text-base font-bold">{group.group}</h3>
            <div className="mt-4 flex flex-wrap gap-2">{group.items.map((item) => <span key={item} className="d-tag">{item}</span>)}</div>
          </article>
        ))}
      </div>
    );
  }
  return <Block id="skills">{heading}{body}</Block>;
}

/* ---------- Projects ---------- */

export type ProjectsProps = { layout: 'grid' | 'list'; columns: '2' | '3'; filter: 'all' | 'featured'; limit: number; showStack: boolean; eyebrow: string; title: string; align: 'left' | 'center' };

const projectHref = (project: Project) => (project.type === 'link' ? safeHref(project.externalUrl) ?? '#' : `/projects/${project.slug}`);

function ProjectCover({ project, label, className }: { project: Project; label: string; className: string }) {
  const src = safeSrc(project.image);
  return (
    <div className={`d-card-soft relative flex items-center justify-center overflow-hidden text-4xl font-black ${className}`} style={{ color: 'color-mix(in srgb, var(--d-accent) 35%, transparent)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={`${project.title} preview`} loading="lazy" className="h-full w-full object-cover" /> : initialsOf(project.title)}
      {project.featured && <span className="d-tag d-tag-accent absolute left-2 top-2 text-[10px] font-bold">{label}</span>}
    </div>
  );
}

export function Projects(props: ProjectsProps & { portfolio: Portfolio }) {
  const { projects, copy } = props.portfolio;
  const labels = copy.projects;
  let list = props.filter === 'featured' ? projects.filter((project) => project.featured) : [...projects].sort((a, b) => Number(b.featured) - Number(a.featured));
  if (props.limit > 0) list = list.slice(0, props.limit);
  const external = (project: Project) => (project.type === 'link' ? { target: '_blank', rel: 'noopener noreferrer' } : {});
  const actionLabel = (project: Project) => (project.type === 'article' ? labels.readArticle : project.type === 'link' ? labels.openLink : labels.enter);
  const links = (project: Project) => (
    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs">
      <a href={projectHref(project)} {...external(project)} className="d-link inline-flex min-h-11 items-center md:min-h-0">{actionLabel(project)}</a>
      {safeHref(project.liveUrl) && <a href={safeHref(project.liveUrl)} target="_blank" rel="noopener noreferrer" className="d-accent-2 inline-flex min-h-11 items-center font-bold no-underline md:min-h-0">{labels.live}</a>}
      {safeHref(project.repoUrl) && <a href={safeHref(project.repoUrl)} target="_blank" rel="noopener noreferrer" className="d-muted inline-flex min-h-11 items-center font-bold no-underline md:min-h-0">{labels.github}</a>}
    </div>
  );
  const stack = (project: Project) => props.showStack && project.stack.length > 0 && (
    <div className="mt-3 flex flex-wrap gap-1.5">{project.stack.map((tag) => <span key={tag} className="d-tag d-tag-accent text-[11px]">{tag}</span>)}</div>
  );

  return (
    <Block id="projects">
      <SectionHeading align={props.align} eyebrow={or(props.eyebrow, labels.eyebrow)} title={or(props.title, labels.title)} />
      {list.length === 0 && <p className="d-muted text-sm">No projects to show yet.</p>}
      {props.layout === 'list' ? (
        <div className="grid gap-4">
          {list.map((project) => (
            <article key={project.slug} className="d-card grid gap-5 p-4 md:grid-cols-[16rem_1fr] md:p-5">
              <a href={projectHref(project)} {...external(project)} aria-label={project.title}><ProjectCover project={project} label={labels.featured} className="aspect-video" /></a>
              <div className="flex min-w-0 flex-col">
                <h3 className="text-lg font-black">{project.title}</h3>
                <p className="d-muted mt-2 text-sm leading-6">{project.description}</p>
                {stack(project)}{links(project)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 ${props.columns === '3' ? 'lg:grid-cols-3' : ''}`}>
          {list.map((project) => (
            <article key={project.slug} className="d-card flex flex-col p-4 transition hover:-translate-y-1">
              <a href={projectHref(project)} {...external(project)} aria-label={project.title}><ProjectCover project={project} label={labels.featured} className="aspect-video" /></a>
              <h3 className="mt-4 text-base font-black">{project.title}</h3>
              <p className="d-muted mt-2 text-sm leading-6">{project.description}</p>
              {stack(project)}{links(project)}
            </article>
          ))}
        </div>
      )}
    </Block>
  );
}

/* ---------- Experience ---------- */

export type ExperienceProps = { layout: 'timeline' | 'cards' | 'compact'; maxBullets: number; eyebrow: string; title: string; description: string; align: 'left' | 'center' };

export function Experience(props: ExperienceProps & { portfolio: Portfolio }) {
  const { experience, copy } = props.portfolio;
  const bullets = (items: string[]) => (props.maxBullets > 0 ? items.slice(0, props.maxBullets) : items);
  const badge = <span className="d-tag d-tag-accent text-[10px] font-bold">{copy.experience.current}</span>;
  let body: ReactNode;
  if (props.layout === 'compact') {
    body = (
      <div className="grid gap-5">
        {experience.map((item) => (
          <div key={`${item.company}-${item.period}`} className="grid gap-1 md:grid-cols-[12rem_1fr] md:gap-6">
            <p className="d-muted text-sm">{item.period}</p>
            <div><h3 className="text-base font-bold">{item.role} <span className="d-muted font-normal">· {item.company}</span> {item.current && badge}</h3>
              {bullets(item.bullets).length > 0 && <p className="d-muted mt-1 text-sm leading-6">{bullets(item.bullets).join(' ')}</p>}</div>
          </div>
        ))}
      </div>
    );
  } else if (props.layout === 'cards') {
    body = (
      <div className="grid gap-4 md:grid-cols-2">
        {experience.map((item) => (
          <article key={`${item.company}-${item.period}`} className="d-card p-5">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black">{item.role}</h3>{item.current && badge}</div>
            <p className="d-muted mt-1 text-xs">{item.company} · {item.period}</p>
            <ul className="d-muted mt-3 list-disc space-y-1 pl-5 text-sm leading-6">{bullets(item.bullets).map((b) => <li key={b}>{b}</li>)}</ul>
          </article>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="space-y-8">
        {experience.map((item) => (
          <article key={`${item.company}-${item.period}`} className="relative border-l pl-6" style={{ borderColor: 'var(--d-line)' }}>
            <span className="absolute -left-[6px] top-1.5 size-3 rounded-full" style={{ background: item.current ? 'var(--d-accent)' : 'var(--d-accent-2)' }} />
            <div className="flex flex-wrap items-center gap-3"><h3 className="text-base font-black">{item.role}</h3>{item.current && badge}</div>
            <p className="d-muted mt-1 text-xs">{item.company} · {item.period}</p>
            <ul className="d-muted mt-3 space-y-1 text-sm leading-6">{bullets(item.bullets).map((b) => <li key={b}>• {b}</li>)}</ul>
          </article>
        ))}
      </div>
    );
  }
  return (
    <Block id="experience">
      <SectionHeading align={props.align} eyebrow={or(props.eyebrow, copy.experience.eyebrow)} title={or(props.title, copy.experience.title)} description={or(props.description, copy.experience.description)} />
      {body}
    </Block>
  );
}

/* ---------- Contact ---------- */

export type ContactProps = { style: 'card' | 'plain'; align: 'left' | 'center'; eyebrow: string; title: string; description: string; buttonLabel: string };

export function Contact(props: ContactProps & { portfolio: Portfolio; extra?: ReactNode }) {
  const { profile, copy } = props.portfolio;
  const inner = (
    <div className={props.align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="d-eyebrow">{or(props.eyebrow, copy.contact.eyebrow)}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">{or(props.title, copy.contact.title)}</h2>
      <p className="d-muted mt-3 text-sm leading-6 md:text-base">{or(props.description, copy.contact.description)}</p>
      <ContactButtons email={profile.socialLinks.email} linkedin={profile.socialLinks.linkedin} actionLabel={or(props.buttonLabel, copy.contact.action)} align={props.align} />
      {props.extra}
    </div>
  );
  return (
    <Block id="contact" pad="lg">
      {props.style === 'card' ? <div className="d-card p-6 md:p-12" style={{ background: 'color-mix(in srgb, var(--d-accent) 6%, var(--d-surface))' }}>{inner}</div> : inner}
    </Block>
  );
}

/* ---------- Navigation bar & footer ---------- */

export type NavProps = { brand: string; links: { label: string; href: string }[]; showResume: boolean; sticky: boolean };

export function NavBar(props: NavProps & { portfolio: Portfolio; editing: boolean }) {
  const brand = or(props.brand, props.portfolio.profile.name);
  const links = (props.links ?? []).map((link) => ({ label: link.label, href: safeHref(link.href) })).filter((link) => link.label && link.href);
  return (
    <header className={`d-nav z-30 ${props.sticky && !props.editing ? 'sticky top-0' : ''}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="d-container flex min-h-16 flex-wrap items-center gap-x-4">
        <a href="#home" className="mr-auto flex min-h-14 min-w-0 items-center truncate text-base font-black no-underline">{brand}</a>
        {/* Phones: links get their own swipeable row under the name; larger screens: one line. */}
        <nav aria-label="Sections" className="order-last -mx-2.5 flex w-[calc(100%+1.25rem)] items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:pb-0">
          {links.map((link) => <a key={link.label + link.href} href={link.href} className="d-muted inline-flex min-h-11 shrink-0 items-center px-2.5 text-sm font-semibold no-underline hover:text-[var(--d-text)]">{link.label}</a>)}
        </nav>
        {props.showResume && <a href="/api/resume" className="d-btn d-btn-primary min-h-10 px-4 py-2 text-xs"><Icon name="download" size={15} /> Resume</a>}
      </div>
    </header>
  );
}

export function Footer({ portfolio, text, showSocial }: { portfolio: Portfolio; text: string; showSocial: boolean }) {
  return (
    <footer className="border-t py-8 pb-24 text-center text-xs md:pb-8" style={{ borderColor: 'var(--d-line)' }}>
      <div className="d-container grid justify-items-center gap-4">
        {showSocial && <SocialIcons profile={portfolio.profile} size="sm" align="center" />}
        <p className="d-muted">{or(text, portfolio.copy.footer)}</p>
      </div>
    </footer>
  );
}
