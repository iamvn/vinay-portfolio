import type { MetadataRoute } from 'next';
import { currentSiteUrl } from '@/lib/sites/url';

// Per site: each site's robots.txt points at its own sitemap.
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await currentSiteUrl();
  return {
    rules: {
      userAgent: '*',
      // Public images (profile photo, project covers, resume) stay crawlable; the rest of the API, admin and login do not.
      allow: ['/', '/api/profile-image', '/api/projects/*/image', '/api/resume'],
      disallow: ['/admin', '/login', '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
