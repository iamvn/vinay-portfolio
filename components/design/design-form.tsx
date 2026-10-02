'use client';

import { useState, type FormEvent, type ReactNode } from 'react';

/**
 * A form built in Admin → Design. Sends every field (label → value; several picks joined with ", ") to
 * /api/forms, which stores it for Admin → Insights. In the editor it never sends.
 */
export function DesignForm({ formName, submitLabel, successMessage, align, fullWidth, editing, children }: {
  formName: string; submitLabel: string; successMessage: string; align: 'left' | 'center' | 'right'; fullWidth: boolean; editing: boolean; children: ReactNode;
}) {
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({ kind: 'idle' });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing) return;
    const form = event.currentTarget;
    const values: Record<string, string> = {};
    for (const [name, value] of new FormData(form)) {
      if (typeof value !== 'string' || name === 'website') continue;
      values[name] = values[name] ? `${values[name]}, ${value}` : value;
    }
    setState({ kind: 'sending' });
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ form: formName || 'Form', fields: values, page: window.location.pathname, website: (form.elements.namedItem('website') as HTMLInputElement | null)?.value ?? '' }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Could not send. Please try again.');
      form.reset();
      setState({ kind: 'sent', message: successMessage || 'Thanks! Your message was sent.' });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not send. Please try again.' });
    }
  }

  const justify = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }[align] ?? 'justify-start';
  return (
    <form onSubmit={submit} className="grid gap-4" noValidate={editing}>
      {children}
      {/* Spam trap: people never see or fill this. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <div className={`flex flex-wrap items-center gap-3 ${justify}`}>
        <button type="submit" disabled={state.kind === 'sending'} className={`d-btn d-btn-primary ${fullWidth ? 'w-full' : ''}`}>
          {state.kind === 'sending' ? 'Sending…' : submitLabel || 'Send'}
        </button>
        {editing && <span className="d-muted text-xs">Forms don’t send while you’re editing.</span>}
      </div>
      {state.message && (
        <p role={state.kind === 'error' ? 'alert' : 'status'} className={`text-sm font-bold ${state.kind === 'error' ? 'text-red-500' : 'd-accent'}`}>{state.message}</p>
      )}
    </form>
  );
}
