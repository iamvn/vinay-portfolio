import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { currentSiteUrl } from '@/lib/sites/url';
import { currentSite } from '@/lib/sites/context';
import { listPublic } from '@/lib/community/store';

// Built from the database on each request so new projects appear without a redeploy.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = await currentSiteUrl();
  // The community board is shared by every site; it's listed once, in the main site's sitemap.
  const main = (await currentSite().catch(() => null))?.isMain ?? false;
  const community = main ? await listPublic({}).catch(() => null) : null;
  const projects = await prisma.project.findMany({ where: { published: true }, orderBy: { id: 'asc' }, select: { slug: true, type: true, externalUrl: true } }).catch(() => []);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    // "link" projects redirect elsewhere, so only projects with their own page are listed.
    ...projects
      .filter((project) => !(project.type === 'link' && project.externalUrl))
      .map((project) => ({ url: `${SITE_URL}/projects/${project.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...(community ? [
      { url: `${SITE_URL}/community`, changeFrequency: 'daily' as const, priority: 0.6 },
      ...community.posts.map((post) => ({ url: `${SITE_URL}/community/${post.id}`, lastModified: post.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ] : []),
  ];
}
