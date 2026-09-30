'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, buttonBase, type Notify } from './ui';
import { THEME_PRESETS } from '@/lib/design/theme';

type Status = {
  draft: { savedAt: string; savedBy: string; template?: string } | null;
  published: { savedAt: string; savedBy: string } | null;
  unpublishedChanges: boolean;
  history: { index: number; savedAt: string; savedBy: string }[];
  templates: { id: string; name: string; description: string }[];
};

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** Tiny picture of each template, drawn with its theme colors. */
const THUMBS: Record<string, { theme: keyof typeof THEME_PRESETS; layout: 'arcade' | 'centered' | 'split' | 'blank' | 'classic' }> = {
  classic: { theme: 'arcade', layout: 'classic' },
  arcade: { theme: 'arcade', layout: 'arcade' },
  minimal: { theme: 'paper', layout: 'centered' },
  studio: { theme: 'clean', layout: 'split' },
  blank: { theme: 'clean', layout: 'blank' },
};

function Thumb({ id }: { id: string }) {
  const { theme, layout } = THUMBS[id] ?? THUMBS.blank;
  const t = THEME_PRESETS[theme];
  const bar = (w: string, color: string = t.muted, h = 4) => <span className="block rounded-full" style={{ width: w, height: h, background: color, opacity: 0.8 }} />;
  const card = <span className="block h-7 rounded" style={{ background: t.surface, border: `1px solid ${t.line}` }} />;
  return (
    <div aria-hidden="true" className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/10 p-3" style={{ background: t.bg }}>
      {layout === 'blank' ? (
        <div className="flex h-full items-center justify-center rounded border-2 border-dashed text-[10px] font-bold" style={{ borderColor: t.line, color: t.muted }}>Empty page</div>
      ) : (
        <div className="grid h-full content-start gap-2">
          <div className="flex items-center justify-between">{bar('28%', t.text)}<span className="flex gap-1">{bar('10px')}{bar('10px')}{bar('10px')}</span></div>
          {layout === 'classic' && <div className="grid grid-cols-[18%_1fr] gap-2"><span className="block h-16 rounded" style={{ background: t.surface }} /><div className="grid gap-1.5 rounded p-2" style={{ background: t.surface }}>{bar('35%', t.accent)}{bar('70%', t.text, 7)}{bar('40%', t.accent2)}</div></div>}
          {layout === 'arcade' && <div className="grid gap-1.5 rounded p-2" style={{ background: t.surface, border: `1px solid ${t.line}` }}>{bar('30%', t.accent)}{bar('75%', t.text, 8)}{bar('40%', t.accent2)}<span className="mt-1 flex gap-1">{bar('18%', t.accent, 6)}{bar('18%', t.line, 6)}</span></div>}
          {layout === 'centered' && <div className="grid justify-items-center gap-1.5 py-1"><span className="block size-6 rounded-full" style={{ background: t.surface2, border: `2px solid ${t.accent}` }} />{bar('55%', t.text, 7)}{bar('35%', t.accent2)}{bar('25%', t.accent, 6)}</div>}
          {layout === 'split' && <div className="grid grid-cols-[1.3fr_1fr] items-center gap-2"><div className="grid gap-1.5">{bar('40%', t.accent)}{bar('85%', t.text, 7)}{bar('60%')}{bar('30%', t.accent, 6)}</div><span className="block h-14 rounded" style={{ background: t.surface2 }} /></div>}
          <div className="grid grid-cols-3 gap-1.5">{card}{card}{card}</div>
        </div>
      )}
    </div>
  );
}

