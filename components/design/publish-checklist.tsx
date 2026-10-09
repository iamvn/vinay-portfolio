'use client';

import { useGetPuck, type Data } from '@puckeditor/core';
import { useEffect, useState } from 'react';
import { checkDesign, groupFindings, walkDesign, type CheckGroup, type Finding } from '@/lib/design/checks';
import type { PortfolioData } from '@/lib/portfolio';
import { designConfig } from './config';
import { auditDesktop, auditPhone } from './page-audit';

/**
 * The publish checklist: when you press Publish (or "Check page"), the draft is checked before it goes live:
 * the design data, plus the draft preview rendered at desktop and phone width in hidden frames. Problems
 * are listed in plain words, each with the blocks it affects ("Show" selects the block in the editor).
 */

export type ChecklistResult = { groups: CheckGroup[]; errors: number; warnings: number; pageChecked: boolean };

/** Loads the draft preview (audit mode) in a hidden frame of the given width and runs `audit` on it. */
function auditFrame(width: number, height: number, audit: (doc: Document) => Finding[], query = ''): Promise<Finding[]> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // Off screen but fully laid out (not display:none / visibility:hidden, which would hide everything inside).
    frame.style.cssText = `position:fixed;left:-${width + 2000}px;top:0;width:${width}px;height:${height}px;border:0;opacity:0;pointer-events:none;`;
    const done = (fn: () => void) => { clearTimeout(timer); fn(); frame.remove(); };
    const timer = setTimeout(() => done(() => reject(new Error('The page took too long to load.'))), 25000);
    frame.onload = async () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.body) throw new Error('Could not open the preview.');
        await doc.fonts?.ready;
        await new Promise((r) => setTimeout(r, 400)); // late layout (images, client components)
        const findings = audit(doc);
        done(() => resolve(findings));
      } catch (error) {
        done(() => reject(error));
      }
    };
    frame.src = `/admin/design/preview?audit=1&w=${width}&t=${Date.now()}${query ? `&${query}` : ''}`;
    document.body.appendChild(frame);
  });
}

/** Runs every check. The draft must be saved first (the page checks load the saved draft). */
export async function runChecklist(data: Data, portfolio: PortfolioData, query = ''): Promise<ChecklistResult> {
  const findings = checkDesign(data, portfolio);
  let pageChecked = true;
  try {
    const [desktop, phone] = await Promise.all([auditFrame(1280, 900, auditDesktop, query), auditFrame(390, 844, auditPhone, query)]);
    findings.push(...desktop, ...phone);
  } catch {
    pageChecked = false;
  }
  const groups = groupFindings(findings);
  const count = (severity: string) => groups.filter((g) => g.severity === severity).reduce((n, g) => n + g.items.length, 0);
  return { groups, errors: count('error'), warnings: count('warning'), pageChecked };
}

/** Names blocks for the list: "Button · Get in touch". */
function blockNames(data: Data) {
  const names = new Map<string, string>();
  const components = designConfig.components as unknown as Record<string, { label?: string }>;
  walkDesign(data, (item) => {
    const id = typeof item.props.id === 'string' ? item.props.id : '';
    if (!id) return;
    const label = components[item.type]?.label ?? item.type;
    const text = ['text', 'label', 'quote', 'title', 'formName'].map((k) => item.props[k]).find((v) => typeof v === 'string' && v.trim()) as string | undefined;
    names.set(id, text ? `${label} · ${text.length > 32 ? `${text.slice(0, 32)}…` : text}` : label);
  });
  return names;
}

/** Lets components outside <Puck> select a block (rendered inside Puck, e.g. in the header). */
export function PuckBridge({ onReady }: { onReady: (getPuck: ReturnType<typeof useGetPuck>) => void }) {
  const getPuck = useGetPuck();
  useEffect(() => { onReady(getPuck); }, [getPuck, onReady]);
  return null;
}

