'use client';

import type { AppState, Data } from '@puckeditor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Guided tours for Admin → Design. Each step points at the real part of the editor (a spotlight plus a
 * card) and, for hands-on steps, waits until you've actually done the thing: the tour reads the editor's
 * live state, so "drag a Heading onto the page" moves on by itself once there's a new Heading.
 *
 * Open from the "? Help" button in the top bar; the first tour starts by itself the first time.
 */

export type Block = { type: string; props: Record<string, unknown> };
type State = { blocks: Block[]; selected: Block | null };
type Step = {
  title: string;
  body: string;
  /** What to highlight. Return null for a centered card. */
  target?: () => Element | null;
  /** Hands-on: the step completes when this returns true (compared with the state when the step started). */
  done?: (now: State, start: State) => boolean;
  /** Dim the rest of the screen (off for steps where you drag across the screen). */
  dim?: boolean;
};
type Tour = { id: string; title: string; description: string; minutes: number; steps: Step[] };

// ---------- reading the editor ----------

function allBlocks(data: unknown): Block[] {
  const out: Block[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const item = node as { type?: unknown; props?: Record<string, unknown> };
    if (typeof item.type === 'string' && item.props) {
      out.push(item as Block);
      for (const value of Object.values(item.props)) if (Array.isArray(value)) walk(value);
    }
  };
  walk((data as { content?: unknown })?.content);
  return out;
}
const count = (s: State, ...types: string[]) => s.blocks.filter((b) => types.includes(b.type)).length;
const isBox = (b: Block | null | undefined) => Boolean(b && (b.type === 'Box' || b.type.startsWith('Quick')));
const get = (b: Block | null | undefined, path: string) => path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), b?.props);
const children = (b: Block) => (Array.isArray(b.props.content) ? (b.props.content as Block[]) : []);

/** The block selected in the editor, from Puck's app state (fed in through Puck's onAction). */
export function selectedBlock(appState: AppState): Block | null {
  const sel = appState.ui?.itemSelector;
  if (!sel || typeof sel.index !== 'number') return null;
  const zone = sel.zone ?? 'root:default-zone';
  if (zone === 'root:default-zone') return (appState.data.content?.[sel.index] as Block | undefined) ?? null;
  const at = zone.lastIndexOf(':');
  const parentId = zone.slice(0, at); const slot = zone.slice(at + 1);
  const parent = allBlocks(appState.data).find((b) => b.props.id === parentId);
  const list = parent?.props[slot];
  return Array.isArray(list) ? ((list[sel.index] as Block | undefined) ?? null) : null;
}

// ---------- finding things on screen ----------

const q = (selector: string) => document.querySelector(selector);
const drawerItem = (label: string) => {
  const el = [...document.querySelectorAll('[class*="_DrawerItem-name"]')].find((e) => e.textContent?.trim() === label);
  return el?.closest('[class*="_DrawerItem_"]') ?? el ?? null;
};
const blocksPanel = () => q('[class*="_BlocksPlugin_"]');
const fieldsPanel = () => q('[class*="_PuckFields_"]')?.closest('[class*="_PuckLayout-rightSideBar"], [class*="SidebarSection"], aside') ?? q('[class*="_PuckFields_"]');
const canvas = () => q('[class*="_PuckCanvas-root"]') ?? q('iframe');
const viewports = () => q('[class*="_ViewportControls"]');
const headerButton = (text: string) => [...document.querySelectorAll('header button, header a, [class*="_PuckHeader"] button, [class*="_PuckHeader"] a')].find((el) => el.textContent?.trim().startsWith(text)) ?? null;

// ---------- the tours ----------

