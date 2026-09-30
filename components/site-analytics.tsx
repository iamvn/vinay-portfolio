'use client';

import { Analytics } from '@vercel/analytics/next';

/**
 * Vercel Web Analytics (enable it once in Vercel → Project → Analytics). Cookie-free.
 * Admin and login pages are skipped, so your own editing doesn't count as visits.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => (/^\/(admin|login)(\/|$)/.test(new URL(event.url).pathname) ? null : event)}
    />
  );
}
