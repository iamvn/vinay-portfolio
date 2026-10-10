'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ANNOUNCEMENT_LABELS, type Announcement, type Guide, type GuideTab } from '@/lib/guide/content';

/**
 * "Know this app": a floating guide in the admin. It answers like a chat, from fixed text (no AI):
 * pick a tab to see what it's for and what it can do, or type a word to find the tab that does it.
 * The text comes from the platform owner (Sites → Admin guide). Also: the announcements bar.
 */

export type GuideData = { guide: Guide; announcements: Omit<Announcement, 'by'>[] };
type Message = { id: number; from: 'bot' | 'me'; body: ReactNode };

const KIND_TONE: Record<Announcement['kind'], string> = {
  new: 'bg-lime-300 text-black',
  info: 'bg-cyan-300 text-black',
  important: 'bg-amber-300 text-black',
};

// ---------- announcements bar ----------

const DISMISSED = 'admin-dismissed-announcements';
const readDismissed = (): string[] => { try { return JSON.parse(localStorage.getItem(DISMISSED) ?? '[]'); } catch { return []; } };

/** Messages from the platform owner, shown at the top of every site's admin until dismissed (per browser). */
export function AnnouncementBar({ announcements }: { announcements: GuideData['announcements'] }) {
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    // Read once on the client; announcements arrive after the first render anyway.
    const timer = setTimeout(() => setDismissed(readDismissed()), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!dismissed) return null;
  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (!visible.length) return null;
  const current = visible[Math.min(index, visible.length - 1)];
  const dismiss = () => {
    const next = [...dismissed, current.id].slice(-100);
    try { localStorage.setItem(DISMISSED, JSON.stringify(next)); } catch { /* only for this visit */ }
    setDismissed(next);
    setIndex(0);
  };
  return (
    <div role="status" aria-label="Announcement" className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-white/15 bg-white/[.04] px-3 py-2.5 text-sm sm:items-center">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${KIND_TONE[current.kind]}`}>{ANNOUNCEMENT_LABELS[current.kind]}</span>
      <p className="min-w-0 flex-1 basis-48 leading-6 text-slate-100">{current.message}</p>
      <div className="flex shrink-0 items-center gap-2">
        {current.link && (
          <a href={current.link} target={current.link.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer"
            className="min-h-9 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-bold text-cyan-200 hover:border-cyan-300/60">{current.linkLabel || 'Learn more'} →</a>
        )}
        {visible.length > 1 && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <button type="button" aria-label="Previous announcement" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="grid size-8 place-items-center rounded hover:bg-white/10 disabled:opacity-30">‹</button>
            {Math.min(index, visible.length - 1) + 1}/{visible.length}
            <button type="button" aria-label="Next announcement" disabled={index >= visible.length - 1} onClick={() => setIndex((i) => i + 1)} className="grid size-8 place-items-center rounded hover:bg-white/10 disabled:opacity-30">›</button>
          </span>
        )}
        <button type="button" onClick={dismiss} aria-label="Dismiss this announcement" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
      </div>
    </div>
  );
}

// ---------- the guide ----------

function Bubble({ from, children }: { from: Message['from']; children: ReactNode }) {
  return (
    <div className={`flex ${from === 'me' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${from === 'me' ? 'rounded-br-md bg-lime-300 font-bold text-black' : 'rounded-bl-md border border-white/10 bg-white/[.05] text-slate-100'}`}>
        {children}
      </div>
    </div>
  );
}

