'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type Notify = (message: string, tone?: 'success' | 'error') => void;

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-lime-300/60';

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
  return <input className={inputClass} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />;
}

export function TextArea(props: { value: string; onChange: (value: string) => void; rows?: number; mono?: boolean; placeholder?: string }) {
  return (
    <textarea
      className={`${inputClass} ${props.mono ? 'font-mono text-xs' : ''}`}
      rows={props.rows ?? 4}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-200">
      <input type="checkbox" className="size-4 accent-lime-300" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

type ButtonProps = { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: 'primary' | 'ghost' | 'danger'; type?: 'button' | 'submit' };

export function Button({ children, onClick, disabled, tone = 'ghost', type = 'button' }: ButtonProps) {
  const tones = {
    primary: 'bg-lime-300 text-black hover:bg-lime-200',
    ghost: 'border border-white/15 text-slate-200 hover:border-cyan-300/60 hover:text-white',
    danger: 'border border-red-400/40 text-red-300 hover:bg-red-500/10',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg px-3.5 py-2 text-xs font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}>
      {children}
    </button>
  );
}

/** A destructive button that needs a second click within a few seconds. */
export function ConfirmButton({ children, confirmLabel = 'Click again to confirm', onConfirm, disabled }: { children: ReactNode; confirmLabel?: string; onConfirm: () => void; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button tone="danger" disabled={disabled} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : children}
    </Button>
  );
}

export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
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
