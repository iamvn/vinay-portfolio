'use client';

import '@puckeditor/core/puck.css';
import { Puck, type Data } from '@puckeditor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PortfolioData } from '@/lib/portfolio';
import { designConfig, projectDesignConfig, type DesignMetadata } from './config';
import type { ProjectView } from '@/lib/design/project-view';
import { invalidateApiCache } from '@/components/admin/api';
import { HintedFieldLabel } from './hints';
import { DesignTour, HelpButton, selectedBlock, type Block } from './tour';
import type { AppState, useGetPuck } from '@puckeditor/core';
import { ChecklistPanel, PuckBridge, runChecklist, showBlock, type ChecklistResult } from './publish-checklist';

type Status =
  | { kind: 'saved'; at: string | null }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'checking' }
  | { kind: 'publishing' }
  | { kind: 'published'; at: string }
  | { kind: 'error'; message: string };

const AUTOSAVE_MS = 1500;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

async function send(method: string, url: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (method !== 'GET') invalidateApiCache(); // the admin panel's cached Design status is now out of date
  const json = await response.json().catch(() => null);
  // Full page loads on purpose: the server re-checks the session, and the heavy editor is torn down.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (response.status === 401) window.location.assign('/login?next=/admin/design');
  if (!response.ok) throw new Error(json?.error ?? `Request failed (${response.status}).`);
  return json;
}

const LOCKED = { drag: false, duplicate: false, delete: false, edit: false, insert: false };

export type EditorPage = {
  /** 'home', 'project' (all project pages) or 'project:<slug>' (one project's own design). */
  scope: string;
  /** Query string for this page's API calls and links ('' for the homepage). */
  query: string;
  /** The project shown while editing project pages. */
  project: ProjectView | null;
  /** Projects to pick from (page switcher, "Preview with"). */
  choices: { slug: string; title: string; published: boolean }[];
};
const withQuery = (path: string, query: string) => (query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path);

/**
 * Full-screen visual editor for the homepage or project pages. Changes autosave as a draft; "Publish" makes
 * them live. `readOnly` (read-only users): the design can be browsed, but not changed or published.
 */
