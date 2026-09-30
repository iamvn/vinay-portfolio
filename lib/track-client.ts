'use client';

export type ClientEvent = 'contact_email' | 'contact_copy' | 'contact_linkedin';

/** Fire-and-forget: tells Admin → Insights that a visitor used a contact option. */
export function track(type: ClientEvent) {
  try {
    const body = JSON.stringify({ type });
    if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // tracking must never get in the way
  }
}
