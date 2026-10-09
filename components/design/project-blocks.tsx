import Link from 'next/link';
import type { ComponentConfig } from '@puckeditor/core';
import { ArticleBody } from '@/components/article-body';
import type { ProjectView } from '@/lib/design/project-view';
import { safeHref, safeSrc } from '@/lib/design/theme';
import { ClassicProjectPage } from './classic-project';

/**
 * "This project" blocks for project page designs (Admin → Design → Project pages). Each one shows a part of
 * the project being viewed (title, cover, PDF…), so one design works for every project. In the editor they
 * show the project picked in "Preview with". Every block also gets the usual 🎨 Design side.
 */

type Align = 'left' | 'center' | 'right';
type Puck = { metadata: Record<string, unknown>; isEditing: boolean };
const projectOf = (puck: Puck) => (puck.metadata as { project?: ProjectView }).project;
const alignText = (align: Align) => ({ left: 'text-left', center: 'text-center', right: 'text-right' })[align] ?? 'text-left';
const alignFlex = (align: Align) => ({ left: 'justify-start', center: 'justify-center', right: 'justify-end' })[align] ?? 'justify-start';
const alignField = { type: 'radio' as const, label: 'Align', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] };
const yesNo = (label: string) => ({ type: 'radio' as const, label, options: [{ label: 'Show', value: true }, { label: 'Hide', value: false }] });
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** In the editor, a hint instead of nothing; on the live page, nothing. */
function Empty({ puck, children }: { puck: Puck; children: string }) {
  return puck.isEditing ? <div className="d-prim d-placeholder">{children}</div> : <></>;
}
const NO_PROJECT = 'Shows the project being viewed.';

export type ProjectBarProps = { backLabel: string; showName: boolean; sticky: boolean };
export const ProjectBar: ComponentConfig<ProjectBarProps> = {
  label: 'Back bar (← Projects)',
  fields: { backLabel: { type: 'text', label: 'Back link text' }, showName: yesNo('Your name on the right'), sticky: { type: 'radio', label: 'Stays at the top when scrolling', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } },
  defaultProps: { backLabel: 'Projects', showName: true, sticky: true },
  render: ({ backLabel, showName, sticky, puck }) => {
    const project = projectOf(puck);
    return (
      <header className={`${sticky && !puck.isEditing ? 'sticky top-0 z-30' : ''} border-b backdrop-blur`} style={{ borderColor: 'var(--d-line)', background: 'color-mix(in srgb, var(--d-bg) 85%, transparent)' }}>
        <div className="d-container flex min-h-14 items-center justify-between gap-3">
          <Link href="/#projects" className="d-link -ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold"><span aria-hidden="true">←</span> {backLabel || 'Projects'}</Link>
          {showName && <Link href="/" className="d-muted truncate text-xs font-bold uppercase tracking-wider">{project?.ownerName ?? 'Your name'}</Link>}
        </div>
      </header>
    );
  },
};

