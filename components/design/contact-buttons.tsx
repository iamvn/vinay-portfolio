'use client';

import { useState } from 'react';
import { Icon } from '../icons';
import { track } from '@/lib/track-client';

/** Themed "Email me / Copy email / LinkedIn" buttons for designed pages. The address comes from the profile. */
export function ContactButtons({ email, linkedin, actionLabel, align = 'center' }: { email?: string | null; linkedin?: string | null; actionLabel: string; align?: 'left' | 'center' }) {
  const [copied, setCopied] = useState(false);
  const address = email?.replace(/^mailto:/i, '') ?? '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const field = Object.assign(document.createElement('textarea'), { value: address, readOnly: true });
      field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    track('contact_copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`mt-6 grid gap-3 sm:flex sm:flex-wrap ${align === 'center' ? 'sm:justify-center' : ''}`}>
      {address && <a href={`mailto:${address}`} onClick={() => track('contact_email')} className="d-btn d-btn-primary">{actionLabel}</a>}
      {address && (
        <button type="button" onClick={copy} className="d-btn d-btn-secondary" aria-live="polite">
          <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Email copied' : 'Copy email'}
        </button>
      )}
      {linkedin && (
        <a href={linkedin} target="_blank" rel="noopener noreferrer" onClick={() => track('contact_linkedin')} className="d-btn d-btn-secondary">
          <Icon name="linkedin" size={16} /> LinkedIn
        </a>
      )}
    </div>
  );
}
