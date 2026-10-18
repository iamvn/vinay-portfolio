'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';

/** Counts one visit to the link card (no cookies, nothing personal). */
export function CardView() {
  useEffect(() => {
    try {
      const key = 'linkcard.viewed';
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* private mode: count it anyway */ }
    void fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'linkcard_view' }), keepalive: true }).catch(() => {});
  }, []);
  return null;
}

/** "Share": the phone's share sheet where there is one, otherwise copies the link. */
export function ShareCard({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href.split('#')[0].split('?')[0];
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* cancelled */ return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* blocked */ }
  }
  return (
    <button type="button" className="lc-share" onClick={() => void share()} aria-live="polite">
      <Icon name={copied ? 'check' : 'send'} size={15} />{copied ? 'Copied' : 'Share'}
    </button>
  );
}