const TOURS: Tour[] = [
  {
    id: 'basics', title: 'Your first 2 minutes', minutes: 2,
    description: 'Where everything is, then add and edit your first block.',
    steps: [
      { title: 'Welcome to the design editor 👋', body: 'You build your homepage here by dragging blocks onto the page and changing their settings. Nothing goes live until you press Publish. Let’s take a quick look around.' },
      { title: 'Blocks', body: 'Everything you can add. Start with “Quick add” for ready-made layouts, or use Layout and Basic elements to build your own. Drag a block onto the page to add it.', target: blocksPanel },
      { title: 'Your page', body: 'This is your page as visitors will see it. Click any block on it to select it; drag blocks to move them.', target: canvas },
      { title: 'Settings', body: 'The settings of the selected block. Each block has two sides: ✎ Content (texts, links, images) and 🎨 Design (space, size, colors, border). Click ⓘ next to any setting for a plain-words explanation.', target: fieldsPanel },
      { title: 'Phone, tablet, desktop', body: 'Switch the preview size to check your page on a phone. Most visitors are on phones!', target: viewports },
      { title: 'Try it: add a heading', body: 'Drag “Heading” from the Blocks list (Basic elements) onto the page. Drop it where you see the blue line.', target: () => drawerItem('Heading'), dim: false, done: (now, start) => count(now, 'Heading') > count(start, 'Heading') },
      { title: 'Now change its text', body: 'Click your new heading on the page, then type new text in “Heading” under ✎ Content on the right.', target: fieldsPanel, dim: false,
        done: (now) => now.blocks.some((b) => b.type === 'Heading' && typeof b.props.text === 'string' && b.props.text !== 'Heading' && b.props.text.trim() !== '') },
      { title: 'Preview and publish', body: '“Preview” opens your page in a new tab. “Publish” puts it live. Your work is saved as a draft automatically, so you can stop any time.', target: () => headerButton('Publish') ?? headerButton('Preview') },
      { title: 'You’re ready! 🎉', body: 'More tours are under “? Help” (top bar): two boxes side by side, styling any block, and building a contact form.' },
    ],
  },
  {
    id: 'side-by-side', title: 'Two boxes side by side', minutes: 3,
    description: 'Use a Box to put things next to each other (a row), then color them.',
    steps: [
      { title: 'Boxes are like building bricks', body: 'A Box is an empty container. Put blocks inside it, and choose how they sit: stacked, side by side (Flex), or in a grid. Let’s make two columns.' },
      { title: 'Add a Box', body: 'Drag “Box (div)” from Layout onto the page.', target: () => drawerItem('Box (div)'), dim: false, done: (now, start) => count(now, 'Box') > count(start, 'Box') },
      { title: 'Select it', body: 'Click the new box on the page (the dashed outline). Its settings open on the right.', target: canvas, dim: false, done: (now) => isBox(now.selected) },
      { title: 'Make it a row', body: 'Under Layout, choose “Flex (row / column)”. Direction is “Row” by default: things inside will sit side by side.', target: fieldsPanel, dim: false, done: (now) => now.blocks.some((b) => isBox(b) && get(b, 'layout.display') === 'flex') },
      { title: 'Put two boxes inside', body: 'Drag two more “Box (div)” blocks INTO the row box: drop the second one to the right of the first.', target: () => drawerItem('Box (div)'), dim: false,
        done: (now) => now.blocks.some((b) => isBox(b) && get(b, 'layout.display') === 'flex' && children(b).filter((c) => c.type === 'Box').length >= 2) },
      { title: 'Give one a color', body: 'Click one of the inner boxes. In “Background, border & text”, set Background to a theme color (like Accent tint) or “Custom color…”.', target: fieldsPanel, dim: false,
        done: (now) => now.blocks.some((b) => b.type === 'Box' && get(b, 'look.fill') !== 'none' && get(b, 'look.fill') !== undefined) },
      { title: 'Nice! Now fill them', body: 'Drag a Heading or Text into each box. Tips: set “Grow to fill space” on a box to make it take the leftover width, or type a Width like 300px. On phones the row stacks automatically.' },
    ],
  },
  {
    id: 'style', title: 'Style any block', minutes: 2,
    description: 'Space, rounded corners and colors for any block (hero, heading, button…).',
    steps: [
      { title: 'Select a block', body: 'Click any block on your page: a heading, the hero, a button…', target: canvas, dim: false, done: (now) => Boolean(now.selected) && !isBox(now.selected) },
      { title: 'Open the Design side', body: 'At the top of the settings, switch to “🎨 Design”.', target: fieldsPanel, dim: false, done: (now) => now.selected?.props._view === 'design' },
      { title: 'Add some space', body: 'In Spacing → Padding (inside), type 24 in the middle “all” box. Padding is space inside the edges; Margin is space outside.', target: fieldsPanel, dim: false,
        done: (now) => { const p = get(now.selected, 'spacing.padding') as Record<string, string> | undefined; return Boolean(p && Object.values(p).some((v) => v)); } },
      { title: 'Round the corners', body: 'In “Border, corners & shadow”, type 16px in Corner radius. Add a Background color in “Background & colors” to see it.', target: fieldsPanel, dim: false, done: (now) => Boolean(get(now.selected, 'border.radius')) },
      { title: 'That’s styling 🎨', body: 'Every block has the same Design side. Not sure what something does? Click the ⓘ next to it. Switch back to “✎ Content” to edit texts.' },
    ],
  },
  {
    id: 'form', title: 'Build a contact form', minutes: 2,
    description: 'A form visitors can send you, with a dropdown. Messages land in Insights.',
    steps: [
      { title: 'Add a form', body: 'Drag “Form” (in Forms) onto the page. It comes with name, email and message fields.', target: () => drawerItem('Form'), dim: false, done: (now, start) => count(now, 'Form') > count(start, 'Form') },
      { title: 'Add a dropdown', body: 'Drag “Dropdown / multi-select” INTO the form, between its fields.', target: () => drawerItem('Dropdown / multi-select'), dim: false,
        done: (now) => now.blocks.some((b) => b.type === 'Form' && Array.isArray(b.props.fields) && (b.props.fields as Block[]).some((f) => f.type === 'SelectField')) },
      { title: 'Edit its options', body: 'Click the dropdown on the page. Change its Label and Options on the right. Pick “Several (multi-select)” if people may choose more than one.', target: fieldsPanel, dim: false },
      { title: 'Where messages go', body: 'After you publish, messages people send appear in Admin → Insights → Form messages. Forms don’t send while you’re editing.' },
    ],
  },
];

