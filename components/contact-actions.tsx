'use client';

import { useState } from 'react';
import { Icon } from './icons';
import { track } from '@/lib/track-client';

/**
 * Contact buttons. The address comes from the profile (Admin → Profile → Social links → email);
 * it isn't printed on the page, only used by the buttons. "Email me" opens the visitor's mail app; "Copy email" helps the many people
 * who use webmail and have no mail app set up; LinkedIn is where most recruiters reach out.
 */
export function ContactActions({ email, linkedin, actionLabel }: { email?: string | null; linkedin?: string | null; actionLabel: string }) {
  const [copied, setCopied] = useState(false);
  const address = email?.replace(/^mailto:/i, '') ?? '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Older browsers / non-HTTPS: copy through a temporary, off-screen text field.
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

  const secondary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-xs font-black text-slate-200 transition hover:border-lime-300/60';
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
        {address && (
          <a href={`mailto:${address}`} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-lime-300 px-6 py-3 text-xs font-black text-black">
            {actionLabel}
          </a>
        )}
        {address && (
          <button type="button" onClick={copy} className={secondary} aria-live="polite">
            <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'EMAIL COPIED' : 'COPY EMAIL'}
          </button>
        )}
        {linkedin && (
          <a href={linkedin} target="_blank" rel="noopener noreferrer" className={secondary}>
            <Icon name="linkedin" size={16} /> LINKEDIN
          </a>
        )}
      </div>
    </div>
  );
}
