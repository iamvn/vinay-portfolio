import { SITE_URL } from '@/lib/seo';
import { currentSite, requestHost } from './context';
import { siteAddress } from './hosts';

/**
 * Public address of the site serving this request, for canonical URLs, the sitemap, robots.txt,
 * share images and structured data. The main site uses NEXT_PUBLIC_SITE_URL; other sites use
 * https://<slug>.<ROOT_DOMAIN>, their custom domain, or the address they were opened at.
 */
export async function currentSiteUrl(): Promise<string> {
  const site = await currentSite();
  if (site.isMain) return SITE_URL;
  const request = await requestHost();
  return (siteAddress(site, request?.host, request?.proto) || SITE_URL).replace(/\/+$/, '');
}