/** Selects a block in the editor and scrolls the canvas to it. */
export function showBlock(getPuck: ReturnType<typeof useGetPuck> | null, blockId: string) {
  if (!getPuck) return;
  const puck = getPuck();
  const selector = puck.getSelectorForId(blockId);
  if (selector) puck.dispatch({ type: 'setUi', ui: { itemSelector: selector } });
  const frame = document.querySelector<HTMLIFrameElement>('[class*="_PuckCanvas"] iframe, iframe#preview-frame') ?? document.querySelector('iframe');
  const el = frame?.contentDocument?.querySelector(`[data-puck-component="${CSS.escape(blockId)}"]`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function ChecklistPanel({ result, running, data, mode, onClose, onShow, onRecheck, onPublish, canPublish }: {
  result: ChecklistResult | null; running: boolean; data: Data; mode: 'publish' | 'check';
  onClose: () => void; onShow: (blockId: string) => void; onRecheck: () => void; onPublish: () => void; canPublish: boolean;
}) {
  const names = blockNames(data);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const clean = result && !result.errors && !result.warnings;

  return (
    <aside role="dialog" aria-label="Publish checklist"
      className="fixed bottom-4 left-4 top-20 z-[900] flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
      <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex-1">
          <p className="text-sm font-bold">{mode === 'publish' ? 'Before you publish' : 'Page check'}</p>
          <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">
            {running ? 'Checking your page on desktop and phone…'
              : clean ? 'All checks passed ✓'
              : result ? `${result.errors} problem${result.errors === 1 ? '' : 's'} · ${result.warnings} suggestion${result.warnings === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close checklist" className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {running && (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
          </div>
        )}
        {!running && clean && (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">Looks good ✓</p>
            <p className="mt-1 text-xs leading-5">Readable text, a clear heading order, working links, and a layout that fits phones.</p>
          </div>
        )}
        {!running && result && !result.pageChecked && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Couldn’t load the page to check colors and phone layout, so only the design settings were checked. Try “Check again”.</p>
        )}
        {!running && result?.groups.map((group) => {
          const expanded = open[group.check] ?? group.severity === 'error';
          return (
            <section key={group.check} className={`rounded-lg border ${group.severity === 'error' ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen((o) => ({ ...o, [group.check]: !expanded }))}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${group.severity === 'error' ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950'}`}>
                  {group.severity === 'error' ? 'Fix' : 'Tip'}
                </span>
                <span className="flex-1 text-[13px] font-semibold">{group.title}</span>
                <span className="text-xs text-slate-500">{group.items.length}</span>
                <span className="text-xs text-slate-400">{expanded ? '▾' : '▸'}</span>
              </button>
              {expanded && (
                <div className="space-y-2 px-3 pb-3">
                  <p className="text-xs leading-5 text-slate-600">{group.why} <b className="font-semibold text-slate-700">How to fix:</b> {group.fix}</p>
                  <ul className="space-y-1">
                    {group.items.map((item, i) => (
                      <li key={`${item.blockId ?? 'page'}-${i}`} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs shadow-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.blockId ? names.get(item.blockId) ?? 'Block' : 'Whole page'}</span>
                          {item.detail && <span className="block text-slate-500">{item.detail}</span>}
                        </span>
                        {item.blockId && names.has(item.blockId) && (
                          <button type="button" onClick={() => onShow(item.blockId!)} className="shrink-0 rounded border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-50">Show</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
        <button type="button" onClick={onRecheck} disabled={running} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">Check again</button>
        <span className="flex-1" />
        {canPublish && !running && result && (
          <button type="button" onClick={onPublish}
            className={`h-9 rounded-md px-3 text-xs font-semibold text-white ${clean ? 'bg-sky-600 hover:bg-sky-700' : 'bg-slate-700 hover:bg-slate-800'}`}>
            {clean ? 'Publish' : result.errors ? `Publish anyway (${result.errors} problem${result.errors === 1 ? '' : 's'})` : 'Publish anyway'}
          </button>
        )}
      </footer>
    </aside>
  );
}
