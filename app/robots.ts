import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Public images (profile photo, project covers, resume) stay crawlable; the rest of the API, admin and login do not.
      allow: ['/', '/api/profile-image', '/api/projects/*/image', '/api/resume'],
      disallow: ['/admin', '/login', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