export function DesignEditor({ initialData, savedAt, isLive, portfolio, readOnly = false, page = { scope: 'home', query: '', project: null, choices: [] } }: { initialData: Data; savedAt: string | null; isLive: boolean; portfolio: PortfolioData; readOnly?: boolean; page?: EditorPage }) {
  const [status, setStatus] = useState<Status>({ kind: 'saved', at: savedAt });
  const [live, setLive] = useState(isLive);
  const latest = useRef<Data>(initialData);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const { scope, query, project, choices } = page;
  const isProject = scope !== 'home';
  const api = (path: string) => withQuery(path, query);
  // The editor never shows the floating "Ask AI" button (it would cover the canvas).
  const metadata = useMemo<DesignMetadata>(() => ({ portfolio, assistant: false, ...(project ? { project } : {}) }), [portfolio, project]);

  const saveNow = useCallback(async () => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    if (!dirty.current) return true;
    dirty.current = false;
    setStatus({ kind: 'saving' });
    try {
      const result = await send('PUT', withQuery('/api/design', query), { data: latest.current });
      setStatus({ kind: 'saved', at: result.savedAt });
      return true;
    } catch (error) {
      dirty.current = true;
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save.' });
      return false;
    }
  }, [query]);

  const onChange = useCallback((data: Data) => {
    if (readOnly) return;
    latest.current = data;
    dirty.current = true;
    setStatus({ kind: 'dirty' });
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(saveNow, AUTOSAVE_MS);
  }, [saveNow, readOnly]);

  const publishNow = useCallback(async (data: Data) => {
    latest.current = data;
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    setStatus({ kind: 'publishing' });
    try {
      const result = await send('POST', withQuery('/api/design/publish', query), { data });
      dirty.current = false;
      setLive(true);
      setStatus({ kind: 'published', at: result.publishedAt });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not publish.' });
    }
  }, [query]);

  // Publish checklist: Publish (and "✓ Check page") first check the draft; problems are listed before going live.
  const [checklist, setChecklist] = useState<{ open: boolean; running: boolean; result: ChecklistResult | null; mode: 'publish' | 'check'; data: Data }>({ open: false, running: false, result: null, mode: 'publish', data: initialData });
  const getPuck = useRef<ReturnType<typeof useGetPuck> | null>(null);
  const onPuckReady = useCallback((fn: ReturnType<typeof useGetPuck>) => { getPuck.current = fn; }, []);
  const runChecks = useCallback(async (mode: 'publish' | 'check') => {
    setChecklist((c) => ({ ...c, open: true, running: true, result: null, mode }));
    setStatus({ kind: 'checking' });
    if (!(await saveNow())) { setChecklist((c) => ({ ...c, open: false, running: false })); return null; } // the save error shows in the status
    const result = await runChecklist(latest.current, portfolio, withQuery(query, project && scope === 'project' ? `sample=${project.slug}` : ''));
    setChecklist({ open: true, running: false, result, mode, data: latest.current });
    setStatus({ kind: 'saved', at: new Date().toISOString() });
    return result;
  }, [saveNow, portfolio, query, project, scope]);

  const onPublish = useCallback(async (data: Data) => {
    if (JSON.stringify(data) !== JSON.stringify(latest.current)) { latest.current = data; dirty.current = true; }
    const result = await runChecks('publish');
    if (result && !result.errors && !result.warnings) {
      setChecklist((c) => ({ ...c, open: false }));
      await publishNow(latest.current);
    }
  }, [runChecks, publishNow]);

  // Warn before leaving with changes that haven't reached the server yet.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  async function openPreview() {
    const tab = window.open('about:blank', '_blank');
    if (await saveNow()) { if (tab) tab.location.href = withQuery(api('/admin/design/preview'), project && scope === 'project' ? `sample=${project.slug}` : ''); } else tab?.close();
  }

  // "Revert to live" asks for a second click, then throws away the draft and reloads what visitors see.
  const [confirmRevert, setConfirmRevert] = useState(false);
  // What the guided tour watches (page data + selected block), from every editor action.
  const [tourView, setTourView] = useState<{ data: Data; selected: Block | null }>({ data: initialData, selected: null });
  const onAction = useCallback((_action: unknown, appState: AppState) => {
    setTourView({ data: appState.data, selected: selectedBlock(appState) });
  }, []);
  useEffect(() => {
    if (!confirmRevert) return;
    const timer = setTimeout(() => setConfirmRevert(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmRevert]);

  async function revertToLive() {
    if (!confirmRevert) return setConfirmRevert(true);
    setConfirmRevert(false);
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    dirty.current = false;
    setStatus({ kind: 'saving' });
    try {
      await send('DELETE', api('/api/design'), {});
      window.location.reload();
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not revert.' });
    }
  }

  async function backToAdmin() {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (await saveNow()) window.location.assign('/admin#design');
  }

  /** Switches to another page's design (homepage, all project pages, one project), saving first. */
  async function goTo(next: string) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (await saveNow()) window.location.assign(`/admin/design${next ? `?${next}` : ''}`);
  }
  const pageValue = scope === 'home' ? '' : scope === 'project' ? 'page=project' : `page=project&project=${encodeURIComponent(scope.slice('project:'.length))}`;
  const liveUrl = isProject ? (project ? `/projects/${project.slug}` : null) : '/';
  const title = scope === 'home' ? 'Homepage' : scope === 'project' ? 'Project pages' : project?.title ?? 'Project';
  const liveText = scope === 'home'
    ? (live ? 'Your design is live' : 'Built-in design is live')
    : scope === 'project'
      ? (live ? 'Your design is live on every project' : 'Built-in project page is live')
      : (live ? 'Its own design is live' : 'Shared design is live');

  const statusText = readOnly ? 'View only: you can’t change or publish the design' : {
    saved: status.kind === 'saved' && status.at ? `Draft saved ${time(status.at)}` : 'No changes yet',
    dirty: 'Unsaved changes…',
    saving: 'Saving draft…',
    checking: 'Checking your page…',
    publishing: 'Publishing…',
    published: status.kind === 'published' ? `Live since ${time(status.at)} ✓` : '',
    error: status.kind === 'error' ? status.message : '',
  }[status.kind];

  const small = 'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50';

  return (
    <div className="admin-shell design-editor h-dvh bg-white text-slate-900">
      <Puck
        config={isProject ? projectDesignConfig : designConfig}
        data={initialData}
        metadata={metadata}
        onChange={onChange}
        onAction={readOnly ? undefined : onAction}
        onPublish={onPublish}
        permissions={readOnly ? LOCKED : undefined}
        headerTitle={title}
        headerPath={`· ${liveText}`}
        viewports={[
          { width: 390, height: 'auto', label: 'Phone' },
          { width: 820, height: 'auto', label: 'Tablet' },
          { width: 1280, height: 'auto', label: 'Desktop' },
        ]}
        overrides={{
          fieldLabel: HintedFieldLabel,
          headerActions: ({ children }) => (
            <>
              {!readOnly && <HelpButton className={small} />}
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                <span className="sr-only 2xl:not-sr-only">Page</span>
                <select aria-label="Page to design" value={pageValue} onChange={(e) => goTo(e.target.value)} className={`${small} max-w-40 pr-2`}>
                  <option value="">Homepage</option>
                  <option value="page=project">All project pages</option>
                  {choices.length > 0 && <optgroup label="One project (its own design)">
                    {choices.map((c) => <option key={c.slug} value={`page=project&project=${encodeURIComponent(c.slug)}`}>{c.title}{c.published ? '' : ' (draft)'}</option>)}
                  </optgroup>}
                </select>
              </label>
              {scope === 'project' && choices.length > 1 && (
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <span className="sr-only 2xl:not-sr-only">Preview with</span>
                  <select aria-label="Preview with project" title="Preview with project" value={project?.slug ?? ''} onChange={(e) => goTo(`page=project&sample=${encodeURIComponent(e.target.value)}`)} className={`${small} max-w-36 pr-2`}>
                    {choices.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
                  </select>
                </label>
              )}
              <span role="status" aria-live="polite" className={`max-w-36 shrink-0 truncate text-xs ${status.kind === 'error' ? 'inline' : 'hidden xl:inline'} ${status.kind === 'error' ? 'font-semibold text-red-600' : status.kind === 'published' ? 'font-semibold text-green-700' : 'text-slate-500'}`} title={statusText}>{statusText}</span>
              <button type="button" onClick={backToAdmin} className={small} aria-label="Back to Admin" title="Back to Admin">←<span className="ml-1 hidden 2xl:inline">Admin</span></button>
              {!readOnly && <button type="button" onClick={revertToLive} className={`${small} ${confirmRevert ? 'border-red-400 bg-red-50 text-red-700' : ''}`} title="Revert to live: throw away draft changes and load the design visitors see now" aria-label={confirmRevert ? 'Click again to discard changes' : 'Revert to live'}>
                {confirmRevert ? 'Click again to discard changes' : <>↺<span className="ml-1 hidden 2xl:inline">Revert to live</span></>}
              </button>}
              <PuckBridge onReady={onPuckReady} />
              <button type="button" onClick={openPreview} className={small}>Preview ↗</button>
              {!readOnly && <button type="button" onClick={() => runChecks('check')} disabled={checklist.running} className={small} aria-label="Check page" title="Check readability, links and the phone layout">✓ Check<span className="hidden 2xl:inline">&nbsp;page</span></button>}
              {live && liveUrl && <a href={liveUrl} target="_blank" rel="noreferrer" className={small}>Live ↗</a>}
              {!readOnly && children}
            </>
          ),
        }}
      />
      {!readOnly && <DesignTour data={tourView.data} selected={tourView.selected} />}
      {!readOnly && checklist.open && (
        <ChecklistPanel
          result={checklist.result} running={checklist.running} data={checklist.data} mode={checklist.mode} canPublish
          onClose={() => setChecklist((c) => ({ ...c, open: false }))}
          onShow={(id) => showBlock(getPuck.current, id)}
          onRecheck={() => runChecks(checklist.mode)}
          onPublish={() => { setChecklist((c) => ({ ...c, open: false })); publishNow(latest.current); }}
        />
      )}
    </div>
  );
}
