'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SHARE_LINES, TOPICS, kindOf, KIND_STYLE, type Topic } from '@/lib/community/resource-types';

const input = 'min-h-12 w-full rounded-xl border border-white/15 bg-black/40 px-3.5 text-base text-white placeholder:text-slate-500 focus:border-lime-300/70 focus:outline-none sm:min-h-11 sm:text-sm';

/** "Share a resource": a sheet from the bottom on phones, a centred dialog on bigger screens. */
export function ShareResource({ name, defaultTopic, member }: { name: string; defaultTopic?: Topic; member: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [url, setUrl] = useState('');
  const kind = /^https:\/\/\S+\.\S+/.test(url) ? kindOf(url) : null;

  const open = () => { setError(''); setDone(''); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      const res = await fetch('/api/resources', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || (body.details?.[0]?.message as string) || 'Could not add it. Please try again.');
      setDone(data.title);
      form.reset();
      setUrl('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add it. Please try again.');
    } finally {
      setBusy(false);
    }
  }


  return (
    <>
      <button type="button" onClick={open}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 text-sm font-black uppercase tracking-wide text-black hover:bg-lime-200 sm:min-h-11">
        <span aria-hidden="true" className="text-lg leading-none">+</span> Share a resource
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} onClick={(e) => { if (e.target === dialog.current) close(); }}
        className="m-0 mt-auto w-full max-w-none rounded-t-3xl border border-white/15 bg-[#080d14] p-0 text-slate-100 backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-3xl">
        <div className="max-h-[88dvh] overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-xl font-black text-white">Share a free resource</h2>
              <p className="mt-1 text-sm text-slate-400">A video, article, repo or course that helped you. It goes live for everyone, with your name on it.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full text-2xl text-slate-400 hover:bg-white/10 hover:text-white">×</button>
          </div>

          {done ? (
            <div className="mt-6 rounded-2xl border border-lime-300/30 bg-lime-300/10 p-5 text-center">
              <p className="text-3xl" aria-hidden="true">🙌</p>
              <p className="mt-2 font-black text-white">Thank you! “{done}” is now in the library.</p>
              <p className="mt-1 text-sm text-slate-300">Someone out there just got a little further because of you.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setDone('')} className="min-h-11 rounded-xl bg-lime-300 px-4 text-sm font-black text-black">Share another</button>
                <button type="button" onClick={close} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200">Done</button>
              </div>
            </div>
          ) : (
            <form className="mt-5 grid gap-4" onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }}>
              <label className="grid gap-1.5 text-sm font-bold text-slate-200">
                Link
                <input name="url" type="url" inputMode="url" required placeholder="https://…" className={input} value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
                {kind && <span className="text-xs font-semibold" style={{ color: KIND_STYLE[kind].color }}>Looks like a {kind === 'YouTube' ? 'YouTube video' : kind === 'GitHub' ? 'GitHub repo' : kind === 'Medium' ? 'Medium post' : kind.toLowerCase()}</span>}
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-200">
                Title
                <input name="title" required minLength={3} maxLength={140} placeholder="e.g. Striver’s A2Z DSA sheet" className={input} />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-200">
                Topic
                <select name="topic" required defaultValue={defaultTopic ?? ''} className={input}>
                  <option value="" disabled>Choose a topic</option>
                  {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-200">
                <span>Why it helped <span className="font-normal text-slate-500">(optional)</span></span>
                <textarea name="note" maxLength={280} rows={3} placeholder="Best explanation of recursion I’ve found…" className={`${input} min-h-24 py-3`} />
              </label>
              <p className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-300">
                Shared as <b className="text-white">{name}</b>{member && <span className="text-lime-300"> ✓ member of {member}</span>}
              </p>
              {error && <p role="alert" className="rounded-xl bg-red-400/10 px-3.5 py-2.5 text-sm text-red-200">{error}</p>}
              <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-lime-300 text-sm font-black uppercase tracking-wide text-black hover:bg-lime-200 disabled:opacity-60">
                {busy ? 'Adding…' : 'Add to the library'}
              </button>
              <p className="text-center text-[11px] leading-5 text-slate-500">Free links only, please: nothing paid-only, no referral links. Shared links are public, and your name stays on them.</p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

/** The platform owner's "Remove" on a card. */
export function RemoveResource({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [state, setState] = useState<'' | 'ask' | 'busy'>('');
  const root = useRef<HTMLSpanElement>(null);
  async function remove() {
    setState('busy');
    const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) { const card = root.current?.closest('li'); if (card) card.hidden = true; }
    else setState('ask');
    router.refresh();
  }
  if (state === 'ask' || state === 'busy') {
    return (
      <span ref={root} className="flex items-center gap-1.5">
        <button type="button" disabled={state === 'busy'} aria-label={`Confirm removing ${title}`}
          onClick={() => void remove()}
          className="min-h-9 rounded-lg bg-red-400/90 px-3 text-xs font-black text-black">{state === 'busy' ? 'Removing…' : 'Remove'}</button>
        <button type="button" onClick={() => setState('')} className="min-h-9 rounded-lg px-2 text-xs font-bold text-slate-400">Keep</button>
      </span>
    );
  }
  return <button type="button" onClick={() => setState('ask')} aria-label={`Remove ${title}`} className="min-h-9 rounded-lg px-2 text-xs font-bold text-slate-500 hover:text-red-300">Remove</button>;
}

/** A line that changes every few seconds, nudging everyone to share. */
export function ShareLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setI((n) => (n + 1) % SHARE_LINES.length), 6000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p key={i} aria-live="off" className="animate-[fadein_.8s_ease] text-balance text-lg font-black leading-snug text-white sm:text-2xl">
      “{SHARE_LINES[i]}”
    </p>
  );
}

/** Signed out: sharing is for people signed in to a site on the platform. */
export function SignInToShare({ next }: { next: string }) {
  return (
    <a href={`/login?next=${encodeURIComponent(next)}`}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-lime-300/60 px-5 text-sm font-black uppercase tracking-wide text-lime-200 hover:bg-lime-300/10 sm:min-h-11">
      Sign in to share a resource
    </a>
  );
}