const SEEN_KEY = 'design-tour-seen-v1';
export const TOUR_EVENT = 'design-tour:open';
/** Opens the Help menu (no id) or starts a tour. */
export const openTour = (id?: string) => window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: id ?? null }));

// ---------- the layer ----------

type Rect = { top: number; left: number; width: number; height: number };

function useTargetRect(find: (() => Element | null) | undefined, active: boolean) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!active || !find) return;
    let scrolled = false;
    const update = () => {
      const el = find();
      // Bring the target into view once (e.g. a block lower down in the Blocks list).
      if (el && !scrolled) {
        scrolled = true;
        const r0 = el.getBoundingClientRect();
        if (r0.bottom > window.innerHeight || r0.top < 0) el.scrollIntoView({ block: 'center' });
      }
      const r = el?.getBoundingClientRect();
      setRect((old) => {
        if (!r || (r.width === 0 && r.height === 0)) return old === null ? old : null;
        const next = { top: r.top, left: r.left, width: r.width, height: r.height };
        return old && Math.abs(old.top - next.top) < 1 && Math.abs(old.left - next.left) < 1 && Math.abs(old.width - next.width) < 1 && Math.abs(old.height - next.height) < 1 ? old : next;
      });
    };
    update();
    const timer = setInterval(update, 250); // follows scrolling, resizing and panels opening
    window.addEventListener('resize', update);
    return () => { clearInterval(timer); window.removeEventListener('resize', update); };
  }, [find, active]);
  return active && find ? rect : null;
}

function cardPosition(rect: Rect | null, size = { w: 340, h: 210 }) {
  const vw = window.innerWidth; const vh = window.innerHeight; const m = 16;
  if (!rect) return { top: vh / 2 - size.h / 2, left: vw / 2 - size.w / 2 };
  const clampLeft = (x: number) => Math.min(vw - size.w - m, Math.max(m, x));
  const clampTop = (y: number) => Math.min(vh - size.h - m, Math.max(m, y));
  if (rect.left + rect.width + size.w + m * 2 < vw) return { top: clampTop(rect.top), left: rect.left + rect.width + m };   // right
  if (rect.left - size.w - m * 2 > 0) return { top: clampTop(rect.top), left: rect.left - size.w - m };                  // left
  if (rect.top + rect.height + size.h + m * 2 < vh) return { top: rect.top + rect.height + m, left: clampLeft(rect.left) }; // below
  return { top: clampTop(rect.top - size.h - m), left: clampLeft(rect.left) };                                           // above
}

/**
 * Rendered next to (not inside) <Puck>: wrapping Puck's UI makes it reload its preview frame. The editor
 * passes the page data and the selected block, taken from Puck's onAction.
 */
