import { prisma } from '@/lib/prisma';
import { parseCopy, toProject } from '@/lib/portfolio-repository';
import { projectPdf } from '@/lib/project-pdf';

/**
 * Everything a project page shows, for project page designs (Admin → Design → Project pages) and the
 * built-in project page. Blocks read it from the design metadata (`metadata.project`).
 */
export type ProjectLink = { slug: string; title: string };
export type ProjectView = {
  slug: string;
  title: string;
  description: string;
  type: 'case-study' | 'article' | 'link' | 'pdf';
  /** "Case study", "Article", "PDF portfolio"… */
  typeLabel: string;
  minutes: number;
  image: string;
  stack: string[];
  liveUrl: string;
  repoUrl: string;
  externalUrl: string;
  objective: string;
  approach: string;
  architecture: string;
  result: string;
  content: string;
  pdf: string;
  published: boolean;
  labels: { live: string; github: string; openLink: string };
  previous: ProjectLink | null;
  next: ProjectLink | null;
  contact: { email: string; linkedin: string };
  ownerName: string;
};

export const TYPE_LABELS: Record<ProjectView['type'], string> = { 'case-study': 'Case study', article: 'Article', link: 'Link', pdf: 'PDF portfolio' };

/** Rough reading time at ~220 words a minute (never less than 1). */
export function readingMinutes(...texts: string[]) {
  const words = texts.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** The project page data, or null when there's no such project. */
export async function projectView(slug: string): Promise<ProjectView | null> {
  const [row, copyRow, profile, published, pdf] = await Promise.all([
    prisma.project.findUnique({ where: { slug } }),
    prisma.siteCopy.findUnique({ where: { id: 1 } }),
    prisma.profile.findUnique({ where: { id: 1 }, select: { name: true, socialLinks: true } }),
    prisma.project.findMany({ where: { published: true }, orderBy: { id: 'asc' }, select: { slug: true, title: true, type: true, externalUrl: true } }),
    projectPdf(slug),
  ]);
  if (!row) return null;
  const project = toProject(row);
  const labels = copyRow ? parseCopy(copyRow.content).projects : null;
  const links = (() => { try { return JSON.parse(profile?.socialLinks ?? '{}') as Record<string, string | undefined>; } catch { return {}; } })();

  // Previous / next project (published ones with their own page, in homepage order), wrapping around.
  const pages = published.filter((item) => !(item.type === 'link' && item.externalUrl));
  const index = pages.findIndex((item) => item.slug === project.slug);
  const previous = index > 0 ? pages[index - 1] : pages.length > 1 && index === 0 ? pages[pages.length - 1] : null;
  const next = index >= 0 && pages.length > 1 ? pages[(index + 1) % pages.length] : pages.find((item) => item.slug !== project.slug) ?? null;
  const type = (['case-study', 'article', 'link', 'pdf'].includes(project.type) ? project.type : 'case-study') as ProjectView['type'];
  const email = links.email ? (links.email.startsWith('mailto:') ? links.email : `mailto:${links.email}`) : '';

  return {
    slug: project.slug,
    title: project.title,
    description: project.description,
    type,
    typeLabel: TYPE_LABELS[type],
    minutes: readingMinutes(project.description, project.objective, project.approach, project.result, project.content),
    image: project.image,
    stack: project.stack,
    liveUrl: project.liveUrl,
    repoUrl: project.repoUrl,
    externalUrl: project.externalUrl,
    objective: project.objective,
    approach: project.approach,
    architecture: project.architecture,
    result: project.result,
    content: project.content,
    pdf,
    published: project.published,
    labels: { live: labels?.live ?? 'LIVE ↗', github: labels?.github ?? 'GITHUB ↗', openLink: labels?.openLink ?? 'OPEN LINK ↗' },
    previous: previous && previous.slug !== next?.slug ? { slug: previous.slug, title: previous.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
    contact: { email, linkedin: links.linkedin ?? '' },
    ownerName: profile?.name ?? 'Portfolio',
  };
}

/** Projects to preview a shared project design with (the editor's "Preview with" list). */
export async function projectChoices() {
  const rows = await prisma.project.findMany({ orderBy: { id: 'asc' }, select: { slug: true, title: true, type: true, published: true } });
  return rows.filter((row) => !(row.type === 'link')).map(({ slug, title, published }) => ({ slug, title, published }));
}