const WORD = /[a-z0-9.+#]+/g;

export function GuideBot({ data, tabs, onOpenTab, name }: {
  data: GuideData | null; tabs: (readonly [string, string])[]; onOpenTab: (tab: string) => void; name: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const counter = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const known = useMemo(() => tabs.filter(([id]) => data?.guide.tabs[id as GuideTab]), [tabs, data]);
  const labelOf = (id: string) => tabs.find(([tab]) => tab === id)?.[1] ?? id;

  const push = (...items: Omit<Message, 'id'>[]) => setMessages((list) => [...list, ...items.map((m) => ({ ...m, id: ++counter.current }))]);

  function tabChips(ids: string[] = known.map(([id]) => id)) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <button key={id} type="button" onClick={() => explain(id)}
            className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-xs font-bold text-slate-100 hover:border-lime-300/60 hover:text-lime-200">{labelOf(id)}</button>
        ))}
      </div>
    );
  }

  function explain(id: string) {
    const entry = data?.guide.tabs[id as GuideTab];
    if (!entry) return;
    push({ from: 'me', body: labelOf(id) }, {
      from: 'bot',
      body: (
        <div>
          <p className="font-black text-white">{labelOf(id)}</p>
          <p className="mt-1">{entry.summary}</p>
          {entry.features.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">{entry.features.map((f) => <li key={f}>{f}</li>)}</ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { onOpenTab(id); setOpen(false); }}
              className="rounded-lg bg-lime-300 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-black hover:bg-lime-200">Open {labelOf(id)} →</button>
            <button type="button" onClick={showAll} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-white/40">All tabs</button>
          </div>
        </div>
      ),
    });
  }

  function showAll() {
    push({ from: 'bot', body: <><p>Which part would you like to know about?</p>{tabChips()}</> });
  }

  function ask(event: FormEvent) {
    event.preventDefault();
    const question = text.trim();
    if (!question || !data) return;
    setText('');
    const words = question.toLowerCase().match(WORD) ?? [];
    const scored = known.map(([id, label]) => {
      const entry = data.guide.tabs[id as GuideTab];
      const hay = [label, entry.summary, ...entry.features].map((t) => t.toLowerCase());
      const score = words.reduce((n, w) => n + (w.length < 3 ? 0 : hay.filter((h) => h.includes(w)).length + (label.toLowerCase().includes(w) ? 3 : 0)), 0);
      const lines = entry.features.filter((f) => words.some((w) => w.length >= 3 && f.toLowerCase().includes(w))).slice(0, 2);
      return { id, score, lines };
    }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    push({ from: 'me', body: question });
    if (!scored.length) {
      push({ from: 'bot', body: <><p>I couldn’t find that. These are the parts of your admin:</p>{tabChips()}</> });
      return;
    }
    push({
      from: 'bot',
      body: (
        <div>
          <p>{scored.length === 1 ? 'That’s in this tab:' : 'You’ll find that here:'}</p>
          <ul className="mt-2 space-y-2">
            {scored.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => explain(s.id)} className="font-black text-lime-200 hover:underline">{labelOf(s.id)} →</button>
                {s.lines.map((line) => <span key={line} className="block text-xs text-slate-300">· {line}</span>)}
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  // First open: greet, show what's new, offer the tabs.
  function openGuide() {
    setOpen(true);
    if (messages.length || !data) return;
    const first = name.split(/\s+/)[0];
    const items: Omit<Message, 'id'>[] = [{ from: 'bot', body: <><p>Hi{first ? ` ${first}` : ''}! {data.guide.intro}</p>{tabChips()}</> }];
    if (data.announcements.length) {
      items.push({
        from: 'bot',
        body: (
          <div>
            <p className="font-black text-white">What’s new</p>
            <ul className="mt-1 space-y-1.5">
              {data.announcements.slice(0, 5).map((a) => (
                <li key={a.id} className="text-sm">
                  <span className={`mr-1.5 rounded px-1 py-px text-[9px] font-black uppercase ${KIND_TONE[a.kind]}`}>{ANNOUNCEMENT_LABELS[a.kind]}</span>
                  {a.message}
                </li>
              ))}
            </ul>
          </div>
        ),
      });
    }
    push(...items);
  }

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!data) return null;
  return (
    <>
      {!open && (
        <button ref={buttonRef} type="button" onClick={openGuide} aria-haspopup="dialog" aria-label="Open the guide: know this app"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-40 flex h-12 items-center gap-2 rounded-full border border-lime-300/50 bg-[#0b1209] pl-1.5 pr-4 text-sm font-black text-lime-200 shadow-[0_10px_30px_rgba(0,0,0,.6)] transition hover:border-lime-300 hover:bg-[#121c0e] sm:bottom-6 sm:right-6">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-lime-300 text-base text-black">?</span>
          Guide
          {data.announcements.length > 0 && <span className="size-2 rounded-full bg-amber-300" aria-label="New announcements" />}
        </button>
      )}
      {open && (
        <section role="dialog" aria-label="Guide: know this app"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[min(85dvh,640px)] flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#060b10] shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(620px,calc(100dvh-7rem))] sm:w-[400px] sm:rounded-2xl">
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-lime-300 font-black text-black">?</span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-white">Know this app</p>
              <p className="text-xs text-slate-400">Your guide to this admin</p>
            </div>
            <button type="button" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} aria-label="Close the guide"
              className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m) => <Bubble key={m.id} from={m.from}>{m.body}</Bubble>)}
          </div>
          <form onSubmit={ask} className="flex gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} aria-label="Ask about a feature"
              placeholder="e.g. resume, LinkedIn, PDF, interview…" className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-lime-300/60 sm:text-sm" />
            <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-lg bg-lime-300 px-4 text-xs font-black uppercase text-black disabled:opacity-40">Ask</button>
          </form>
        </section>
      )}
    </>
  );
}
