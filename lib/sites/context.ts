import { AsyncLocalStorage } from 'node:async_hooks';
import { mainSite, siteForHost, type Site } from './registry';

/**
 * The site the current request is for. proxy.ts runs its work inside `runWithSite`; pages and route
 * handlers work it out from the request's host. Outside a request (scripts, the deploy step) it's the
 * main site.
 */
const storage = new AsyncLocalStorage<Site>();
export const runWithSite = <T>(site: Site, fn: () => T) => storage.run(site, fn);

export class SiteNotFoundError extends Error {
  constructor(public host: string | null) { super(`No site for ${host ?? 'this address'}.`); }
}

export async function requestHost(): Promise<{ host: string | null; proto: string } | null> {
  try {
    const { headers } = await import('next/headers');
    const list = await headers();
    const host = list.get('x-forwarded-host') ?? list.get('host');
    const proto = list.get('x-forwarded-proto')?.split(',')[0]?.trim() || (host?.startsWith('localhost') || host?.includes('.localhost') ? 'http' : 'https');
    return { host, proto };
  } catch {
    return null; // not inside a request
  }
}

export async function currentSite(): Promise<Site> {
  const stored = storage.getStore();
  if (stored) return stored;
  const request = await requestHost();
  if (!request) return mainSite();
  const site = await siteForHost(request.host);
  if (!site) throw new SiteNotFoundError(request.host);
  return site;
}
