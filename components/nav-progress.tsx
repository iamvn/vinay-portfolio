'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * A thin animated bar across the top of the page from the moment a visitor clicks a link to another page of
 * this site (e.g. "View project") until that page shows, so a slow load never feels like a dead click.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState<string | null>(null); // the path we're leaving, while loading

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a');
      if (!link || !link.href || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page / #anchor
      setLoading(window.location.pathname);
    }
    // Capture phase: runs before next/link handles the click (it calls preventDefault for client navigation).
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Never leave it running (e.g. the link was cancelled, or the browser restored the page from history).
  useEffect(() => {
    if (loading === null) return;
    const timer = setTimeout(() => setLoading(null), 15000);
    const reset = () => setLoading(null);
    window.addEventListener('pageshow', reset);
    return () => { clearTimeout(timer); window.removeEventListener('pageshow', reset); };
  }, [loading]);

  // Shown only while we're still on the page we're leaving: once the new page shows, it disappears.
  if (loading === null || loading !== pathname) return null;
  return (
    <div role="progressbar" aria-label="Loading page" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden">
      <div className="nav-progress-bar h-full w-1/3 bg-gradient-to-r from-lime-300 via-cyan-300 to-lime-300 shadow-[0_0_10px_rgba(190,242,100,.7)]" />
    </div>
  );
}
