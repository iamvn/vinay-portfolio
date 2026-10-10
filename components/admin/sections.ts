'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Which admin sections are open. Every titled section (Card) and list entry can be folded; the choice is
 * remembered in this browser per tab, and "Expand all / Collapse all" sets every section of a tab at once.
 */
type State = { keys: Record<string, boolean>; scopes: Record<string, boolean> };
const STORAGE = 'admin-sections-v1';
let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(STORAGE) ?? '') as State; } catch { state = null; }
  if (!state || typeof state !== 'object' || !state.keys || !state.scopes) state = { keys: {}, scopes: {} };
  return state;
}
function save(next: State) {
  state = next;
  try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* not remembered; fine */ }
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** A stable key for a section title: counts like "Questions (3)" or "152 entries" don't change it. */
export const sectionKey = (title: unknown) => (typeof title === 'string' ? title.replace(/\d[\d,.]*/g, '#').trim().toLowerCase() : '');

/** The tab the sections belong to (set by the admin shell). */
export const SectionScope = createContext('');

/** Open state of one section; undefined key = not remembered (still foldable). */
export function useSectionOpen(key: string, defaultOpen: boolean, fallback: boolean): [boolean, (open: boolean) => void] {
  const scope = useContext(SectionScope);
  const id = key ? `${scope}:${key}` : '';
  const stored = useSyncExternalStore(subscribe, () => {
    if (!id) return undefined;
    const s = load();
    return s.keys[id] ?? s.scopes[scope];
  }, () => undefined);
  const open = id ? stored ?? defaultOpen : fallback;
  const set = (next: boolean) => {
    if (!id) return;
    const s = load();
    save({ ...s, keys: { ...s.keys, [id]: next } });
  };
  return [open, set];
}

/** Opens or folds every section of a tab (including ones not on screen right now). */
export function setAllSections(scope: string, open: boolean) {
  const s = load();
  const keys = Object.fromEntries(Object.entries(s.keys).filter(([key]) => !key.startsWith(`${scope}:`)));
  save({ keys, scopes: { ...s.scopes, [scope]: open } });
}
