'use client';

import { useState, type FormEvent } from 'react';

type Status = { state: 'idle' | 'sending' | 'done' } | { state: 'error'; message: string };

/** "Request access": name, email, personal or team, and a note. Lands in the platform owner's Support inbox. */
export function RequestForm() {
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(['name', 'email', 'plan', 'role', 'message', 'website'].map((key) => [key, String(form.get(key) ?? '')]));
    setStatus({ state: 'sending' });
    try {
      const response = await fetch('/api/kritipath/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = Array.isArray(data?.details) ? data.details[0]?.message : '';
        throw new Error(detail || data?.error || 'Something went wrong. Please try again.');
      }
      setStatus({ state: 'done' });
    } catch (error) {
      setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  }

  if (status.state === 'done') {
    return (
      <div className="cl-done" role="status">
        <span className="cl-done-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </span>
        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-.02em' }}>Request received</h3>
        <p className="cl-note" style={{ fontSize: '.98rem', maxWidth: '22rem' }}>Thank you. We’ll set up your Kritipath site and email you the details to sign in.</p>
      </div>
    );
  }

  const sending = status.state === 'sending';
  return (
    <form className="cl-form" onSubmit={submit} noValidate={false}>
      <div className="cl-seg" role="radiogroup" aria-label="Who is it for?">
        <label><input type="radio" name="plan" value="personal" defaultChecked />For me</label>
        <label><input type="radio" name="plan" value="team" />For a team or institution</label>
      </div>
      <div className="cl-two">
        <label className="cl-field">Full name<input className="cl-input" name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
        <label className="cl-field">Email<input className="cl-input" name="email" type="email" required maxLength={160} autoComplete="email" inputMode="email" /></label>
      </div>
      <label className="cl-field"><span>What you do <span style={{ fontWeight: 400, color: '#8e8e93' }}>(optional)</span></span>
        <input className="cl-input" name="role" maxLength={120} placeholder="e.g. Frontend engineer, final-year student, career coach" />
      </label>
      <label className="cl-field"><span>Anything we should know? <span style={{ fontWeight: 400, color: '#8e8e93' }}>(optional)</span></span>
        <textarea className="cl-input" name="message" maxLength={1500} placeholder="Your own domain, how many people, what you want to use most…" />
      </label>
      {/* Hidden from people; bots fill it in. */}
      <label className="cl-hp" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {status.state === 'error' && <p className="cl-error" role="alert">{status.message}</p>}
      <button type="submit" className="cl-btn cl-btn-dark cl-btn-lg" disabled={sending}>{sending ? 'Sending…' : 'Request access'}</button>
      <p className="cl-note">We only use your details to set up your site and contact you about it.</p>
    </form>
  );
}