export type ProjectTitleProps = { level: 'h1' | 'h2'; size: 'md' | 'lg' | 'xl' | '2xl'; align: Align; eyebrow: boolean; uppercase: boolean };
export const ProjectTitle: ComponentConfig<ProjectTitleProps> = {
  label: 'Project title',
  fields: {
    level: { type: 'radio', label: 'HTML level (SEO)', options: [{ label: 'H1 (page title)', value: 'h1' }, { label: 'H2', value: 'h2' }] },
    size: { type: 'radio', label: 'Size', options: [{ label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }, { label: '2XL', value: '2xl' }] },
    align: alignField,
    eyebrow: yesNo('Small label above (“Case study · 4 min read”)'),
    uppercase: { type: 'radio', label: 'Uppercase', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
  },
  defaultProps: { level: 'h1', size: 'xl', align: 'left', eyebrow: true, uppercase: false },
  render: ({ level, size, align, eyebrow, uppercase, puck }) => {
    const project = projectOf(puck);
    if (!project) return <Empty puck={puck}>{NO_PROJECT}</Empty>;
    const Tag = level === 'h2' ? 'h2' : 'h1';
    const sizes = { md: 'text-2xl md:text-3xl', lg: 'text-3xl md:text-5xl', xl: 'text-[1.9rem] sm:text-5xl md:text-6xl', '2xl': 'text-4xl sm:text-6xl md:text-7xl' };
    return (
      <div className={`d-prim ${alignText(align)}`}>
        {eyebrow && <p className="d-eyebrow mb-3">{project.typeLabel}{project.type !== 'pdf' ? ` · ${project.minutes} min read` : ''}</p>}
        <Tag className={`text-balance break-words font-black leading-[1.1] tracking-tight ${sizes[size] ?? sizes.xl} ${uppercase ? 'uppercase' : ''}`} style={{ fontFamily: 'var(--d-heading-font)' }}>{project.title}</Tag>
      </div>
    );
  },
};

export type ProjectSummaryProps = { size: 'md' | 'lg' | 'xl'; align: Align; readable: boolean };
export const ProjectSummary: ComponentConfig<ProjectSummaryProps> = {
  label: 'Project summary',
  fields: {
    size: { type: 'radio', label: 'Size', options: [{ label: 'M', value: 'md' }, { label: 'L', value: 'lg' }, { label: 'XL', value: 'xl' }] },
    align: alignField,
    readable: { type: 'radio', label: 'Line length', options: [{ label: 'Readable', value: true }, { label: 'Full', value: false }] },
  },
  defaultProps: { size: 'lg', align: 'left', readable: true },
  render: ({ size, align, readable, puck }) => {
    const project = projectOf(puck);
    if (!project?.description) return <Empty puck={puck}>{project ? 'This project has no summary yet.' : NO_PROJECT}</Empty>;
    const sizes = { md: 'text-base leading-7', lg: 'text-base leading-7 sm:text-lg sm:leading-8', xl: 'text-lg leading-8 sm:text-xl sm:leading-9' };
    return (
      <div className={`d-prim ${alignText(align)}`}>
        <p className={`d-muted whitespace-pre-line ${sizes[size] ?? sizes.lg} ${readable ? `max-w-[65ch] ${align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : ''}` : ''}`}>{project.description}</p>
      </div>
    );
  },
};

export type ProjectCoverProps = { aspect: 'auto' | 'video' | 'wide' | 'square'; rounded: boolean };
export const ProjectCover: ComponentConfig<ProjectCoverProps> = {
  label: 'Project cover image',
  fields: {
    aspect: { type: 'radio', label: 'Shape', options: [{ label: 'Original', value: 'auto' }, { label: '16:9', value: 'video' }, { label: '21:9', value: 'wide' }, { label: 'Square', value: 'square' }] },
    rounded: { type: 'radio', label: 'Rounded corners', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
  },
  defaultProps: { aspect: 'wide', rounded: true },
  render: ({ aspect, rounded, puck }) => {
    const project = projectOf(puck);
    const src = safeSrc(project?.image);
    if (!project || !src) return <Empty puck={puck}>{project ? 'This project has no cover image (add one in Admin → Projects). Hidden on the live page.' : NO_PROJECT}</Empty>;
    const shape = { auto: '', video: 'aspect-video object-cover', wide: 'aspect-video object-cover sm:aspect-[21/9]', square: 'aspect-square object-cover' }[aspect] ?? '';
    return (
      <div className="d-prim">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${project.title} cover`} className={`w-full ${shape}`} style={rounded ? { borderRadius: 'var(--d-radius)' } : undefined} />
      </div>
    );
  },
};

export type ProjectTagsProps = { align: Align; style: 'tag' | 'accent' | 'plain' };
export const ProjectTags: ComponentConfig<ProjectTagsProps> = {
  label: 'Project tags (tech / materials)',
  fields: { style: { type: 'radio', label: 'Style', options: [{ label: 'Tags', value: 'tag' }, { label: 'Accent', value: 'accent' }, { label: 'Plain text', value: 'plain' }] }, align: alignField },
  defaultProps: { align: 'left', style: 'tag' },
  render: ({ align, style, puck }) => {
    const project = projectOf(puck);
    if (!project?.stack.length) return <Empty puck={puck}>{project ? 'This project has no tags.' : NO_PROJECT}</Empty>;
    if (style === 'plain') return <p className={`d-prim d-muted text-sm ${alignText(align)}`}>{project.stack.join(' · ')}</p>;
    return (
      <ul aria-label="Tags" className={`d-prim flex flex-wrap gap-2 ${alignFlex(align)}`}>
        {project.stack.map((tag) => <li key={tag} className={`d-tag ${style === 'accent' ? 'd-tag-accent' : ''}`}>{tag}</li>)}
      </ul>
    );
  },
};

export type ProjectLinksProps = { align: Align; live: boolean; repo: boolean; external: boolean; fullWidthMobile: boolean };
export const ProjectLinks: ComponentConfig<ProjectLinksProps> = {
  label: 'Project links (live, code…)',
  fields: { live: yesNo('Live site button'), repo: yesNo('Code (GitHub) button'), external: yesNo('Other link button'), align: alignField, fullWidthMobile: { type: 'radio', label: 'Full width on phones', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } },
  defaultProps: { align: 'left', live: true, repo: true, external: true, fullWidthMobile: true },
  render: ({ align, live, repo, external: showExternal, fullWidthMobile, puck }) => {
    const project = projectOf(puck);
    if (!project) return <Empty puck={puck}>{NO_PROJECT}</Empty>;
    const links = [
      live && safeHref(project.liveUrl) ? { href: project.liveUrl, label: project.labels.live, primary: true } : null,
      repo && safeHref(project.repoUrl) ? { href: project.repoUrl, label: project.labels.github, primary: false } : null,
      showExternal && safeHref(project.externalUrl) ? { href: project.externalUrl, label: project.labels.openLink, primary: false } : null,
    ].filter(Boolean) as { href: string; label: string; primary: boolean }[];
    if (!links.length) return <Empty puck={puck}>This project has no links. Hidden on the live page.</Empty>;
    return (
      <div className={`d-prim flex flex-wrap gap-3 ${alignFlex(align)}`}>
        {links.map((link) => <a key={link.href} href={link.href} {...external} className={`d-btn ${link.primary ? 'd-btn-primary' : 'd-btn-secondary'} ${fullWidthMobile ? 'max-sm:w-full' : ''}`}>{link.label}</a>)}
      </div>
    );
  },
};

type DetailKey = 'objective' | 'approach' | 'architecture' | 'result';
export type ProjectDetailsProps = { layout: 'grid' | 'stack'; objective: string; approach: string; architecture: string; result: string; style: 'cards' | 'plain' };
export const ProjectDetails: ComponentConfig<ProjectDetailsProps> = {
  label: 'Case study details',
  fields: {
    layout: { type: 'radio', label: 'Layout', options: [{ label: 'Two columns', value: 'grid' }, { label: 'One under another', value: 'stack' }] },
    style: { type: 'radio', label: 'Style', options: [{ label: 'Cards', value: 'cards' }, { label: 'Plain', value: 'plain' }] },
    objective: { type: 'text', label: 'Heading for “Objective” (empty = hide)' },
    approach: { type: 'text', label: 'Heading for “Approach” (empty = hide)' },
    architecture: { type: 'text', label: 'Heading for “Architecture” (empty = hide)' },
    result: { type: 'text', label: 'Heading for “Result” (empty = hide)' },
  },
  defaultProps: { layout: 'grid', style: 'cards', objective: 'Objective', approach: 'Approach', architecture: 'Architecture', result: 'Result' },
  render: ({ layout, style, puck, ...headings }) => {
    const project = projectOf(puck);
    if (!project) return <Empty puck={puck}>{NO_PROJECT}</Empty>;
    const keys: DetailKey[] = ['objective', 'approach', 'architecture', 'result'];
    const shown = keys.filter((key) => headings[key]?.trim() && project[key]);
    if (!shown.length) return <Empty puck={puck}>This project has no case study details (Objective, Approach…). Hidden on the live page.</Empty>;
    return (
      <div className={`d-prim grid grid-cols-1 gap-4 sm:gap-5 ${layout === 'grid' ? 'md:grid-cols-2' : ''}`}>
        {shown.map((key) => (
          <section key={key} className={`min-w-0 ${style === 'cards' ? 'd-card p-5' : ''} ${key === 'architecture' && layout === 'grid' ? 'md:col-span-2' : ''}`}>
            <h2 className="d-eyebrow">{headings[key]}</h2>
            {key === 'architecture'
              ? <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre rounded-lg p-3 font-mono text-xs leading-6" style={{ background: 'var(--d-surface-2)' }} tabIndex={0} aria-label={`${headings[key]} diagram`}>{project[key]}</pre>
              : <p className="d-muted mt-3 whitespace-pre-line leading-7">{project[key]}</p>}
          </section>
        ))}
      </div>
    );
  },
};

export type ProjectStoryProps = { heading: string };
export const ProjectStory: ComponentConfig<ProjectStoryProps> = {
  label: 'Project write-up (long text)',
  fields: { heading: { type: 'text', label: 'Small heading above (optional)' } },
  defaultProps: { heading: '' },
  render: ({ heading, puck }) => {
    const project = projectOf(puck);
    if (!project?.content) return <Empty puck={puck}>{project ? 'This project has no write-up (the “Article / deep dive” text in Admin → Projects). Hidden on the live page.' : NO_PROJECT}</Empty>;
    return (
      <div className="d-prim max-w-3xl">
        {heading && <p className="d-eyebrow mb-4">{heading}</p>}
        <ArticleBody content={project.content} />
      </div>
    );
  },
};

export type ProjectContactProps = { heading: string; text: string; emailLabel: string; linkedinLabel: string };
export const ProjectContact: ComponentConfig<ProjectContactProps> = {
  label: 'Get in touch (after the project)',
  fields: { heading: { type: 'text', label: 'Heading' }, text: { type: 'textarea', label: 'Text' }, emailLabel: { type: 'text', label: 'Email button (empty = hide)' }, linkedinLabel: { type: 'text', label: 'LinkedIn button (empty = hide)' } },
  defaultProps: { heading: 'Want to talk about this?', text: 'I’m happy to walk through the details, choices and results.', emailLabel: 'Email me', linkedinLabel: 'LinkedIn ↗' },
  render: ({ heading, text, emailLabel, linkedinLabel, puck }) => {
    const project = projectOf(puck);
    const email = emailLabel && project?.contact.email;
    const linkedin = linkedinLabel && safeHref(project?.contact.linkedin);
    if (!email && !linkedin) return <Empty puck={puck}>Add your email or LinkedIn in Admin → Profile to show these buttons.</Empty>;
    return (
      <aside className="d-prim d-card p-5 sm:p-6">
        {heading && <h2 className="text-lg font-black sm:text-xl">{heading}</h2>}
        {text && <p className="d-muted mt-1 text-sm leading-6">{text}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {email && <a href={project!.contact.email} className="d-btn d-btn-primary max-sm:w-full">{emailLabel}</a>}
          {linkedin && <a href={linkedin} {...external} className="d-btn d-btn-secondary max-sm:w-full">{linkedinLabel}</a>}
        </div>
      </aside>
    );
  },
};

export type ProjectNavProps = { allLabel: string; showAll: boolean };
export const ProjectNav: ComponentConfig<ProjectNavProps> = {
  label: 'Previous / next project',
  fields: { showAll: yesNo('“All projects” link'), allLabel: { type: 'text', label: '“All projects” text' } },
  defaultProps: { allLabel: '← All projects', showAll: true },
  render: ({ allLabel, showAll, puck }) => {
    const project = projectOf(puck);
    if (!project) return <Empty puck={puck}>{NO_PROJECT}</Empty>;
    const { previous, next } = project;
    return (
      <nav aria-label="More projects" className="d-prim">
        {(previous || next) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {previous && (
              <Link href={`/projects/${previous.slug}`} className="d-card group min-w-0 p-4 sm:p-5">
                <span className="d-muted text-[11px] font-bold uppercase tracking-[.2em]">← Previous</span>
                <span className="mt-1 block truncate font-bold">{previous.title}</span>
              </Link>
            )}
            {next && (
              <Link href={`/projects/${next.slug}`} className="d-card group min-w-0 p-4 text-right sm:col-start-2 sm:p-5">
                <span className="d-muted text-[11px] font-bold uppercase tracking-[.2em]">Next →</span>
                <span className="mt-1 block truncate font-bold">{next.title}</span>
              </Link>
            )}
          </div>
        )}
        {showAll && <p className="mt-6 text-center"><Link href="/#projects" className="d-link inline-flex min-h-11 items-center text-sm font-bold">{allLabel || '← All projects'}</Link></p>}
      </nav>
    );
  },
};

export const ProjectClassic: ComponentConfig<Record<string, never>> = {
  label: 'Classic project page (built-in, whole page)',
  fields: {},
  defaultProps: {},
  render: ({ puck }) => {
    const project = projectOf(puck);
    if (!project) return <Empty puck={puck}>{NO_PROJECT}</Empty>;
    return <div className="d-classic"><ClassicProjectPage project={project} /></div>;
  },
};

export const PROJECT_BLOCKS = {
  ProjectBar, ProjectTitle, ProjectSummary, ProjectCover, ProjectTags, ProjectLinks, ProjectDetails, ProjectStory, ProjectContact, ProjectNav, ProjectClassic,
};
export type ProjectBlockName = keyof typeof PROJECT_BLOCKS;
export const PROJECT_BLOCK_NAMES = Object.keys(PROJECT_BLOCKS) as ProjectBlockName[];
