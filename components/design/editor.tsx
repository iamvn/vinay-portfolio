'use client';

import '@puckeditor/core/puck.css';
import { Puck, type Data } from '@puckeditor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PortfolioData } from '@/lib/portfolio';
import { designConfig, type DesignMetadata } from './config';

type Status =
  | { kind: 'saved'; at: string | null }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'publishing' }
  | { kind: 'published'; at: string }
  | { kind: 'error'; message: string };

const AUTOSAVE_MS = 1500;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

async function send(method: string, url: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => null);
  // Full page loads on purpose: the server re-checks the session, and the heavy editor is torn down.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (response.status === 401) window.location.assign('/login?next=/admin/design');
  if (!response.ok) throw new Error(json?.error ?? `Request failed (${response.status}).`);
  return json;
}

const LOCKED = { drag: false, duplicate: false, delete: false, edit: false, insert: false };

/**
 * Full-screen visual editor. Changes autosave as a draft; "Publish" makes them live on the homepage.
 * `readOnly` (read-only users): the design can be browsed, but blocks can't be moved, edited or published.
 */
export function DesignEditor({ initialData, savedAt, isLive, portfolio, readOnly = false }: { initialData: Data; savedAt: string | null; isLive: boolean; portfolio: PortfolioData; readOnly?: boolean }) {
  const [status, setStatus] = useState<Status>({ kind: 'saved', at: savedAt });
  const [live, setLive] = useState(isLive);
  const latest = useRef<Data>(initialData);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  // The editor never shows the floating "Ask AI" button (it would cover the canvas).
  const metadata = useMemo<DesignMetadata>(() => ({ portfolio, assistant: false }), [portfolio]);

  const saveNow = useCallback(async () => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    if (!dirty.current) return true;
    dirty.current = false;
    setStatus({ kind: 'saving' });
    try {
      const result = await send('PUT', '/api/design', { data: latest.current });
      setStatus({ kind: 'saved', at: result.savedAt });
      return true;
    } catch (error) {
      dirty.current = true;
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save.' });
      return false;
    }
  }, []);

  const onChange = useCallback((data: Data) => {
    if (readOnly) return;
    latest.current = data;
    dirty.current = true;
    setStatus({ kind: 'dirty' });
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(saveNow, AUTOSAVE_MS);
  }, [saveNow, readOnly]);

  const onPublish = useCallback(async (data: Data) => {
    latest.current = data;
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    setStatus({ kind: 'publishing' });
    try {
      const result = await send('POST', '/api/design/publish', { data });
      dirty.current = false;
      setLive(true);
      setStatus({ kind: 'published', at: result.publishedAt });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not publish.' });
    }
  }, []);

  // Warn before leaving with changes that haven't reached the server yet.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  async function openPreview() {
    const tab = window.open('about:blank', '_blank');
    if (await saveNow()) { if (tab) tab.location.href = '/admin/design/preview'; } else tab?.close();
  }

  // "Revert to live" asks for a second click, then throws away the draft and reloads what visitors see.
  const [confirmRevert, setConfirmRevert] = useState(false);
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
      await send('DELETE', '/api/design', {});
      window.location.reload();
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not revert.' });
    }
  }

  async function backToAdmin() {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (await saveNow()) window.location.assign('/admin#design');
  }

  const statusText = readOnly ? 'View only: you can’t change or publish the design' : {
    saved: status.kind === 'saved' && status.at ? `Draft saved ${time(status.at)}` : 'No changes yet',
    dirty: 'Unsaved changes…',
    saving: 'Saving draft…',
    publishing: 'Publishing…',
    published: status.kind === 'published' ? `Live since ${time(status.at)} ✓` : '',
    error: status.kind === 'error' ? status.message : '',
  }[status.kind];

  const small = 'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50';

  return (
    <div className="admin-shell design-editor h-dvh bg-white text-slate-900">
      <Puck
        config={designConfig}
        data={initialData}
        metadata={metadata}
        onChange={onChange}
        onPublish={onPublish}
        permissions={readOnly ? LOCKED : undefined}
        headerTitle={live ? 'Homepage design · custom design is live' : 'Homepage design · built-in classic is live'}
        viewports={[
          { width: 390, height: 'auto', label: 'Phone' },
          { width: 820, height: 'auto', label: 'Tablet' },
          { width: 1280, height: 'auto', label: 'Desktop' },
        ]}
        overrides={{
          headerActions: ({ children }) => (
            <>
              <span role="status" aria-live="polite" className={`hidden max-w-64 truncate text-xs md:inline ${status.kind === 'error' ? 'font-semibold text-red-600' : status.kind === 'published' ? 'font-semibold text-green-700' : 'text-slate-500'}`} title={statusText}>{statusText}</span>
              <button type="button" onClick={backToAdmin} className={small}>← Admin</button>
              {!readOnly && <button type="button" onClick={revertToLive} className={`${small} ${confirmRevert ? 'border-red-400 bg-red-50 text-red-700' : ''}`} title="Throw away draft changes and load the design visitors see now">
                {confirmRevert ? 'Click again to discard changes' : '↺ Revert to live'}
              </button>}
              <button type="button" onClick={openPreview} className={small}>Preview ↗</button>
              {live && <a href="/" target="_blank" rel="noreferrer" className={small}>Live site ↗</a>}
              {!readOnly && children}
            </>
          ),
        }}
      />
    </div>
  );
}