export function DesignTab({ notify }: { notify: Notify }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const load = useCallback(() => {
    api<Status>('GET', '/api/design').then(setStatus).catch((error) => notify(describeError(error), 'error'));
  }, [notify]);
  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, message: string, then?: () => void) {
    setBusy(true);
    try {
      await action();
      notify(message);
      if (then) then(); else load();
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <Loading />;
  const live = status.published;
  const startFrom = (id: string, name: string) =>
    run(() => api('POST', '/api/design/template', { id }), `${name} loaded into your draft. Opening the editor…`, () => router.push('/admin/design'));

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card
        title="Homepage design"
        actions={<span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${live ? 'bg-lime-300/15 text-lime-200' : 'bg-white/5 text-slate-300'}`}>{live ? '● Custom design live' : '● Classic design live'}</span>}
      >
        <p className="text-sm text-slate-300">
          {live
            ? <>Visitors see your custom design, published {when(live.savedAt)} by {live.savedBy}.</>
            : <>Visitors see the built-in classic design. Open the editor (it starts from an editable copy of it) or pick a template, then press <b>Publish</b>.</>}
        </p>
        {status.draft && (
          <p className="mt-1 text-xs text-slate-500">
            Draft last saved {when(status.draft.savedAt)}{status.unpublishedChanges ? ' · has changes that are not live yet' : ' · same as live'}.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <a href="/admin/design" className={`${buttonBase} col-span-2 bg-lime-300 text-black hover:bg-lime-200 sm:col-span-1`}>Open design editor</a>
          {status.draft && <a href="/admin/design/preview" target="_blank" rel="noreferrer" className={`${buttonBase} border border-white/15 text-slate-200 hover:border-cyan-300/60`}>Preview draft ↗</a>}
          {status.draft && status.unpublishedChanges && <Button onClick={() => run(() => api('POST', '/api/design/publish', {}), 'Published. The homepage now shows your design.')} disabled={busy}>Publish draft</Button>}
          {status.draft && status.unpublishedChanges && <ConfirmButton onConfirm={() => run(() => api('DELETE', '/api/design'), live ? 'Draft reverted to the live design.' : 'Draft discarded. The editor starts from the live Classic design again.')} disabled={busy} confirmLabel="Tap again to discard" className="border-white/15! text-slate-200!">↺ Revert draft to live</ConfirmButton>}
          {live && <ConfirmButton onConfirm={() => run(() => api('DELETE', '/api/design/publish'), 'Switched back to the built-in classic design. Your draft is kept.')} disabled={busy} confirmLabel="Tap again to switch">Use built-in classic</ConfirmButton>}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          The editor works best on a laptop or tablet. Your name, projects, experience, skills and site text still come from the other tabs; a design only controls layout and style.
        </p>
      </Card>

      <Card title="Templates">
        <p className="mb-4 text-sm text-slate-400">Starting from a template replaces your current draft. Nothing changes on the live site until you publish.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {status.templates.map((template) => (
            <article key={template.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <Thumb id={template.id} />
              <div>
                <h4 className="font-black text-white">{template.name}{status.draft?.template === template.id && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400">In draft</span>}</h4>
                <p className="mt-1 text-xs text-slate-400">{template.description}</p>
              </div>
              {status.draft
                ? <ConfirmButton onConfirm={() => startFrom(template.id, template.name)} disabled={busy} className="mt-auto border-white/15! text-slate-200!" confirmLabel="Replaces draft: tap again">Start from {template.name}</ConfirmButton>
                : <Button tone="primary" onClick={() => startFrom(template.id, template.name)} disabled={busy} className="mt-auto">Start from {template.name}</Button>}
            </article>
          ))}
        </div>
      </Card>

      {status.history.length > 0 && (
        <Card title="Previously published">
          <p className="mb-3 text-sm text-slate-400">Load an older version into your draft, check it in the editor, then publish it again.</p>
          <ul className="divide-y divide-white/5">
            {status.history.map((version) => (
              <li key={version.index} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm text-slate-300">{when(version.savedAt)} <span className="text-slate-500">· {version.savedBy}</span></span>
                <ConfirmButton onConfirm={() => run(() => api('POST', '/api/design/restore', { index: version.index }), 'Loaded into your draft. Open the editor to review and publish.')} disabled={busy} className="border-white/15! text-slate-200!" confirmLabel="Replaces draft: tap again">Load into draft</ConfirmButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
