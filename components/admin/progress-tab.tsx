'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, inputClass, type Notify } from './ui';
import {
  STATUSES, STATUS_LABELS, TRACK_COLORS, emptyBoard, localDay, newId, streak, timeline,
  type Board, type Goal, type Link, type Status, type Task, type Track, type VisionYear,
} from '@/lib/progress/types';

/**
 * Admin → Progress tracker: the signed-in user's own job-switch plan. A goal with a timeline, today's daily
 * tasks, a board (Open → In progress → Tested → Done) where each task has steps, focus areas with notes and
 * links, and a vision board per year. Every change saves itself a moment later.
 */

/** Fired on every change so the header bell can update without asking the server again. */
export const PROGRESS_EVENT = 'progress:board';

const STATUS_STYLE: Record<Status, { dot: string; ring: string }> = {
  open: { dot: 'bg-slate-400', ring: 'border-white/10' },
  progress: { dot: 'bg-cyan-300', ring: 'border-cyan-300/25' },
  tested: { dot: 'bg-violet-300', ring: 'border-violet-300/25' },
  done: { dot: 'bg-lime-300', ring: 'border-lime-300/25' },
};
const NEXT: Partial<Record<Status, Status>> = { open: 'progress', progress: 'tested', tested: 'done' };
const AREA_IDEAS = ['DSA', 'System design', 'Low-level design', 'Core CS (OS, DBMS, networks)', 'Projects', 'Behavioural & leadership', 'Resume & referrals'];
const PROFILE_PRESETS: [string, string][] = [['LeetCode', 'https://leetcode.com/u/'], ['GeeksforGeeks', 'https://www.geeksforgeeks.org/user/'], ['GitHub', 'https://github.com/'], ['Codeforces', 'https://codeforces.com/profile/']];
const MONTH_CHOICES = [1, 2, 3, 4, 6, 9, 12];

const fmtDay = (day: string) => {
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};
const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

// ---------- Making the board valid for the server (local drafts may hold half-typed values) ----------
function cleanUrl(raw: string) {
  const v = raw.trim();
  if (!v) return '';
  if (/^https?:\/\/\S+$/i.test(v)) return v.slice(0, 600);
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v)) return `https://${v}`.slice(0, 600);
  return '';
}
const looksLikeUrl = (v: string) => !v.trim() || cleanUrl(v) !== '';
const cleanLinks = (links: Link[], max: number) =>
  links.map((l) => ({ label: l.label.trim().slice(0, 80), url: cleanUrl(l.url) })).filter((l) => l.label || l.url).slice(0, max);
const cut = (s: string, max: number) => s.trim().slice(0, max);

function forSave(b: Board): Board {
  const vision: Record<string, VisionYear> = {};
  for (const [year, v] of Object.entries(b.vision)) {
    vision[year] = {
      images: v.images.map((i) => ({ id: i.id, caption: cut(i.caption, 120) })),
      todos: v.todos.filter((t) => t.text.trim()).map((t) => ({ ...t, text: cut(t.text, 200) })),
    };
  }
  return {
    goal: b.goal ? { ...b.goal, title: cut(b.goal.title, 120) || 'My goal', target: cut(b.goal.target, 120), why: cut(b.goal.why, 1000) } : null,
    tracks: b.tracks.map((t) => ({ ...t, title: cut(t.title, 80) || 'Focus area', notes: t.notes.slice(0, 8000), links: cleanLinks(t.links, 40) })),
    tasks: b.tasks.map((t) => ({
      ...t, title: cut(t.title, 160) || 'Untitled task', notes: t.notes.slice(0, 6000), links: cleanLinks(t.links, 30),
      steps: t.steps.filter((s) => s.text.trim()).map((s) => ({ ...s, text: cut(s.text, 300) })),
    })),
    daily: b.daily,
    profiles: cleanLinks(b.profiles, 20),
    vision,
    updatedAt: b.updatedAt,
  };
}

// ---------- Small pieces ----------
function Bar({ value, tone = 'bg-lime-300', label }: { value: number; tone?: string; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${tone} transition-[width] duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

function QuickAdd({ placeholder, onAdd, label, disabled }: { placeholder: string; onAdd: (text: string) => void; label: string; disabled?: boolean }) {
  const [text, setText] = useState('');
  const add = () => { if (text.trim()) { onAdd(text.trim()); setText(''); } };
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <input className={inputClass} aria-label={label} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} />
      <Button type="submit" disabled={disabled || !text.trim()}>Add</Button>
    </form>
  );
}

function Check({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children?: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-9">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0 accent-lime-300 sm:size-4" />
      {children}
    </label>
  );
}

const RemoveX = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-300 sm:size-8">×</button>
);

