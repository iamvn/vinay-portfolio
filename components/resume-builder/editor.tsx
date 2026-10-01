'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, describeError } from '@/components/admin/api';
import { Button, ConfirmButton, ReadOnlyFieldset, ReadOnlyProvider, buttonBase, type Notify } from '@/components/admin/ui';
import { atsReport } from '@/lib/resume-builder/ats';
import { toLatex } from '@/lib/resume-builder/latex';
import { patchCustomCode, toTypst } from '@/lib/resume-builder/typst';
import { TEMPLATES, type ResumeData, type ResumeDocument, type TemplateId } from '@/lib/resume-builder/types';
import { AtsPanel, ScoreRing } from './ats-panel';
import { CodePanel, type Problem } from './code-panel';
import { ContentForm } from './content-form';
import { TailorPanel } from './tailor-panel';
import type { EvidenceItem } from '@/lib/career/evidence';

type Tab = 'content' | 'code' | 'ats' | 'ai';
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type Snapshot = { data: ResumeData; code: string | null };
type CompileResponse = { ok: true; pages: number; svg: string; warnings: Problem[]; ms: number } | { ok: false; errors: Problem[]; ms?: number };

const AUTOSAVE_MS = 1000;
const PREVIEW_MS = 350;

/** Opens the LaTeX version in Overleaf (their documented "open a snippet" form). */
function openInOverleaf(tex: string, name: string) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://www.overleaf.com/docs';
  form.target = '_blank';
  for (const [key, value] of Object.entries({ encoded_snip: encodeURIComponent(tex), snip_name: `${name}.tex`, engine: 'pdflatex' })) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function ResumeEditor({ initial, readOnly, evidence = [] }: { initial: ResumeDocument; readOnly: boolean; evidence?: EvidenceItem[] }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [template, setTemplate] = useState<TemplateId>(initial.template);
  const [data, setData] = useState<ResumeData>(initial.data);
  const [code, setCode] = useState<string | null>(initial.code);
  const [jobDescription, setJobDescription] = useState(initial.jobDescription);
  const [tab, setTab] = useState<Tab>('content');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [save, setSave] = useState<SaveState>('saved');
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: 'success' | 'error' }[]>([]);
  const [preview, setPreview] = useState<{ url: string | null; pages: number | null; ratio: number; problems: Problem[]; compiling: boolean; stale: boolean; ms: number | null }>(
    { url: null, pages: null, ratio: 842 / 596, problems: [], compiling: true, stale: false, ms: null },
  );
  const [canUndo, setCanUndo] = useState(false);

  const notify: Notify = useCallback((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === 'error' ? 8000 : 3500);
  }, []);

  const generated = useMemo(() => toTypst(data, template, name), [data, template, name]);
  const source = code ?? generated;
  const report = useMemo(() => atsReport({ data, code, jobDescription, pages: preview.pages }), [data, code, jobDescription, preview.pages]);

  // ---------- undo (content and code changes, grouped per second) ----------
  const history = useRef<Snapshot[]>([]);
  const lastPush = useRef(0);
  const current = useRef<Snapshot>({ data, code });
  useEffect(() => { current.current = { data, code }; }, [data, code]);
  const remember = useCallback(() => {
    const now = Date.now();
    if (now - lastPush.current > 1000) {
      history.current = [...history.current.slice(-49), current.current];
      setCanUndo(true);
    }
    lastPush.current = now;
  }, []);
  function undo() {
    const previous = history.current.pop();
    if (!previous) return;
    lastPush.current = 0;
    setData(previous.data);
    setCode(previous.code);
    setCanUndo(history.current.length > 0);
    markDirty();
  }

  // ---------- autosave ----------
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ name, template, data, code, jobDescription });
  useEffect(() => { latest.current = { name, template, data, code, jobDescription }; }, [name, template, data, code, jobDescription]);
  const dirty = useRef(false);

  const saveNow = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (readOnly || !dirty.current) return true;
    dirty.current = false;
    setSave('saving');
    try {
      const body = { ...latest.current, name: latest.current.name.trim() || 'Untitled resume' };
      await api('PUT', `/api/resume-builder/${initial.id}`, body);
      setSave(dirty.current ? 'dirty' : 'saved');
      return true;
    } catch (error) {
      dirty.current = true;
      setSave('error');
      notify(describeError(error), 'error');
      return false;
    }
  }, [initial.id, notify, readOnly]);

  const markDirty = useCallback(() => {
    if (readOnly) return;
    dirty.current = true;
    setSave('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, AUTOSAVE_MS);
  }, [readOnly, saveNow]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  /**
   * Every content change (Content form, ATS fixes, AI suggestions, reload). With custom code, the sections it
   * touches are rewritten in the code too (everything else in the code is kept), so it shows in the PDF right away.
   */
  const settings = useRef({ template, name });
  useEffect(() => { settings.current = { template, name }; }, [template, name]);
  const applyContent = useCallback((change: (data: ResumeData) => ResumeData) => {
    if (readOnly) return;
    remember();
    const { data: before, code: currentCode } = current.current;
    const after = change(before);
    current.current = { data: after, code: currentCode };
    setData(after);
    if (currentCode !== null) {
      const patched = patchCustomCode(currentCode, before, after, settings.current.template, settings.current.name);
      current.current = { data: after, code: patched.code };
      setCode(patched.code);
      if (!patched.ok) notify('Saved to the form, but part of your custom code could not be updated (a section was renamed?). Use “Regenerate from form” in the Code tab.', 'error');
    }
    markDirty();
  }, [markDirty, notify, readOnly, remember]);

  // ---------- live preview ----------
  const sequence = useRef(0);
  useEffect(() => {
    const id = ++sequence.current;
    const handle = setTimeout(async () => {
      setPreview((p) => ({ ...p, compiling: true }));
      try {
        const result = await api<CompileResponse>('POST', '/api/resume-builder/compile', { source });
        if (id !== sequence.current) return;
        if (result.ok) {
          const url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }));
          // Typst draws all pages one under another in a single SVG; work out one page's shape to show them as cards.
          const box = result.svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
          const ratio = box ? Number(box[2]) / result.pages / Number(box[1]) : 842 / 596;
          setPreview((p) => {
            if (p.url) URL.revokeObjectURL(p.url);
            return { url, pages: result.pages, ratio, problems: result.warnings, compiling: false, stale: false, ms: result.ms };
          });
        } else {
          setPreview((p) => ({ ...p, problems: result.errors, compiling: false, stale: true }));
        }
      } catch (error) {
        if (id === sequence.current) setPreview((p) => ({ ...p, compiling: false, stale: true, problems: [{ message: describeError(error), line: null, severity: 'error' }] }));
      }
    }, PREVIEW_MS);
    return () => clearTimeout(handle);
  }, [source]);

  // ---------- actions ----------
  async function download(format: 'pdf' | 'tex' | 'typ') {
    if (!(await saveNow())) return;
    const link = document.createElement('a');
    link.href = `/api/resume-builder/${initial.id}/download?format=${format}`;
    link.download = '';
    link.click();
  }

  async function publish() {
    if (!(await saveNow())) return;
    try {
      const result = await api<{ fileName: string; pages: number }>('POST', `/api/resume-builder/${initial.id}/publish`);
      notify(`Published: visitors now download ${result.fileName} (${result.pages} page${result.pages === 1 ? '' : 's'}).`);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  async function reloadFromPortfolio() {
    try {
      const fresh = await api<ResumeData>('GET', '/api/resume-builder/from-portfolio', undefined, { fresh: true });
      applyContent((d) => ({ ...fresh, education: d.education, extras: d.extras, layout: { ...fresh.layout, order: d.layout.order, hidden: d.layout.hidden, paper: d.layout.paper } }));
      notify('Content reloaded from the portfolio. Undo (top bar) brings back your edits.');
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  const saveLabel = readOnly ? 'View only' : { saved: 'All changes saved', dirty: 'Unsaved…', saving: 'Saving…', error: 'Not saved — retrying on next change' }[save];
  const tabs: [Tab, string][] = [['content', 'Content'], ['code', 'Code'], ['ats', `ATS score · ${report.score}`], ['ai', 'Tailor with AI']];
  const errors = preview.problems.filter((p) => p.severity === 'error');
  const small = `${buttonBase} border border-white/15 text-slate-200 hover:border-cyan-300/60`;

  return (
    <ReadOnlyProvider value={readOnly}>
      <div className="admin-shell flex h-dvh flex-col bg-[#030609] text-slate-100">
        {/* Top bar */}
        <header className="shrink-0 border-b border-white/10 bg-[#030609] px-3 pt-[max(.5rem,env(safe-area-inset-top))] pb-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <a href="/admin#builder" aria-label="Back to resumes" onClick={async (event) => { event.preventDefault(); if (await saveNow()) router.push('/admin#builder'); }} className={`${small} px-3`}>←<span className="hidden sm:inline">&nbsp;Resumes</span></a>
            <input aria-label="Resume name" value={name} readOnly={readOnly} onChange={(e) => { setName(e.target.value); markDirty(); }}
              className="order-first w-full min-w-0 rounded-lg border border-white/10 bg-transparent px-2 py-2 text-base font-black text-white outline-none hover:border-white/20 focus:border-lime-300/60 sm:order-none sm:w-auto sm:flex-1 sm:border-transparent" />
            <span role="status" aria-live="polite" className={`hidden text-xs md:inline ${save === 'error' ? 'text-red-300' : save === 'saved' ? 'text-slate-500' : 'text-yellow-300'}`}>{saveLabel}</span>
            {!readOnly && <Button onClick={undo} disabled={!canUndo} label="Undo">↶ Undo</Button>}
            <details className="relative">
              <summary className={`${small} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Download ▾</summary>
              <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-xl border border-white/15 bg-slate-950 p-1 shadow-2xl">
                {[
                  ['PDF', 'Ready to send / upload to job portals', () => download('pdf')],
                  ['LaTeX (.tex)', 'Same content as LaTeX source', () => download('tex')],
                  ['Open in Overleaf ↗', 'Edit the LaTeX version on overleaf.com', () => openInOverleaf(toLatex(data, template), name)],
                  ['Typst code (.typ)', 'The exact code behind the preview', () => download('typ')],
                ].map(([label, hint, action]) => (
                  <button key={label as string} type="button" onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open = false; (action as () => void)(); }}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">
                    <span className="block text-sm font-bold text-white">{label as string}</span>
                    <span className="block text-[11px] text-slate-500">{hint as string}</span>
                  </button>
                ))}
                {code !== null && <p className="px-3 pb-2 pt-1 text-[11px] text-yellow-200/80">LaTeX/Overleaf use the form content, not your custom code.</p>}
              </div>
            </details>
            {!readOnly && <ConfirmButton onConfirm={publish} confirmLabel="Replace site resume?" className="border-lime-300/30! text-lime-200!">Publish<span className="hidden sm:inline">&nbsp;to site</span></ConfirmButton>}
          </div>
          <div className="mt-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">Template</span>
            {TEMPLATES.map((item) => (
              <button key={item.id} type="button" disabled={readOnly} title={item.description}
                onClick={() => { setTemplate(item.id); markDirty(); if (code !== null) notify('Custom code is in use: the new template applies after “Regenerate from form” (Code tab).'); }}
                className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-black uppercase tracking-wide transition ${template === item.id ? 'bg-lime-300 text-black' : 'border border-white/10 text-slate-300 hover:border-white/30'}`}>
                {item.name}
              </button>
            ))}
            <span className="ml-auto shrink-0 text-xs text-slate-500 md:hidden">{saveLabel}</span>
          </div>
          {/* Phone: switch between editing and the preview */}
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-white/[.04] p-1 lg:hidden" role="tablist" aria-label="View">
            {(['edit', 'preview'] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
                className={`min-h-10 rounded-md text-xs font-black uppercase tracking-wide ${view === id ? 'bg-lime-300 text-black' : 'text-slate-300'}`}>
                {id === 'edit' ? 'Edit' : `Preview${preview.pages ? ` · ${preview.pages}p` : ''}`}
              </button>
            ))}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: editing */}
          <section className={`min-h-0 flex-col border-white/10 lg:flex lg:border-r ${view === 'edit' ? 'flex' : 'hidden'}`}>
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 [scrollbar-width:none]" aria-label="Editor sections">
              {tabs.map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                  className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-black uppercase tracking-wide ${tab === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4">
              {tab === 'content' && (
                <ReadOnlyFieldset>
                  {code !== null && (
                    <p className="mb-3 rounded-xl border border-yellow-300/30 bg-yellow-300/[.06] px-4 py-3 text-xs text-yellow-100">
                      This resume uses <b>custom code</b>. Editing a section here rewrites that section in your code; your other code edits (fonts, spacing, layout) are kept. “Regenerate from form” in the Code tab rebuilds all of it.
                    </p>
                  )}
                  <ContentForm data={data} update={applyContent} onReload={reloadFromPortfolio} />
                </ReadOnlyFieldset>
              )}
              {tab === 'code' && (
                <CodePanel code={source} custom={code !== null} problems={preview.problems}
                  onChange={(next) => { if (readOnly) return; remember(); setCode(next); markDirty(); }}
                  onRegenerate={() => { remember(); setCode(null); markDirty(); notify('Code regenerated from the form.'); }} />
              )}
              {tab === 'ats' && (
                <AtsPanel report={report} jobDescription={jobDescription} data={data} update={applyContent} pages={preview.pages} notify={notify} customCode={code !== null} profile={evidence}
                  onJobDescription={(value) => { if (readOnly) return; setJobDescription(value); markDirty(); }} />
              )}
              {tab === 'ai' && <TailorPanel data={data} jobDescription={jobDescription} update={applyContent} notify={notify} customCode={code !== null} profile={evidence} />}
            </div>
          </section>

          {/* Right: live preview */}
          <section className={`min-h-0 flex-col bg-slate-800/40 lg:flex ${view === 'preview' ? 'flex' : 'hidden'}`} aria-label="Preview">
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2 text-xs text-slate-400">
              <ScoreRing score={report.score} size={34} />
              <span className="flex-1">
                {preview.pages ? `${preview.pages} page${preview.pages === 1 ? '' : 's'}` : '…'}
                {preview.compiling ? ' · updating…' : preview.ms !== null ? ` · compiled in ${preview.ms} ms` : ''}
              </span>
              {errors.length > 0 && (
                <button type="button" onClick={() => { setTab('code'); setView('edit'); }} className="rounded-md bg-red-500/15 px-2 py-1 font-bold text-red-200">
                  {errors.length} error{errors.length === 1 ? '' : 's'} · showing last good version
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
              {preview.url ? (
                // One card per page (cut from the single SVG), so page breaks are visible like in the PDF.
                <div className={`mx-auto flex w-full max-w-[820px] flex-col gap-5 transition ${preview.stale ? 'opacity-60' : ''}`}>
                  {Array.from({ length: preview.pages ?? 1 }, (_, page) => (
                    <figure key={page} className="m-0">
                      <div className="relative w-full overflow-hidden bg-white shadow-2xl" style={{ aspectRatio: `1 / ${preview.ratio}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview.url!} alt={page === 0 ? 'Resume preview' : `Page ${page + 1}`} draggable={false}
                          className="absolute left-0 w-full max-w-none select-none"
                          style={{ top: `${-page * 100}%`, height: `${(preview.pages ?? 1) * 100}%` }} />
                      </div>
                      {(preview.pages ?? 1) > 1 && <figcaption className="mt-1.5 text-center text-[11px] text-slate-500">Page {page + 1} of {preview.pages}</figcaption>}
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="py-20 text-center text-sm text-slate-400">{errors.length ? 'Fix the code errors to see the preview.' : 'Building preview…'}</p>
              )}
            </div>
          </section>
        </div>

        <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:max-w-sm" aria-live="polite">
          {toasts.map((toast) => (
            <button key={toast.id} type="button" onClick={() => setToasts((all) => all.filter((t) => t.id !== toast.id))}
              className={`pointer-events-auto rounded-xl border px-4 py-3 text-left text-sm shadow-2xl ${toast.tone === 'error' ? 'border-red-400/40 bg-red-950/95 text-red-100' : 'border-lime-300/40 bg-slate-950/95 text-lime-100'}`}>
              {toast.message}
            </button>
          ))}
        </div>
      </div>
    </ReadOnlyProvider>
  );
}