export function DesignTour({ data, selected }: { data: Data; selected: Block | null }) {
  const state: State = useMemo(() => ({ blocks: allBlocks(data), selected }), [data, selected]);
  const [menu, setMenu] = useState(false);
  const [tour, setTour] = useState<Tour | null>(null);
  const [index, setIndex] = useState(0);
  // What the page looked like when the step started, so "add a heading" means one more than before.
  const [startState, setStartState] = useState<State>(state);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);

  const begin = useCallback((id: string) => {
    const next = TOURS.find((t) => t.id === id);
    if (!next) return;
    setMenu(false);
    setTour(next);
    setIndex(0);
    setStartState(latest.current);
  }, []);
  const close = useCallback(() => {
    setTour(null);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
  }, []);

  // "? Help" button and first-time start.
  useEffect(() => {
    const onOpen = (event: Event) => { const id = (event as CustomEvent<string | null>).detail; if (id) begin(id); else setMenu((m) => !m); };
    window.addEventListener(TOUR_EVENT, onOpen);
    let seen = true;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* keep quiet */ }
    const timer = seen ? null : setTimeout(() => begin('basics'), 1200);
    return () => { window.removeEventListener(TOUR_EVENT, onOpen); if (timer) clearTimeout(timer); };
  }, [begin]);

  const step = tour?.steps[index];
  const go = useCallback((to: number) => {
    if (!tour) return;
    if (to >= tour.steps.length) { close(); return; }
    setIndex(Math.max(0, to));
    setStartState(latest.current);
  }, [tour, close]);

  // Hands-on steps move on by themselves once done (after a short "✓ Done" moment).
  const completed = Boolean(step?.done && step.done(state, startState));
  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(() => go(index + 1), 1100);
    return () => clearTimeout(timer);
  }, [completed, go, index]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, close]);

  const rect = useTargetRect(step?.target, Boolean(tour));
  const pos = tour ? cardPosition(rect) : { top: 0, left: 0 }; // window only exists in the browser

  return (
    <>
      {menu && !tour && (
        <div className="fixed inset-0 z-[1000]" onClick={() => setMenu(false)}>
          <div role="dialog" aria-label="Help and tours" onClick={(e) => e.stopPropagation()}
            className="absolute right-4 top-16 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl">
            <p className="text-sm font-bold">Learn the design editor</p>
            <p className="mt-0.5 text-xs text-slate-500">Short hands-on tours: each step shows you where to click and moves on when you’ve done it.</p>
            <ul className="mt-3 space-y-2">
              {TOURS.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => begin(t.id)} className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-sky-400 hover:bg-sky-50">
                    <span className="flex items-center justify-between text-sm font-semibold">{t.title}<span className="text-[11px] font-normal text-slate-400">{t.minutes} min</span></span>
                    <span className="mt-0.5 block text-xs text-slate-500">{t.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <b>Tips:</b> start from <b>Quick add</b> (ready-made layouts) and change them. Click <b className="inline-grid size-4 place-items-center rounded-full bg-slate-200 text-[10px]">i</b> next to a setting to see what it does. Undo/redo are at the top.
            </div>
          </div>
        </div>
      )}

      {tour && step && (
        <div className="pointer-events-none fixed inset-0 z-[1000]" aria-live="polite">
          {/* spotlight: dims everything except the target; clicks pass through so you can do the step */}
          {rect ? (
            <div className="absolute rounded-lg transition-all duration-200" style={{
              top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
              boxShadow: `0 0 0 3px #0ea5e9, 0 0 0 9999px rgba(15,23,42,${step.dim === false ? 0 : 0.45})`,
            }}><span className="absolute inset-0 animate-pulse rounded-lg ring-4 ring-sky-400/40" /></div>
          ) : step.dim !== false && <div className="absolute inset-0 bg-slate-900/45" />}

          <div role="dialog" aria-label={step.title} className="pointer-events-auto absolute w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl"
            style={{ top: pos.top, left: pos.left }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">{tour.title} · {index + 1} of {tour.steps.length}</p>
            <p className="mt-1 text-[15px] font-bold">{step.title}</p>
            <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{step.body}</p>
            {step.done && (
              <p className={`mt-2 rounded-md px-2 py-1 text-xs font-semibold ${completed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {completed ? '✓ Done! Moving on…' : '👆 Your turn: do this in the editor. The tour continues by itself.'}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={close} className="text-xs font-semibold text-slate-400 hover:text-slate-700">Skip tour</button>
              <span className="flex-1" />
              {index > 0 && <button type="button" onClick={() => go(index - 1)} className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50">Back</button>}
              <button type="button" onClick={() => go(index + 1)} className="h-8 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700">
                {index === tour.steps.length - 1 ? 'Finish' : step.done && !completed ? 'Skip step' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The "? Help" button for the editor's top bar. */
export function HelpButton({ className }: { className: string }) {
  return <button type="button" onClick={() => openTour()} className={`${className} border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100`} aria-label="Help and guided tours">? Help</button>;
}
