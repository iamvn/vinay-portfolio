import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { toProject, getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { absoluteUrl, clip, jsonLd } from '@/lib/seo';
import { currentSiteUrl } from '@/lib/sites/url';
import { currentUser } from '@/lib/auth/server';
import { PageTheme } from '@/components/design/page-theme';
import { DesignedPage } from '@/components/design/designed-page';
import { ClassicProjectPage } from '@/components/design/classic-project';
import { getPublished, projectPageDesign } from '@/lib/design/store';
import { projectView } from '@/lib/design/project-view';
import { resolvePortfolio } from '@/lib/placeholders';
import { assistantEnabled } from '@/lib/assistant';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [row, profile] = await Promise.all([
    prisma.project.findUnique({ where: { slug } }),
    prisma.profile.findUnique({ where: { id: 1 } }),
  ]);
  if (!row) return { title: 'Project not found', robots: { index: false, follow: true } };
  const project = toProject(row);
  if (!project.published) return { title: `Draft: ${project.title}`, robots: { index: false, follow: false } };
  const name = profile?.name ?? 'Portfolio';
  const title = `${project.title} | ${name}`;
  const description = clip(project.description);
  const url = `/projects/${project.slug}`;
  // Projects without a cover image fall back to the site-wide preview card.
  const images = project.image
    ? [{ url: absoluteUrl(project.image, await currentSiteUrl()), alt: `${project.title} cover` }]
    : [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${name} — ${profile?.role ?? 'portfolio'}` }];
  return {
    title,
    description,
    keywords: project.stack,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, title, description, images, authors: [name] },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

/**
 * A project page. Shown with, in order: the project's own design (Admin → Design → Project pages → this
 * project), the shared project page design, or the built-in page (in the homepage's theme).
 */
export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [project, SITE_URL] = await Promise.all([projectView(slug), currentSiteUrl()]);
  if (!project) notFound();
  // Drafts are only visible to signed-in admins/editors (to preview before publishing).
  const isDraft = !project.published;
  if (isDraft && !(await currentUser())) notFound();
  // "link" projects have no page of their own: send visitors straight to the link.
  if (project.type === 'link' && project.externalUrl) redirect(project.externalUrl);

  const [chosen, homeDesign] = await Promise.all([projectPageDesign(slug), getPublished()]);

  // Structured data for search engines (breadcrumbs + the project itself). It renders nothing on the page.
  const isArticle = project.type === 'article';
  const pageUrl = `${SITE_URL}/projects/${project.slug}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/#projects` },
          { '@type': 'ListItem', position: 3, name: project.title, item: pageUrl },
        ],
      },
      {
        '@type': isArticle ? 'Article' : 'CreativeWork',
        '@id': `${pageUrl}#work`,
        url: pageUrl,
        ...(isArticle ? { headline: project.title } : { name: project.title }),
        description: project.description,
        ...(project.image ? { image: absoluteUrl(project.image, SITE_URL) } : {}),
        ...(project.stack.length ? { keywords: project.stack.join(', ') } : {}),
        author: { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: project.ownerName, url: `${SITE_URL}/` },
        ...(project.liveUrl || project.repoUrl ? { sameAs: [project.liveUrl, project.repoUrl].filter(Boolean) } : {}),
      },
    ],
  };

  const draftNotice = isDraft && (
    <p role="status" className="relative z-40 mx-auto mt-3 max-w-5xl rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-900 dark:text-yellow-100" style={{ color: 'var(--d-text, inherit)' }}>
      <b>Draft preview.</b> Only signed-in users can see this page. Turn on “Visible on site” in Admin → Projects to publish it.
    </p>
  );

  return (
    <>
      {!isDraft && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />}
      {chosen ? (
        <>
          {draftNotice}
          <DesignedPage data={chosen.design.data} portfolio={resolvePortfolio(await getPortfolioFromDatabase())} assistant={await assistantEnabled()} project={project} />
        </>
      ) : (
        <PageTheme design={homeDesign}>
          {draftNotice}
          <ClassicProjectPage project={project} />
        </PageTheme>
      )}
    </>
  );
}
