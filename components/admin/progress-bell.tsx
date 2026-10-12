'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { PROGRESS_EVENT } from './progress-tab';
import { nudges, type Board } from '@/lib/progress/types';

const TONE: Record<string, string> = { warn: 'bg-amber-300', info: 'bg-cyan-300', good: 'bg-lime-300' };
const SEEN_KEY = 'progress.bell.seen';

/**
 * The header bell: once a goal is set in the Progress tracker, it reminds the signed-in user what to focus on
 * (days left, today's daily tasks, overdue work). The number is what still needs doing today.
 */
export function ProgressBell({ onOpen }: { onOpen: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [open, setOpen] = useState(false);
  // The bell only renders after the board loads in the browser, so reading localStorage here is safe.
  const [seenToday, setSeenToday] = useState(() => {
    try { return typeof window === 'undefined' || localStorage.getItem(SEEN_KEY) === new Date().toDateString(); } catch { return false; }
  });
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Board>('GET', '/api/progress').then(setBoard).catch(() => setBoard(null));
    const onChange = (e: Event) => setBoard((e as CustomEvent<Board>).detail);
    window.addEventListener(PROGRESS_EVENT, onChange);
    return () => window.removeEventListener(PROGRESS_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  if (!board?.goal) return null;
  const { items, count } = nudges(board);
  const toggle = () => {
    setOpen((o) => !o);
    setSeenToday(true);
    try { localStorage.setItem(SEEN_KEY, new Date().toDateString()); } catch { /* private mode */ }
  };

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
        aria-label={count ? `Goal reminders: ${count} to do today` : 'Goal reminders'}
        className="relative grid size-11 place-items-center rounded-lg border border-white/15 text-slate-200 hover:border-lime-300/60 sm:size-9">
        <svg viewBox="0 0 24 24" className={`size-[18px] ${!seenToday && count ? 'origin-top animate-[bell_1.2s_ease-in-out_2]' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-black">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Goal reminders"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 rounded-2xl border border-white/15 bg-[#080d14]/95 p-4 shadow-2xl backdrop-blur sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <p className="font-mono text-[10px] uppercase tracking-[.3em] text-lime-300">Stay on track</p>
          <p className="mb-3 mt-0.5 text-sm font-black text-white">Focus on: {board.goal.title}</p>
          <ul className="space-y-2.5">
            {items.map((n) => (
              <li key={n.id} className="flex gap-2.5 text-sm text-slate-200">
                <i className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[n.tone]}`} aria-hidden="true" />{n.text}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { setOpen(false); onOpen(); }}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-lime-300 text-xs font-black uppercase tracking-wide text-black hover:bg-lime-200 sm:min-h-9">
            Open Progress tracker
          </button>
        </div>
      )}
    </div>
  );
}
