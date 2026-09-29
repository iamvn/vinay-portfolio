import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/seo';

// Built from the database on each request so new projects appear without a redeploy.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await prisma.project.findMany({ orderBy: { id: 'asc' }, select: { slug: true, type: true, externalUrl: true } }).catch(() => []);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    // "link" projects redirect elsewhere, so only projects with their own page are listed.
    ...projects
      .filter((project) => !(project.type === 'link' && project.externalUrl))
      .map((project) => ({ url: `${SITE_URL}/projects/${project.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
  ];
}
