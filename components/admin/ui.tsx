'use client';

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { pendingRequests } from './api';

export type Notify = (message: string, tone?: 'success' | 'error') => void;

/**
 * Read-only mode (Users & security → Access → Read-only). Inside it, fields can be read but not edited and
 * every action button is disabled, except buttons marked `view` (reload, download…). The server enforces
 * the same rule, so this is only about making the screen honest.
 */
const ReadOnlyContext = createContext(false);
export const ReadOnlyProvider = ReadOnlyContext.Provider;
export const useReadOnly = () => useContext(ReadOnlyContext);

/** Disables every form control inside it while read-only (for areas with hand-written inputs). */
export function ReadOnlyFieldset({ children, className = '' }: { children: ReactNode; className?: string }) {
  const readOnly = useReadOnly();
  return <fieldset disabled={readOnly} className={`m-0 min-w-0 border-0 p-0 ${className}`}>{children}</fieldset>;
}

// 16px text on phones stops iOS Safari from zooming in when a field is focused.
export const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-lime-300/60 sm:py-2 sm:text-sm';

/**
 * A labelled form row. Use `group` when the content has several controls (buttons, uploads):
 * a <label> would forward every click inside it to its first button.
 */
export function Field({ label, hint, children, group = false }: { label: string; hint?: string; children: ReactNode; group?: boolean }) {
  const content = (
    <>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </>
  );
  return group ? <div role="group" aria-label={label} className="block">{content}</div> : <label className="block">{content}</label>;
}

export function TextInput(props: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const readOnly = useReadOnly();
  return <input className={inputClass} readOnly={readOnly} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />;
}

/**
 * A masked password / secret field with a Show–Hide toggle.
 * Always type="password" while hidden, so browsers and screen sharing never reveal it by default.
 */
export function PasswordInput({ value, onChange, autoComplete = 'new-password', placeholder, id }: { value: string; onChange: (value: string) => void; autoComplete?: string; placeholder?: string; id?: string }) {
  const [visible, setVisible] = useState(false);
  const readOnly = useReadOnly();
  return (
    <span className="relative block">
      <input
        id={id}
        readOnly={readOnly}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-16`}
      />
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setVisible((v) => !v); }}
        aria-label={visible ? 'Hide' : 'Show'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex min-w-14 items-center justify-center px-3 text-[11px] font-black uppercase tracking-wide text-slate-400 hover:text-lime-200"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}

export function TextArea(props: { value: string; onChange: (value: string) => void; rows?: number; mono?: boolean; placeholder?: string }) {
  const readOnly = useReadOnly();
  return (
    <textarea
      readOnly={readOnly}
      className={`${inputClass} ${props.mono ? 'font-mono sm:text-xs' : ''}`}
      rows={props.rows ?? 4}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  const readOnly = useReadOnly();
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-200 sm:min-h-0">
      <input type="checkbox" className="size-5 accent-lime-300 sm:size-4" disabled={readOnly} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

type ButtonProps = {
  children: ReactNode;
  /** May return a promise: the button then shows a spinner and stays disabled until it settles. */
  onClick?: () => unknown;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  className?: string;
  label?: string; // accessible name for icon-only buttons
  view?: boolean; // only looks at data (reload, download): stays enabled in read-only mode
};

/** 44px tall on phones (comfortable thumb target), compact from sm up. */
export const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0';

export function Button({ children, onClick, disabled, tone = 'ghost', type = 'button', className = '', label, view = false }: ButtonProps) {
  const readOnly = useReadOnly();
  const [working, setWorking] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; // also after React's development-mode remount
    return () => { mounted.current = false; };
  }, []);
  const click = () => {
    const result = onClick?.();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setWorking(true);
      (result as Promise<unknown>).catch(() => null).finally(() => { if (mounted.current) setWorking(false); });
    }
  };
  const tones = {
    primary: 'bg-lime-300 text-black hover:bg-lime-200',
    ghost: 'border border-white/15 text-slate-200 hover:border-cyan-300/60 hover:text-white',
    danger: 'border border-red-400/40 text-red-300 hover:bg-red-500/10',
  };
  return (
    <button type={type} onClick={onClick ? click : undefined} disabled={working || disabled || (readOnly && !view)} aria-busy={working || undefined}
      aria-label={label} title={label} className={`${buttonBase} ${tones[tone]} ${className}`}>
      {working && <Spinner />}
      {children}
    </button>
  );
}

/** A small spinning ring for buttons and loading states (inherits the text color). */
export function Spinner({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

/** A thin bar across the top of the admin panel while any API call is running. */
export function RequestProgress() {
  const busy = useSyncExternalStore(pendingRequests.subscribe, pendingRequests.get, () => 0) > 0;
  return (
    <div aria-hidden={!busy} role={busy ? 'progressbar' : undefined} aria-label={busy ? 'Working…' : undefined}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200 ${busy ? 'opacity-100' : 'opacity-0'}`}>
      <div className="admin-progress h-full w-1/3 bg-gradient-to-r from-lime-300 via-cyan-300 to-lime-300" />
    </div>
  );
}

/** A destructive button that needs a second click within a few seconds. */
export function ConfirmButton({ children, confirmLabel = 'Click again to confirm', onConfirm, disabled, className }: { children: ReactNode; confirmLabel?: string; onConfirm: () => void; disabled?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button tone="danger" className={className} disabled={disabled} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : children}
    </Button>
  );
}

export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">{title}</h3>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-slate-500">Loading…</p>;
}

/**
 * Save bar: stuck to the bottom of the screen on phones so Save is always within thumb reach,
 * a normal right-aligned row on larger screens.
 */
export function SaveBar({ dirty, busy, onSave, onReset, saveLabel }: { dirty: boolean; busy: boolean; onSave: () => void; onReset?: () => void; saveLabel: string }) {
  if (useReadOnly()) return null;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-2 border-t border-white/10 bg-[#030609]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
      <span className={`mr-auto text-xs ${dirty ? 'text-yellow-300' : 'text-slate-500'} sm:hidden`}>{dirty ? '● Unsaved changes' : 'All changes saved'}</span>
      {onReset && <Button onClick={onReset} disabled={busy || !dirty}>Reset</Button>}
      <Button tone="primary" onClick={onSave} disabled={busy || !dirty} className="max-sm:px-6">{busy ? 'Saving…' : saveLabel}</Button>
    </div>
  );
}
