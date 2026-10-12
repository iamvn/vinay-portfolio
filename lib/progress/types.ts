import { z } from 'zod';

/**
 * Progress tracker (Admin → Progress tracker): a personal job-search plan for the signed-in user.
 * A goal with a timeline, focus areas (DSA, system design…) with notes and links, a task board
 * (Open → In progress → Tested → Done) where each task has steps, daily habits, and a yearly vision
 * board with pictures and a to-do list. Safe in the browser.
 */

export const STATUSES = ['open', 'progress', 'tested', 'done'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = { open: 'Open', progress: 'In progress', tested: 'Tested', done: 'Done' };

export const TRACK_COLORS = ['#a3e635', '#22d3ee', '#c084fc', '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#34d399'] as const;

const id = z.string().regex(/^[a-z0-9]{6,24}$/);
const text = (max: number) => z.string().trim().max(max).default('');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default('');
const url = z.string().trim().max(600).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Links must start with http:// or https://');

export const linkSchema = z.object({ label: text(80), url }).strict();
const stepSchema = z.object({ id, text: z.string().trim().min(1).max(300), done: z.boolean().default(false) }).strict();

export const trackSchema = z.object({
  id, title: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#a3e635'),
  notes: text(8000), links: z.array(linkSchema).max(40).default([]),
}).strict();

export const taskSchema = z.object({
  id, title: z.string().trim().min(1).max(160), status: z.enum(STATUSES).default('open'), trackId: z.string().max(24).default(''),
  steps: z.array(stepSchema).max(60).default([]), notes: text(6000), links: z.array(linkSchema).max(30).default([]),
  due: date, daily: z.boolean().default(false), createdAt: z.string().max(40).default(''), doneAt: z.string().max(40).default(''),
}).strict();

export const goalSchema = z.object({
  title: z.string().trim().min(1).max(120), target: text(120), why: text(1000),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), months: z.number().int().min(1).max(36),
}).strict();

const yearSchema = z.object({
  images: z.array(z.object({ id, caption: text(120) }).strict()).max(24).default([]),
  todos: z.array(z.object({ id, text: z.string().trim().min(1).max(200), done: z.boolean().default(false) }).strict()).max(80).default([]),
}).strict();

export const boardSchema = z.object({
  goal: goalSchema.nullable().default(null),
  tracks: z.array(trackSchema).max(30).default([]),
  tasks: z.array(taskSchema).max(400).default([]),
  /** Daily tasks ticked off, per day: { '2026-10-13': ['taskid', …] } (only the last 120 days are kept). */
  daily: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.array(z.string().max(24)).max(60)).default({}),
  /** Coding profiles and other places to keep handy (LeetCode, GeeksforGeeks…). */
  profiles: z.array(linkSchema).max(20).default([]),
  vision: z.record(z.string().regex(/^\d{4}$/), yearSchema).default({}),
  updatedAt: z.string().max(40).default(''),
}).strict();

export type Link = z.infer<typeof linkSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Board = z.infer<typeof boardSchema>;
export type VisionYear = z.infer<typeof yearSchema>;

export const emptyBoard = (): Board => ({ goal: null, tracks: [], tasks: [], daily: {}, profiles: [], vision: {}, updatedAt: '' });

export const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 16);
/** A date as YYYY-MM-DD in the viewer's own time zone. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayMs = 86_400_000;
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

/** The goal's end date and how far through the timeline today is. */
export function timeline(goal: Goal, today = new Date()) {
  const start = parseDay(goal.start);
  const end = new Date(start); end.setMonth(end.getMonth() + goal.months);
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs));
  const now = parseDay(localDay(today));
  const elapsed = Math.round((now.getTime() - start.getTime()) / dayMs);
  return { end: localDay(end), totalDays: total, daysLeft: Math.round((end.getTime() - now.getTime()) / dayMs), percent: Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) };
}

/** Consecutive days (ending today, or yesterday if today isn't finished yet) with every daily task done. */
export function streak(board: Board, today = new Date()) {
  const dailyIds = board.tasks.filter((t) => t.daily).map((t) => t.id);
  if (!dailyIds.length) return 0;
  const allDone = (day: string) => dailyIds.every((tid) => (board.daily[day] ?? []).includes(tid));
  let count = 0;
  const d = parseDay(localDay(today));
  if (!allDone(localDay(d))) d.setDate(d.getDate() - 1);
  while (allDone(localDay(d)) && count < 999) { count++; d.setDate(d.getDate() - 1); }
  return count;
}

export type Nudge = { id: string; tone: 'info' | 'warn' | 'good'; text: string };

/** What the notification bell says: reminders to stay on the goal. `count` is what still needs doing today. */
export function nudges(board: Board, today = new Date()): { items: Nudge[]; count: number } {
  const items: Nudge[] = [];
  if (!board.goal) return { items, count: 0 };
  const day = localDay(today);
  const t = timeline(board.goal, today);
  const boardTasks = board.tasks.filter((x) => !x.daily); // daily tasks are habits, not board work
  const doneTasks = boardTasks.filter((x) => x.status === 'done').length;
  const pct = boardTasks.length ? Math.round((doneTasks / boardTasks.length) * 100) : 0;
  items.push(t.daysLeft >= 0
    ? { id: 'goal', tone: 'info', text: `${board.goal.title}: ${t.daysLeft} day${t.daysLeft === 1 ? '' : 's'} left, ${pct}% of tasks done.` }
    : { id: 'goal', tone: 'warn', text: `${board.goal.title}: the timeline ended ${-t.daysLeft} day${t.daysLeft === -1 ? '' : 's'} ago. Extend it or set your next goal.` });
  const daily = board.tasks.filter((x) => x.daily);
  const doneToday = daily.filter((x) => (board.daily[day] ?? []).includes(x.id)).length;
  let count = 0;
  if (daily.length && doneToday < daily.length) {
    count += daily.length - doneToday;
    items.push({ id: 'daily', tone: 'warn', text: `Today: ${doneToday} of ${daily.length} daily tasks done. Finish the rest to keep your streak.` });
  } else if (daily.length) items.push({ id: 'daily', tone: 'good', text: `All ${daily.length} daily tasks done today. Nice work!` });
  const overdue = boardTasks.filter((x) => x.status !== 'done' && x.due && x.due < day);
  if (overdue.length) { count += overdue.length; items.push({ id: 'overdue', tone: 'warn', text: `${overdue.length} task${overdue.length === 1 ? ' is' : 's are'} past the due date: ${overdue.slice(0, 2).map((x) => x.title).join(', ')}${overdue.length > 2 ? '…' : ''}` }); }
  const soon = boardTasks.filter((x) => x.status !== 'done' && x.due && x.due >= day && (parseDay(x.due).getTime() - parseDay(day).getTime()) / dayMs <= 2);
  if (soon.length) items.push({ id: 'soon', tone: 'info', text: `Due in the next 2 days: ${soon.slice(0, 3).map((x) => x.title).join(', ')}` });
  const doing = boardTasks.filter((x) => x.status === 'progress').length;
  if (doing) items.push({ id: 'doing', tone: 'info', text: `${doing} task${doing === 1 ? '' : 's'} in progress. Pick one and move it forward today.` });
  if (!boardTasks.length) items.push({ id: 'empty', tone: 'info', text: 'Break your goal into tasks: add the first one to your board.' });
  if (board.updatedAt) {
    const idle = Math.floor((today.getTime() - new Date(board.updatedAt).getTime()) / dayMs);
    if (idle >= 3) items.push({ id: 'idle', tone: 'warn', text: `You haven’t updated your plan in ${idle} days. Small steps count!` });
  }
  return { items, count };
}
