/**
 * Which site a request is for, from its host name (no database needed).
 *
 *   ROOT_DOMAIN=vinaybharti.dev
 *   vinaybharti.dev, www.vinaybharti.dev   → the main site (yours)
 *   savi-bharti.vinaybharti.dev            → site "savi-bharti"
 *   savi-bharti.localhost:3000             → site "savi-bharti" (local development)
 *   *.vercel.app, localhost                → the main site
 *   any other host                         → a site's own custom domain (or the main site if none matches)
 */
export const MAIN_SLUG = 'main';

export const rootDomain = () =>
  (process.env.ROOT_DOMAIN ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');

/** 3–40 characters: lowercase letters, digits and hyphens, not starting or ending with a hyphen. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'platform', 'app', 'apps', 'mail', 'email', 'smtp', 'main', 'static', 'assets', 'cdn', 'img', 'images',
  'dev', 'staging', 'preview', 'test', 'login', 'signup', 'blog', 'docs', 'help', 'support', 'status', 'billing', 'dashboard',
]);

export type HostTarget = { kind: 'main' } | { kind: 'sub'; slug: string } | { kind: 'custom'; domain: string };

export function parseHost(rawHost: string | null | undefined): HostTarget {
  const host = (rawHost ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return { kind: 'main' };
  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length);
    return sub && sub !== 'www' && !sub.includes('.') ? { kind: 'sub', slug: sub } : { kind: 'main' };
  }
  const root = rootDomain();
  if (root) {
    if (host === root || host === `www.${root}`) return { kind: 'main' };
    if (host.endsWith(`.${root}`)) {
      const sub = host.slice(0, -(root.length + 1));
      if (sub && !sub.includes('.')) return { kind: 'sub', slug: sub };
    }
  }
  if (host.endsWith('.vercel.app')) return { kind: 'main' }; // production + preview deployment URLs
  return { kind: 'custom', domain: host };
}

/** Public address of a site: https://<slug>.<ROOT_DOMAIN>, its custom domain, or the request's own host. */
export function siteAddress(site: { slug: string; domain?: string | null }, requestHost?: string | null, proto = 'https') {
  if (site.domain) return `https://${site.domain}`;
  const root = rootDomain();
  if (site.slug !== MAIN_SLUG && root) return `https://${site.slug}.${root}`;
  if (requestHost) return `${proto}://${requestHost}`;
  return '';
}
