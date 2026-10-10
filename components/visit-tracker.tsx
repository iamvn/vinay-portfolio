'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Counts page views for Admin → Insights: which page, where the visitor came from (referrer and
 * ?utm_source= / ?ref= tags) and how long the page was on screen. No cookies or storage; the server keeps
 * no IP addresses (see lib/traffic.ts). Admin and sign-in pages are skipped.
 */
const SKIP = /^\/(admin|login)(\/|$)/;
const TAGS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'];

function send(body: object) {
  try {
    const json = JSON.stringify(body);
    if (!navigator.sendBeacon?.('/api/collect', new Blob([json], { type: 'application/json' }))) {
      void fetch('/api/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {});
    }
  } catch {
    // never get in the way of the page
  }
}

const newId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

// Module state: survives client-side navigation, reset on a full page load.
let firstView = true;
let previousUrl = '';

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || SKIP.test(pathname)) return;
    const id = newId();
    const load = firstView;
    firstView = false;

    // Campaign tags only count on the page the visitor arrived on.
    const params = new URLSearchParams(location.search);
    const utm = load ? { source: params.get('utm_source') || params.get('ref') || params.get('source') || '', medium: params.get('utm_medium') || '', campaign: params.get('utm_campaign') || '' } : {};
    send({ t: 'view', id, path: pathname, referrer: load ? document.referrer : previousUrl, load, utm });
    previousUrl = location.href;

    // Tidy the address bar so shared links don't carry the tags along.
    if (load && TAGS.some((tag) => params.has(tag))) {
      TAGS.forEach((tag) => params.delete(tag));
      const query = params.toString();
      history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    }

    // Time on screen: only while the tab is visible.
    let shown = document.visibilityState === 'visible' ? performance.now() : 0;
    let total = 0;
    let sent = 0;
    const flush = () => {
      if (shown) { total += performance.now() - shown; shown = 0; }
      if (total - sent > 500) { sent = total; send({ t: 'leave', id, ms: Math.round(total) }); }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
      else shown = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [pathname]);

  return null;
}
