'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, buttonBase, inputClass, type Notify, useReadOnly } from './ui';
import { THEME_PRESETS } from '@/lib/design/theme';
import { AiTemplateCard } from './ai-template';

type Status = {
  draft: { savedAt: string; savedBy: string; template?: string } | null;
  published: { savedAt: string; savedBy: string } | null;
  unpublishedChanges: boolean;
  history: { index: number; savedAt: string; savedBy: string }[];
  templates: { id: string; name: string; description: string }[];
  /** The site's own templates (Create a template with AI). */
  customTemplates: OwnTemplate[];
  /** Templates people on every site published (Your templates → Publish), credited to their author. */
  sharedTemplates: { id: string; name: string; description: string; theme: string; palette?: Record<string, string>; blocks: number; author: string; siteName: string; createdAt: string; mine: boolean; canRemove: boolean }[];
  /** Whether this site has "Create a template with AI" (the platform owner turns it on). */
  aiTemplates: boolean;
};

type OwnTemplate = { id: string; name: string; description: string; theme: string; palette?: Record<string, string>; blocks: number; createdAt: string; publishedAt: string | null };
const day = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** Tiny picture of each template, drawn with its theme colors. */
const THUMBS: Record<string, { theme: keyof typeof THEME_PRESETS; layout: 'arcade' | 'centered' | 'split' | 'blank' | 'classic' | 'book' | 'cover' }> = {
  classic: { theme: 'arcade', layout: 'classic' },
  arcade: { theme: 'arcade', layout: 'arcade' },
  minimal: { theme: 'paper', layout: 'centered' },
  studio: { theme: 'clean', layout: 'split' },
  blank: { theme: 'clean', layout: 'blank' },
  'project-classic': { theme: 'arcade', layout: 'arcade' },
  'project-case-study': { theme: 'clean', layout: 'cover' },
  'project-pdf': { theme: 'paper', layout: 'book' },
  'project-visual': { theme: 'mono', layout: 'cover' },
  'project-blank': { theme: 'clean', layout: 'blank' },
};

function Thumb({ id, customTheme, palette }: { id: string; customTheme?: string; palette?: Record<string, string> }) {
  const { theme, layout } = customTheme !== undefined
    ? { theme: customTheme in THEME_PRESETS ? customTheme : 'clean', layout: 'arcade' as const }
    : THUMBS[id] ?? THUMBS.blank;
  // An AI template's own colors win over its preset's.
  const t = { ...THEME_PRESETS[theme], ...(palette ?? {}) };
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
          {layout === 'book' && <div className="grid justify-items-center gap-1.5">{bar('45%', t.text, 7)}{bar('30%')}<span className="mt-1 flex w-4/5 gap-px rounded p-1" style={{ background: t.surface2 }}><span className="block h-12 flex-1 rounded-sm bg-white/90" /><span className="block h-12 flex-1 rounded-sm bg-white/80" /></span></div>}
          {layout === 'cover' && <div className="grid gap-1.5"><span className="block h-10 rounded" style={{ background: t.surface2 }} />{bar('55%', t.text, 7)}{bar('80%')}<span className="flex gap-1">{bar('16%', t.accent, 6)}{bar('16%', t.line, 6)}</span></div>}
          {layout === 'split' && <div className="grid grid-cols-[1.3fr_1fr] items-center gap-2"><div className="grid gap-1.5">{bar('40%', t.accent)}{bar('85%', t.text, 7)}{bar('60%')}{bar('30%', t.accent, 6)}</div><span className="block h-14 rounded" style={{ background: t.surface2 }} /></div>}
          <div className="grid grid-cols-3 gap-1.5">{card}{card}{card}</div>
        </div>
      )}
    </div>
  );
}

type ProjectDesign = { slug: string; title: string; published: boolean; own: 'live' | 'draft' | null };
type Page = 'home' | 'project';
const PAGES: Record<Page, { label: string; query: string; builtIn: string; liveText: string; editorHref: string }> = {
  home: { label: 'Homepage', query: '', builtIn: 'classic design', liveText: 'The homepage now shows your design.', editorHref: '/admin/design' },
  project: { label: 'Project pages', query: '?page=project', builtIn: 'project page', liveText: 'Every project page now uses your design (except projects with their own).', editorHref: '/admin/design?page=project' },
};