function LinksEditor({ links, onChange, max, labelHint = 'Name', urlHint = 'https://…', presets }: {
  links: Link[]; onChange: (links: Link[]) => void; max: number; labelHint?: string; urlHint?: string; presets?: [string, string][];
}) {
  const set = (i: number, patch: Partial<Link>) => onChange(links.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {links.map((link, i) => {
        const url = cleanUrl(link.url);
        return (
          <div key={i} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
            <input className={`${inputClass} sm:max-w-[38%]`} aria-label="Link name" placeholder={labelHint} value={link.label} onChange={(e) => set(i, { label: e.target.value })} />
            <div className="min-w-0 flex-1">
              <input className={inputClass} aria-label="Link address" inputMode="url" placeholder={urlHint} value={link.url} onChange={(e) => set(i, { url: e.target.value })} />
              {!looksLikeUrl(link.url) && <span className="mt-1 block text-[11px] text-amber-300">Start the link with https://</span>}
            </div>
            {url && <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold text-cyan-300 hover:text-cyan-200 sm:min-h-9">Open ↗</a>}
            <RemoveX onClick={() => onChange(links.filter((_, k) => k !== i))} label="Remove link" />
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onChange([...links, { label: '', url: '' }])} disabled={links.length >= max}>+ Link</Button>
        {presets?.filter(([name]) => !links.some((l) => l.label === name)).map(([name, url]) => (
          <Button key={name} onClick={() => onChange([...links, { label: name, url }])} disabled={links.length >= max}>+ {name}</Button>
        ))}
      </div>
    </div>
  );
}

// ---------- Goal ----------
function GoalForm({ goal, onSave, onCancel }: { goal: Goal | null; onSave: (g: Goal) => void; onCancel?: () => void }) {
  const [draft, setDraft] = useState<Goal>(goal ?? { title: '', target: '', why: '', start: localDay(), months: 3 });
  const custom = !MONTH_CHOICES.includes(draft.months);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (draft.title.trim()) onSave({ ...draft, title: draft.title.trim() }); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your goal"><input className={inputClass} required maxLength={120} placeholder="Switch to Atlassian" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Target role (optional)"><input className={inputClass} maxLength={120} placeholder="Senior Frontend Engineer" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} /></Field>
      </div>
      <Field label="Why it matters (optional)" hint="Read this on the days it feels hard."><textarea className={inputClass} rows={2} maxLength={1000} value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <Field label="Start"><input type="date" className={inputClass} required value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value || localDay() })} /></Field>
        <Field label="How long to prepare" group>
          <div className="flex flex-wrap items-center gap-1.5">
            {MONTH_CHOICES.map((m) => (
              <button key={m} type="button" aria-pressed={draft.months === m} onClick={() => setDraft({ ...draft, months: m })}
                className={`min-h-11 rounded-lg px-3 text-xs font-black sm:min-h-9 ${draft.months === m ? 'bg-lime-300 text-black' : 'border border-white/15 text-slate-300 hover:border-lime-300/50'}`}>
                {m} mo
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              or
              <input type="number" min={1} max={36} aria-label="Months" className={`${inputClass} w-20 ${custom ? 'border-lime-300/60' : ''}`} value={draft.months}
                onChange={(e) => setDraft({ ...draft, months: Math.min(36, Math.max(1, Number(e.target.value) || 1)) })} />
              months
            </label>
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" tone="primary" disabled={!draft.title.trim()}>{goal ? 'Save goal' : 'Set my goal'}</Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

function GoalCard({ board, update }: { board: Board; update: (fn: (b: Board) => Board) => void }) {
  const [editing, setEditing] = useState<'edit' | 'new' | null>(null);
  const goal = board.goal;
  if (!goal || editing) {
    return (
      <Card title={editing === 'new' ? 'Set your next goal' : goal ? 'Edit your goal' : 'Set your goal'} collapsible={false}>
        {!goal && <p className="mb-4 text-sm text-slate-400">What are you working towards? Name it, pick how long you&apos;ll prepare, then break it into focus areas and tasks below.</p>}
        {editing === 'new' && <p className="mb-4 text-sm text-slate-400">Your focus areas, tasks and vision boards stay. Clear finished tasks from the board if you want a fresh start.</p>}
        <GoalForm key={editing ?? 'none'} goal={editing === 'edit' ? goal : null}
          onSave={(g) => { update((b) => ({ ...b, goal: g })); setEditing(null); }}
          onCancel={goal ? () => setEditing(null) : undefined} />
      </Card>
    );
  }
  const t = timeline(goal);
  const tasks = board.tasks.filter((x) => !x.daily);
  const done = tasks.filter((x) => x.status === 'done').length;
  const ticks = goal.months <= 12 ? Array.from({ length: goal.months - 1 }, (_, i) => ((i + 1) / goal.months) * 100) : [];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-lime-300/20 bg-gradient-to-br from-lime-300/[.07] via-slate-950/80 to-cyan-300/[.06] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[.3em] text-lime-300">Current goal</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{goal.title}</h2>
          {goal.target && <p className="mt-1 text-sm font-bold text-cyan-200">{goal.target}</p>}
          {goal.why && <p className="mt-2 max-w-2xl text-sm text-slate-300">“{goal.why}”</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing('edit')}>Edit</Button>
          <Button onClick={() => setEditing('new')}>New goal</Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t.daysLeft >= 0 ? 'Days left' : 'Past the end by'}</p>
          <p className={`text-3xl font-black ${t.daysLeft < 0 ? 'text-amber-300' : t.daysLeft <= 14 ? 'text-amber-200' : 'text-white'}`}>{Math.abs(t.daysLeft)}</p>
          <p className="text-xs text-slate-500">of {t.totalDays} · ends {fmtDay(t.end)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tasks done</p>
          <p className="text-3xl font-black text-lime-300">{pct(done, tasks.length)}%</p>
          <p className="text-xs text-slate-500">{done} of {tasks.length} on the board</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Daily streak</p>
          <p className="text-3xl font-black text-cyan-200">{streak(board)}<span className="ml-1 text-base text-slate-400">days</span></p>
          <p className="text-xs text-slate-500">every daily task done</p>
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>{fmtDay(goal.start)}</span><span className="hidden sm:inline">Timeline · {goal.months} month{goal.months === 1 ? '' : 's'} · {t.percent}% gone</span><span>{fmtDay(t.end)}</span>
        </div>
        <div className="relative">
          <Bar value={t.percent} tone="bg-gradient-to-r from-cyan-300 to-lime-300" label="Time gone" />
          {ticks.map((left) => <span key={left} aria-hidden="true" className="absolute top-0 h-2 w-px bg-black/60" style={{ left: `${left}%` }} />)}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500 sm:hidden">{goal.months} month{goal.months === 1 ? '' : 's'} · {t.percent}% of the time gone</p>
        {t.percent > pct(done, tasks.length) + 15 && tasks.length > 0 && (
          <p className="mt-2 text-xs text-amber-200">Time is running ahead of your tasks. Pick one task to finish today.</p>
        )}
      </div>
    </section>
  );
}

// ---------- Today ----------
function TodayCard({ board, update, openTask }: { board: Board; update: (fn: (b: Board) => Board) => void; openTask: (id: string) => void }) {
  const today = localDay();
  const daily = board.tasks.filter((t) => t.daily);
  const ticked = new Set(board.daily[today] ?? []);
  const doneCount = daily.filter((t) => ticked.has(t.id)).length;
  const tick = (id: string, on: boolean) => update((b) => {
    const list = new Set(b.daily[today] ?? []);
    if (on) list.add(id); else list.delete(id);
    return { ...b, daily: { ...b.daily, [today]: [...list] } };
  });
  // The last 7 days, for a small habit strip.
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return localDay(d); });
  return (
    <Card title={`Today · ${daily.length ? `${doneCount}/${daily.length} done` : 'daily tasks'}`}>
      {daily.length ? (
        <ul className="mb-3 divide-y divide-white/5">
          {daily.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Check checked={ticked.has(t.id)} onChange={(v) => tick(t.id, v)} label={`Done today: ${t.title}`}>
                <span className={`text-sm ${ticked.has(t.id) ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{t.title}</span>
              </Check>
              <span className="ml-auto flex shrink-0 gap-1" aria-label="Last 7 days">
                {week.map((day) => <i key={day} title={fmtDay(day)} className={`size-2 rounded-full ${(board.daily[day] ?? []).includes(t.id) ? 'bg-lime-300' : 'bg-white/10'}`} />)}
              </span>
              <button type="button" onClick={() => openTask(t.id)} className="min-h-11 px-2 text-xs font-bold text-slate-400 hover:text-white sm:min-h-9">Edit</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-slate-400">Small things you&apos;ll do every day, like “Solve 2 LeetCode problems” or “Read one system design article”.</p>
      )}
      <QuickAdd label="Add a daily task" placeholder="Add a daily task…" disabled={board.tasks.length >= 400}
        onAdd={(title) => update((b) => ({ ...b, tasks: [...b.tasks, newTask(title, { daily: true })] }))} />
    </Card>
  );
}

const newTask = (title: string, extra: Partial<Task> = {}): Task => ({
  id: newId(), title, status: 'open', trackId: '', steps: [], notes: '', links: [], due: '', daily: false, createdAt: new Date().toISOString(), doneAt: '', ...extra,
});

// ---------- Board ----------
function BoardCard({ board, update, openTask, setStatus }: {
  board: Board; update: (fn: (b: Board) => Board) => void; openTask: (id: string) => void; setStatus: (id: string, s: Status) => void;
}) {
  const [filter, setFilter] = useState('');
  const [over, setOver] = useState<Status | null>(null);
  const today = localDay();
  const tracks = new Map(board.tracks.map((t) => [t.id, t]));
  const tasks = board.tasks.filter((t) => !t.daily && (!filter || t.trackId === filter));
  return (
    <Card title="Board">
      {board.tracks.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Show focus area">
          {[{ id: '', title: 'All', color: '#94a3b8' }, ...board.tracks].map((t) => (
            <button key={t.id || 'all'} type="button" aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${filter === t.id ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}>
              <i className="size-2 rounded-full" style={{ background: t.color }} />{t.title}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATUSES.map((status) => {
          const list = tasks.filter((t) => t.status === status);
          return (
            <div key={status} data-column={status}
              onDragOver={(e) => { e.preventDefault(); setOver(status); }} onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) setStatus(id, status); setOver(null); }}
              className={`flex min-h-32 flex-col gap-2 rounded-xl border bg-black/25 p-2.5 transition ${over === status ? 'border-lime-300/60 bg-lime-300/[.04]' : STATUS_STYLE[status].ring}`}>
              <h4 className="flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-wider text-slate-300">
                <i className={`size-2 rounded-full ${STATUS_STYLE[status].dot}`} />{STATUS_LABELS[status]}<span className="ml-auto text-slate-500">{list.length}</span>
              </h4>
              {list.map((task) => {
                const track = tracks.get(task.trackId);
                const stepsDone = task.steps.filter((s) => s.done).length;
                const overdue = task.status !== 'done' && task.due && task.due < today;
                const next = NEXT[task.status];
                return (
                  <article key={task.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; }}
                    className="group rounded-lg border border-white/10 bg-slate-900/80 p-2.5 shadow-sm hover:border-white/25">
                    <button type="button" onClick={() => openTask(task.id)} className="block w-full text-left">
                      {track && <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: track.color }}><i className="size-1.5 rounded-full" style={{ background: track.color }} />{track.title}</span>}
                      <span className={`block text-sm font-bold leading-snug ${task.status === 'done' ? 'text-slate-400 line-through decoration-slate-600' : 'text-white'}`}>{task.title}</span>
                      {(task.steps.length > 0 || task.due) && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          {task.steps.length > 0 && <span>☑ {stepsDone}/{task.steps.length} steps</span>}
                          {task.due && <span className={overdue ? 'font-bold text-amber-300' : ''}>{overdue ? 'Overdue · ' : 'Due '}{fmtDay(task.due)}</span>}
                        </span>
                      )}
                      {task.steps.length > 0 && <span className="mt-1.5 block"><Bar value={pct(stepsDone, task.steps.length)} label="Steps done" /></span>}
                    </button>
                    {next && (
                      <button type="button" onClick={() => setStatus(task.id, next)}
                        className="mt-2 inline-flex min-h-9 items-center text-[11px] font-black uppercase tracking-wide text-slate-500 hover:text-lime-200">
                        Move to {STATUS_LABELS[next]} →
                      </button>
                    )}
                  </article>
                );
              })}
              {status === 'open' && (
                <QuickAdd label="Add a task" placeholder="Add a task…" disabled={board.tasks.length >= 400}
                  onAdd={(title) => update((b) => ({ ...b, tasks: [...b.tasks, newTask(title, { trackId: filter })] }))} />
              )}
              {!list.length && status !== 'open' && <p className="px-1 text-xs text-slate-600">Drag a task here.</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TaskDialog({ board, id, onClose, setTask, setStatus, remove }: {
  board: Board; id: string; onClose: () => void; setTask: (id: string, patch: Partial<Task>) => void; setStatus: (id: string, s: Status) => void; remove: (id: string) => void;
}) {
  const task = board.tasks.find((t) => t.id === id);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = overflow; };
  }, [onClose]);
  if (!task) return null;
  const steps = task.steps;
  const stepsDone = steps.filter((s) => s.done).length;
  const setSteps = (next: Task['steps']) => setTask(id, { steps: next });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Task: ${task.title}`}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/15 bg-[#080d14] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <input className={`${inputClass} !text-lg font-black`} aria-label="Task title" maxLength={160} value={task.title} onChange={(e) => setTask(id, { title: e.target.value })} />
          <Button onClick={onClose} label="Close">✕</Button>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {task.daily ? <span className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-200">Daily task · ticked off under Today</span> : STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={task.status === s} onClick={() => setStatus(id, s)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-black uppercase tracking-wide sm:min-h-9 ${task.status === s ? 'bg-white text-black' : 'border border-white/15 text-slate-300 hover:border-white/40'}`}>
              <i className={`size-2 rounded-full ${STATUS_STYLE[s].dot}`} />{STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <Field label="Focus area">
            <select className={inputClass} value={task.trackId} onChange={(e) => setTask(id, { trackId: e.target.value })}>
              <option value="">None</option>
              {board.tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
          <Field label="Due date"><input type="date" className={inputClass} value={task.due} onChange={(e) => setTask(id, { due: e.target.value })} /></Field>
          <Field label="Repeat" group><Check checked={task.daily} onChange={(v) => setTask(id, { daily: v })} label="Every day"><span className="text-sm text-slate-200">Every day</span></Check></Field>
        </div>

        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-cyan-300">Steps to complete</h4>
            {steps.length > 0 && <span className="text-xs text-slate-400">{stepsDone}/{steps.length}</span>}
          </div>
          {steps.length > 0 && <div className="mb-2"><Bar value={pct(stepsDone, steps.length)} label="Steps done" /></div>}
          <ul className="mb-2">
            {steps.map((step, i) => (
              <li key={step.id} className="flex items-center gap-2">
                <input type="checkbox" aria-label={`Step ${i + 1} done`} checked={step.done} className="size-5 shrink-0 accent-lime-300 sm:size-4"
                  onChange={(e) => setSteps(steps.map((s) => (s.id === step.id ? { ...s, done: e.target.checked } : s)))} />
                <input className={`${inputClass} border-transparent bg-transparent ${step.done ? 'text-slate-500 line-through' : ''}`} aria-label={`Step ${i + 1}`} maxLength={300} value={step.text}
                  onChange={(e) => setSteps(steps.map((s) => (s.id === step.id ? { ...s, text: e.target.value } : s)))} />
                <RemoveX onClick={() => setSteps(steps.filter((s) => s.id !== step.id))} label="Remove step" />
              </li>
            ))}
          </ul>
          <QuickAdd label="Add a step" placeholder="e.g. Solve 10 sliding-window problems" disabled={steps.length >= 60}
            onAdd={(text) => setSteps([...steps, { id: newId(), text, done: false }])} />
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-cyan-300">Notes</h4>
          <textarea className={inputClass} rows={5} maxLength={6000} placeholder="What you learnt, what to revise, questions to ask…" value={task.notes} onChange={(e) => setTask(id, { notes: e.target.value })} />
        </section>
        <section className="mb-6">
          <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-cyan-300">Links</h4>
          <LinksEditor links={task.links} max={30} labelHint="Article, video, problem…" onChange={(links) => setTask(id, { links })} />
        </section>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
          <span className="text-xs text-slate-500">{task.createdAt && `Added ${new Date(task.createdAt).toLocaleDateString()}`}{task.doneAt && ` · Done ${new Date(task.doneAt).toLocaleDateString()}`}</span>
          <div className="flex gap-2">
            <ConfirmButton onConfirm={() => { remove(id); onClose(); }}>Delete task</ConfirmButton>
            <Button tone="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Focus areas ----------
function FocusAreas({ board, update, openTask }: { board: Board; update: (fn: (b: Board) => Board) => void; openTask: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const setTrack = (id: string, patch: Partial<Track>) => update((b) => ({ ...b, tracks: b.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const add = (title: string) => {
    const track: Track = { id: newId(), title, color: TRACK_COLORS[board.tracks.length % TRACK_COLORS.length], notes: '', links: [] };
    update((b) => ({ ...b, tracks: [...b.tracks, track] }));
    setOpen(track.id);
  };
  const ideas = AREA_IDEAS.filter((idea) => !board.tracks.some((t) => t.title.toLowerCase() === idea.toLowerCase()));
  return (
    <Card title="Focus areas">
      <p className="mb-3 text-sm text-slate-400">What your goal needs: DSA, system design… Keep notes and links for each one, like the DSA sheet you follow.</p>
      <div className="mb-3 space-y-2">
        {board.tracks.map((track) => {
          const tasks = board.tasks.filter((t) => t.trackId === track.id && !t.daily);
          const done = tasks.filter((t) => t.status === 'done').length;
          const expanded = open === track.id;
          return (
            <div key={track.id} className="rounded-xl border border-white/10 bg-black/25" style={{ borderLeft: `3px solid ${track.color}` }}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : track.id)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left">
                <span aria-hidden="true" className={`text-xs text-slate-500 transition ${expanded ? 'rotate-90' : ''}`}>▸</span>
                <span className="min-w-0 flex-1 truncate font-bold text-white">{track.title}</span>
                <span className="hidden text-xs text-slate-400 sm:inline">{track.links.length} link{track.links.length === 1 ? '' : 's'} · {done}/{tasks.length} tasks</span>
                <span className="w-20 sm:w-28"><Bar value={pct(done, tasks.length)} label={`${track.title} progress`} /></span>
              </button>
              {expanded && (
                <div className="space-y-4 border-t border-white/10 p-3 sm:p-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <Field label="Name"><input className={inputClass} maxLength={80} value={track.title} onChange={(e) => setTrack(track.id, { title: e.target.value })} /></Field>
                    <Field label="Colour" group>
                      <div className="flex flex-wrap gap-1.5">
                        {TRACK_COLORS.map((c) => (
                          <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={track.color === c} onClick={() => setTrack(track.id, { color: c })}
                            className={`size-9 rounded-full border-2 sm:size-7 ${track.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
                        ))}
                      </div>
                    </Field>
                  </div>
                  <Field label="Notes"><textarea className={inputClass} rows={5} maxLength={8000} placeholder="Topics to cover, patterns, weak spots, resources…" value={track.notes} onChange={(e) => setTrack(track.id, { notes: e.target.value })} /></Field>
                  <Field label="Links (sheets, courses, playlists)" group>
                    <LinksEditor links={track.links} max={40} labelHint="My DSA sheet" onChange={(links) => setTrack(track.id, { links })} />
                  </Field>
                  <Field label={`Tasks in ${track.title || 'this area'}`} group>
                    {tasks.length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {tasks.map((t) => (
                          <li key={t.id}>
                            <button type="button" onClick={() => openTask(t.id)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-white/5">
                              <i className={`size-2 rounded-full ${STATUS_STYLE[t.status].dot}`} />
                              <span className={t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-100'}>{t.title}</span>
                              <span className="ml-auto text-[11px] text-slate-500">{STATUS_LABELS[t.status]}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <QuickAdd label={`Add a task to ${track.title}`} placeholder="Add a task to this area…" disabled={board.tasks.length >= 400}
                      onAdd={(title) => update((b) => ({ ...b, tasks: [...b.tasks, newTask(title, { trackId: track.id })] }))} />
                  </Field>
                  <div className="flex justify-end">
                    <ConfirmButton confirmLabel="Click again: tasks stay, unassigned" onConfirm={() => update((b) => ({ ...b, tracks: b.tracks.filter((t) => t.id !== track.id), tasks: b.tasks.map((t) => (t.trackId === track.id ? { ...t, trackId: '' } : t)) }))}>
                      Remove area
                    </ConfirmButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <QuickAdd label="Add a focus area" placeholder="Add a focus area…" disabled={board.tracks.length >= 30} onAdd={add} />
      {ideas.length > 0 && board.tracks.length < 30 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Ideas:</span>
          {ideas.map((idea) => (
            <button key={idea} type="button" onClick={() => add(idea)} className="min-h-9 rounded-full border border-dashed border-white/20 px-3 text-xs text-slate-300 hover:border-lime-300/60 hover:text-white">+ {idea}</button>
          ))}
        </div>
      )}
      <div className="mt-6 border-t border-white/10 pt-4">
        <h4 className="mb-1 text-[11px] font-black uppercase tracking-wider text-cyan-300">Coding profiles</h4>
        <p className="mb-3 text-xs text-slate-500">Your LeetCode, GeeksforGeeks and other profiles, one tap away.</p>
        <LinksEditor links={board.profiles} max={20} presets={PROFILE_PRESETS} labelHint="LeetCode" onChange={(profiles) => update((b) => ({ ...b, profiles }))} />
      </div>
    </Card>
  );
}

// ---------- Vision board ----------
async function toDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    for (const [side, quality] of [[1200, 0.82], [900, 0.75], [700, 0.7]] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length < 880_000) return url;
    }
  } finally {
    bitmap.close();
  }
  throw new Error('That picture is too large. Try a smaller one.');
}

function VisionBoard({ board, update, notify }: { board: Board; update: (fn: (b: Board) => Board) => void; notify: Notify }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const years = [...new Set([String(thisYear + 1), String(thisYear), ...Object.keys(board.vision)])].sort().reverse();
  const v: VisionYear = board.vision[year] ?? { images: [], todos: [] };
  const setYearData = (fn: (y: VisionYear) => VisionYear) =>
    update((b) => ({ ...b, vision: { ...b.vision, [year]: fn(b.vision[year] ?? { images: [], todos: [] }) } }));
  const todosDone = v.todos.filter((t) => t.done).length;
  const nextYear = String(Number(year) + 1);
  const unfinished = v.todos.filter((t) => !t.done);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of [...files].slice(0, 24 - v.images.length)) {
        const dataUrl = await toDataUrl(file).catch((e) => { throw e instanceof Error && /large/.test(e.message) ? e : new Error(`Couldn't read ${file.name}. Try a JPEG or PNG.`); });
        const { id } = await api<{ id: string }>('POST', '/api/progress/images', { dataUrl });
        setYearData((y) => ({ ...y, images: [...y.images, { id, caption: '' }] }));
      }
    } catch (e) {
      notify(describeError(e), 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Card title="Vision board">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">Year</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Year">
          {years.map((y) => (
            <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)}
              className={`min-h-11 rounded-lg px-3 text-xs font-black sm:min-h-9 ${year === y ? 'bg-lime-300 text-black' : 'border border-white/15 text-slate-300 hover:border-lime-300/50'}`}>{y}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-cyan-300">What {year} looks like</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {v.images.map((img, i) => (
              <figure key={img.id} className={`group relative overflow-hidden rounded-xl border border-white/10 bg-black/40 ${i % 5 === 0 ? 'col-span-2 sm:col-span-2' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/progress/images/${img.id}`} alt={img.caption || `Vision picture ${i + 1}`} className={`w-full object-cover ${i % 5 === 0 ? 'aspect-[2/1]' : 'aspect-square'}`} loading="lazy" />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-6">
                  <input aria-label="Caption" placeholder="Caption…" maxLength={120} value={img.caption}
                    onChange={(e) => setYearData((y) => ({ ...y, images: y.images.map((x) => (x.id === img.id ? { ...x, caption: e.target.value } : x)) }))}
                    className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-1 text-sm font-bold text-white outline-none placeholder:text-white/40 focus:bg-black/50" />
                  <button type="button" aria-label="Remove picture" title="Remove picture"
                    onClick={() => setYearData((y) => ({ ...y, images: y.images.filter((x) => x.id !== img.id) }))}
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-black/60 text-white/80 hover:bg-red-500/40 hover:text-white">×</button>
                </figcaption>
              </figure>
            ))}
            {v.images.length < 24 && (
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}
                className={`grid place-items-center rounded-xl border-2 border-dashed border-white/15 p-4 text-center text-sm text-slate-400 hover:border-lime-300/50 hover:text-white disabled:opacity-50 ${v.images.length ? 'aspect-square' : 'col-span-2 aspect-[2/1] sm:col-span-3 sm:aspect-[3/1]'}`}>
                <span><span className="block text-3xl leading-none">+</span>{uploading ? 'Uploading…' : v.images.length ? 'Add pictures' : 'Add pictures of what you want this year: the office, the city, the role, the life.'}</span>
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-cyan-300">To do in {year}</h4>
            {v.todos.length > 0 && <span className="text-xs text-slate-400">{todosDone}/{v.todos.length}</span>}
          </div>
          {v.todos.length > 0 && <div className="mb-2"><Bar value={pct(todosDone, v.todos.length)} label={`${year} to-dos done`} /></div>}
          <ul className="mb-2">
            {v.todos.map((todo) => (
              <li key={todo.id} className="flex items-center gap-2">
                <input type="checkbox" aria-label={`Done: ${todo.text}`} checked={todo.done} className="size-5 shrink-0 accent-lime-300 sm:size-4"
                  onChange={(e) => setYearData((y) => ({ ...y, todos: y.todos.map((t) => (t.id === todo.id ? { ...t, done: e.target.checked } : t)) }))} />
                <input aria-label="To-do" maxLength={200} value={todo.text} className={`${inputClass} border-transparent bg-transparent ${todo.done ? 'text-slate-500 line-through' : ''}`}
                  onChange={(e) => setYearData((y) => ({ ...y, todos: y.todos.map((t) => (t.id === todo.id ? { ...t, text: e.target.value } : t)) }))} />
                <RemoveX label="Remove to-do" onClick={() => setYearData((y) => ({ ...y, todos: y.todos.filter((t) => t.id !== todo.id) }))} />
              </li>
            ))}
          </ul>
          <QuickAdd label={`Add a to-do for ${year}`} placeholder="Run a half marathon, read 12 books…" disabled={v.todos.length >= 80}
            onAdd={(text) => setYearData((y) => ({ ...y, todos: [...y.todos, { id: newId(), text, done: false }] }))} />
          {unfinished.length > 0 && Number(year) <= thisYear && (
            <Button className="mt-3" onClick={() => update((b) => {
              const target = b.vision[nextYear] ?? { images: [], todos: [] };
              const have = new Set(target.todos.map((t) => t.text.trim().toLowerCase()));
              const carry = unfinished.filter((t) => !have.has(t.text.trim().toLowerCase())).map((t) => ({ id: newId(), text: t.text, done: false }));
              notify(carry.length ? `Copied ${carry.length} unfinished to-do${carry.length === 1 ? '' : 's'} to ${nextYear}.` : `They're already on ${nextYear}.`);
              return { ...b, vision: { ...b.vision, [nextYear]: { ...target, todos: [...target.todos, ...carry].slice(0, 80) } } };
            })}>Carry unfinished to {nextYear}</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------- The tab ----------
type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export function ProgressTab({ notify }: { notify: Notify }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState('');
  const [save, setSave] = useState<SaveState>('saved');
  const [openId, setOpenId] = useState<string | null>(null);
  const current = useRef<Board | null>(null);
  const queued = useRef<Board | null>(null);
  const running = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    api<Board>('GET', '/api/progress', undefined, { fresh: true })
      .then((b) => { current.current = b; setBoard(b); })
      .catch((e) => { setLoadError(describeError(e)); current.current = emptyBoard(); });
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (running.current) return; // the running save picks up anything queued meanwhile
    running.current = true;
    let failed = false;
    while (queued.current && !failed) {
      const next = queued.current;
      queued.current = null;
      setSave('saving');
      try {
        await api('PUT', '/api/progress', forSave(next));
      } catch (e) {
        failed = true;
        queued.current = queued.current ?? next; // kept, so "Retry" (or the next change) saves it
        notify(describeError(e), 'error');
      }
    }
    running.current = false;
    setSave(failed ? 'error' : 'saved');
  }, [notify]);

  const update = useCallback((fn: (b: Board) => Board) => {
    const prev = current.current;
    if (!prev) return;
    const next = fn(prev);
    current.current = next;
    setBoard(next);
    queued.current = next;
    setSave((s) => (s === 'saving' ? s : 'pending'));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 700);
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: next }));
  }, [flush]);

  // Save right away when leaving the tab; warn before closing the page with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (queued.current || running.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); void flush(); };
  }, [flush]);

  const setTask = useCallback((id: string, patch: Partial<Task>) =>
    update((b) => ({ ...b, tasks: b.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })), [update]);
  const setStatus = useCallback((id: string, status: Status) =>
    update((b) => ({ ...b, tasks: b.tasks.map((t) => (t.id === id && t.status !== status ? { ...t, status, doneAt: status === 'done' ? new Date().toISOString() : '' } : t)) })), [update]);
  const remove = useCallback((id: string) => update((b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) })), [update]);
  const close = useCallback(() => setOpenId(null), []);

  const doneCount = useMemo(() => board?.tasks.filter((t) => t.status === 'done' && !t.daily).length ?? 0, [board]);

  if (loadError) return <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">{loadError}</p>;
  if (!board) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black tracking-tight">Progress tracker</h2>
          <p className="text-sm text-slate-400">Your plan for the next switch. Only you can see it.</p>
        </div>
        <span role="status" className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold ${save === 'error' ? 'border-red-400/40 text-red-200' : 'border-white/10 text-slate-400'}`}>
          {save === 'saved' && <><i className="size-1.5 rounded-full bg-lime-300" />All changes saved</>}
          {save === 'pending' && <><i className="size-1.5 rounded-full bg-amber-300" />Saving soon…</>}
          {save === 'saving' && <><i className="size-1.5 animate-pulse rounded-full bg-cyan-300" />Saving…</>}
          {save === 'error' && <>Not saved · <button type="button" className="underline" onClick={() => void flush()}>Retry</button></>}
        </span>
      </div>
      <GoalCard board={board} update={update} />
      <TodayCard board={board} update={update} openTask={setOpenId} />
      <BoardCard board={board} update={update} openTask={setOpenId} setStatus={setStatus} />
      {doneCount > 0 && (
        <div className="flex justify-end">
          <ConfirmButton confirmLabel={`Click again to clear ${doneCount}`} onConfirm={() => update((b) => ({ ...b, tasks: b.tasks.filter((t) => t.daily || t.status !== 'done') }))}>
            Clear done tasks ({doneCount})
          </ConfirmButton>
        </div>
      )}
      <FocusAreas board={board} update={update} openTask={setOpenId} />
      <VisionBoard board={board} update={update} notify={notify} />
      {openId && <TaskDialog board={board} id={openId} onClose={close} setTask={setTask} setStatus={setStatus} remove={remove} />}
    </div>
  );
}