export function DesignTab({ notify }: { notify: Notify }) {
  const readOnly = useReadOnly();
  const [page, setPage] = useState<Page>('home');
  const [loaded, setLoaded] = useState<{ page: Page; status: Status } | null>(null);
  const [projects, setProjects] = useState<ProjectDesign[] | null>(null);
  const [busy, setBusy] = useState(false);
  const P = PAGES[page];
  const status = loaded?.page === page ? loaded.status : null;

  const load = useCallback(() => {
    const current = page;
    api<Status>('GET', `/api/design${PAGES[current].query}`).then((s) => setLoaded({ page: current, status: s })).catch((error) => notify(describeError(error), 'error'));
    if (current === 'project') api<ProjectDesign[]>('GET', '/api/design/projects').then(setProjects).catch((error) => notify(describeError(error), 'error'));
  }, [notify, page]);
  useEffect(load, [load]);
  const withPage = (path: string) => `${path}${P.query}`;

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

  const switcher = (
    <div role="tablist" aria-label="Which page to design" className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
      {(Object.keys(PAGES) as Page[]).map((key) => (
        <button key={key} type="button" role="tab" aria-selected={page === key} onClick={() => setPage(key)}
          className={`min-h-10 rounded-lg px-4 text-xs font-black uppercase tracking-wide ${page === key ? 'bg-lime-300 text-black' : 'text-slate-300 hover:text-white'}`}>{PAGES[key].label}</button>
      ))}
    </div>
  );
  if (!status) return <div className="space-y-4">{switcher}<Loading /></div>;
  const live = status.published;
  const startFrom = (id: string, name: string) =>
    // A full page load: the editor's preview frame copies the page's stylesheets, which a client-side
    // navigation may still be swapping in.
    run(() => api('POST', withPage('/api/design/template'), { id }), `${name} loaded into your draft. Opening the editor…`, () => window.location.assign(P.editorHref));

  return (
    <div className="space-y-4 sm:space-y-5">
      {switcher}
      <Card
        title={page === 'home' ? 'Homepage design' : 'Project page design (all projects)'}
        actions={<span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${live ? 'bg-lime-300/15 text-lime-200' : 'bg-white/5 text-slate-300'}`}>{live ? '● Custom design live' : page === 'home' ? '● Classic design live' : '● Built-in page live'}</span>}
      >
        <p className="text-sm text-slate-300">
          {live
            ? <>Visitors see your custom design, published {when(live.savedAt)}{live.savedBy ? <> by {live.savedBy}</> : ' (the starting design this site was created with)'}.</>
            : page === 'home'
              ? <>Visitors see the built-in classic design. Open the editor (it starts from an editable copy of it) or pick a template, then press <b>Publish</b>.</>
              : <>Project pages use the built-in layout. Design them once here: “This project” blocks fill in each project’s own title, images, PDF and links.</>}
        </p>
        {status.draft && (
          <p className="mt-1 text-xs text-slate-500">
            Draft last saved {when(status.draft.savedAt)}{status.unpublishedChanges ? ' · has changes that are not live yet' : ' · same as live'}.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <a href={P.editorHref} className={`${buttonBase} col-span-2 bg-lime-300 text-black hover:bg-lime-200 sm:col-span-1`}>{readOnly ? 'View design editor' : 'Open design editor'}</a>
          {status.draft && <a href={withPage('/admin/design/preview')} target="_blank" rel="noreferrer" className={`${buttonBase} border border-white/15 text-slate-200 hover:border-cyan-300/60`}>Preview draft ↗</a>}
          {status.draft && status.unpublishedChanges && <Button onClick={() => run(() => api('POST', withPage('/api/design/publish'), {}), `Published. ${P.liveText}`)} disabled={busy}>Publish draft</Button>}
          {status.draft && status.unpublishedChanges && <ConfirmButton onConfirm={() => run(() => api('DELETE', withPage('/api/design')), live ? 'Draft reverted to the live design.' : `Draft discarded. The editor starts from the built-in ${P.builtIn} again.`)} disabled={busy} confirmLabel="Tap again to discard" className="border-white/15! text-slate-200!">↺ Revert draft to live</ConfirmButton>}
          {live && <ConfirmButton onConfirm={() => run(() => api('DELETE', withPage('/api/design/publish')), `Switched back to the built-in ${P.builtIn}. Your draft is kept.`)} disabled={busy} confirmLabel="Tap again to switch">Use built-in {page === 'home' ? 'classic' : 'page'}</ConfirmButton>}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          The editor works best on a laptop or tablet. Your name, projects, experience, skills and site text still come from the other tabs; a design only controls layout and style.
        </p>
      </Card>

      {page === 'project' && (
        <Card title="Each project">
          <p className="mb-3 text-sm text-slate-400">Every project uses the design above. Give one project its own design when it needs something different (it starts as a copy of the shared design).</p>
          {!projects ? <Loading /> : projects.length === 0 ? <p className="text-sm text-slate-500">No projects yet: add them in Admin → Projects.</p> : (
            <ul className="divide-y divide-white/5">
              {projects.map((project) => (
                <li key={project.slug} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{project.title}{!project.published && <span className="ml-2 text-[10px] font-black uppercase text-slate-500">Draft</span>}</span>
                    <span className="text-xs text-slate-400">{project.own === 'live' ? 'Own design (live)' : project.own === 'draft' ? 'Own design in progress · shared design is live' : 'Uses the shared design'}</span>
                  </span>
                  <a href={`/projects/${project.slug}`} target="_blank" rel="noreferrer" className={`${buttonBase} border border-white/15 text-slate-200 hover:border-cyan-300/60`}>View ↗</a>
                  <a href={`/admin/design?page=project&project=${encodeURIComponent(project.slug)}`} className={`${buttonBase} border border-white/15 text-slate-200 hover:border-lime-300/60`}>{project.own ? 'Edit its design' : readOnly ? 'View' : 'Give it its own design'}</a>
                  {project.own && !readOnly && (
                    <ConfirmButton onConfirm={() => run(() => api('DELETE', `/api/design/publish?page=project&project=${encodeURIComponent(project.slug)}&forget=1`), `${project.title} uses the shared design again.`)} disabled={busy} confirmLabel="Deletes its design: tap again" className="border-white/15! text-slate-200!">Use shared design</ConfirmButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

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
        {(status.sharedTemplates ?? []).length > 0 && (
          <>
            <h4 className="mb-3 mt-6 text-[11px] font-black uppercase tracking-[.2em] text-lime-300/80">Shared by people on this platform ({status.sharedTemplates.length})</h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {status.sharedTemplates.map((template) => (
                <article key={template.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="relative">
                    <Thumb id={template.id} customTheme={template.theme} palette={template.palette} />
                    <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-black uppercase text-cyan-200">Shared</span>
                  </div>
                  <div>
                    <h4 className="font-black text-white">{template.name}{status.draft?.template === template.id && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400">In draft</span>}</h4>
                    <p className="mt-0.5 text-xs font-bold text-cyan-200">by {template.author}{template.mine && ' (you)'}</p>
                    {template.description && <p className="mt-1 line-clamp-3 text-xs text-slate-400">{template.description}</p>}
                    <p className="mt-1 text-[11px] text-slate-500">{template.blocks} blocks · shared {day(template.createdAt)}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {status.draft
                      ? <ConfirmButton onConfirm={() => startFrom(template.id, template.name)} disabled={busy} className="flex-1 border-white/15! text-slate-200!" confirmLabel="Replaces draft: tap again">Start from it</ConfirmButton>
                      : <Button tone="primary" onClick={() => startFrom(template.id, template.name)} disabled={busy} className="flex-1">Start from it</Button>}
                    {template.canRemove && !readOnly && (
                      <ConfirmButton onConfirm={() => run(() => api('DELETE', `/api/design/shared/${template.id}`), `“${template.name}” is no longer shared.`)} disabled={busy}
                        confirmLabel={template.mine ? 'Unpublish? Tap again' : 'Remove for everyone? Tap again'}>{template.mine ? 'Unpublish' : 'Remove'}</ConfirmButton>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </Card>

      {!readOnly && status.aiTemplates && (
        <AiTemplateCard
          query={P.query}
          notify={notify}
          hasDraft={Boolean(status.draft)}
          onSaved={load}
          onUse={(template) => startFrom(template.id, template.name)}
        />
      )}

      {(status.customTemplates ?? []).length > 0 && (
        <Card title="Your templates">
          <p className="mb-4 text-sm text-slate-400">Templates made with AI for {page === 'home' ? 'the homepage' : 'project pages'}. Starting from one replaces your current draft. <b className="text-slate-300">Publish</b> one to add it to everyone’s Templates, with your name on its card.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {status.customTemplates.map((template) => (
              <OwnTemplateCard key={`${template.id}-${template.name}-${template.publishedAt}`} template={template} inDraft={status.draft?.template === template.id}
                hasDraft={Boolean(status.draft)} busy={busy} readOnly={readOnly} run={run} onUse={() => startFrom(template.id, template.name)} />
            ))}
          </div>
        </Card>
      )}

      {status.history.length > 0 && (
        <Card title="Previously published">
          <p className="mb-3 text-sm text-slate-400">Load an older version into your draft, check it in the editor, then publish it again.</p>
          <ul className="divide-y divide-white/5">
            {status.history.map((version) => (
              <li key={version.index} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm text-slate-300">{when(version.savedAt)} {version.savedBy && <span className="text-slate-500">· {version.savedBy}</span>}</span>
                <ConfirmButton onConfirm={() => run(() => api('POST', withPage('/api/design/restore'), { index: version.index }), 'Loaded into your draft. Open the editor to review and publish.')} disabled={busy} className="border-white/15! text-slate-200!" confirmLabel="Replaces draft: tap again">Load into draft</ConfirmButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** One of this site's own templates: use, rename, publish for everyone (or unpublish), delete. */
function OwnTemplateCard({ template, inDraft, hasDraft, busy, readOnly, run, onUse }: {
  template: OwnTemplate; inDraft: boolean; hasDraft: boolean; busy: boolean; readOnly: boolean;
  run: (action: () => Promise<unknown>, message: string) => Promise<void>; onUse: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const published = Boolean(template.publishedAt);
  const save = () => run(() => api('PATCH', `/api/design/templates/${template.id}`, { name: name.trim(), description: description.trim() }), `Renamed to “${name.trim()}”.`);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="relative">
        <Thumb id={template.id} customTheme={template.theme} palette={template.palette} />
        <span className="absolute right-2 top-2 flex gap-1">
          {published && <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-black uppercase text-cyan-200">Published</span>}
          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-black uppercase text-lime-200">AI</span>
        </span>
      </div>
      {editing ? (
        <div className="grid gap-2">
          <input className={inputClass} aria-label={`New name for ${template.name}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <textarea className={inputClass} aria-label={`New description for ${template.name}`} rows={3} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            <Button tone="primary" disabled={busy || !name.trim()} onClick={save}>Save</Button>
            <Button onClick={() => { setEditing(false); setName(template.name); setDescription(template.description); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div>
          <h4 className="font-black text-white">{template.name}{inDraft && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400">In draft</span>}</h4>
          {template.description && <p className="mt-1 line-clamp-3 text-xs text-slate-400">{template.description}</p>}
          <p className="mt-1 text-[11px] text-slate-500">{template.blocks} blocks · made {day(template.createdAt)}{published && ` · shared ${day(template.publishedAt!)}`}</p>
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        {hasDraft
          ? <ConfirmButton onConfirm={onUse} disabled={busy} className="flex-1 border-white/15! text-slate-200!" confirmLabel="Replaces draft: tap again">Start from it</ConfirmButton>
          : <Button tone="primary" onClick={onUse} disabled={busy} className="flex-1">Start from it</Button>}
        {!readOnly && !editing && <Button onClick={() => setEditing(true)} disabled={busy}>Rename</Button>}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-2">
          {published ? (
            <>
              <Button onClick={() => run(() => api('POST', `/api/design/templates/${template.id}/share`), 'Shared copy updated.')} disabled={busy}>Update shared copy</Button>
              <ConfirmButton onConfirm={() => run(() => api('DELETE', `/api/design/templates/${template.id}/share`), `“${template.name}” is no longer shared.`)} disabled={busy} confirmLabel="Unpublish? Tap again">Unpublish</ConfirmButton>
            </>
          ) : (
            <ConfirmButton onConfirm={() => run(() => api('POST', `/api/design/templates/${template.id}/share`), `Published. “${template.name}” is in everyone’s Templates now, with your name on it.`)} disabled={busy}
              confirmLabel="Share with every site? Tap again" className="border-cyan-300/40! text-cyan-200!">Publish for everyone</ConfirmButton>
          )}
          <ConfirmButton onConfirm={() => run(() => api('DELETE', `/api/design/templates/${template.id}`), `“${template.name}” deleted.`)} disabled={busy} confirmLabel="Delete? Tap again">Delete</ConfirmButton>
        </div>
      )}
    </article>
  );
}
