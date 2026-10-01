'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, describeError } from './api';
import { Button, Card, Field, Loading, TextArea, inputClass, useReadOnly, type Notify } from './ui';
import { ApplicationDetail } from '@/components/career/application-detail';
import { JobFacts, SkillChips } from '@/components/career/job-facts';
import { STATUS_TONES } from '@/components/career/status';
import type { JobAnalysis } from '@/lib/career/job';
import { STATUS_LABELS, type ApplicationStatus, type ApplicationSummary } from '@/lib/career/types';

type Analyzed = { url: string; text: string; source: 'structured' | 'page' | 'pasted'; hints: Record<string, unknown>; analysis: JobAnalysis; proof: Record<string, string | null> };

const BOARD: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer'];
const CLOSED: ApplicationStatus[] = ['rejected', 'withdrawn'];
const NEXT: Partial<Record<ApplicationStatus, ApplicationStatus>> = { saved: 'applied', applied: 'interview', interview: 'offer' };

const today = () => new Date().toISOString().slice(0, 10);

/** Paste a link (or the text), see what the job asks for and how your profile covers it, then save it. */
function NewApplication({ onSaved, onCancel, notify }: { onSaved: (id: number) => void; onCancel: () => void; notify: Notify }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'link' | 'text'>('link');
  const [result, setResult] = useState<Analyzed | null>(null);
  const [fields, setFields] = useState({ company: '', role: '', location: '' });

  async function analyze(event?: FormEvent) {
    event?.preventDefault();
    try {
      const found = await api<Analyzed>('POST', '/api/applications/analyze', mode === 'link' ? { url } : { text });
      setResult(found);
      setFields({ company: found.analysis.company, role: found.analysis.title, location: found.analysis.location });
    } catch (error) {
      notify(describeError(error), 'error');
      if (mode === 'link') setMode('text'); // most failures: the site blocks reading; pasting always works
    }
  }

  async function save(status: ApplicationStatus) {
    if (!result) return;
    try {
      const app = await api<{ id: number }>('POST', '/api/applications', { ...fields, url: result.url, jobDescription: result.text, status, hints: result.hints });
      notify(`Saved ${fields.role || 'the job'}${fields.company ? ` at ${fields.company}` : ''}.`);
      onSaved(app.id);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  return (
    <Card title="New application" actions={<Button onClick={onCancel}>Cancel</Button>}>
      {!result ? (
        <form onSubmit={analyze} className="space-y-3">
          <div className="flex gap-1 text-[11px] font-bold">
            {(['link', 'text'] as const).map((key) => (
              <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key}
                className={`rounded-md px-2.5 py-1 ${mode === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{key === 'link' ? 'Job link' : 'Paste the job text'}</button>
            ))}
          </div>
          {mode === 'link' ? (
            <Field label="Job link" hint="Company career pages, Greenhouse, Lever, Workday, Naukri, Instahyre… LinkedIn often blocks reading: paste the text instead.">
              <input className={inputClass} type="url" inputMode="url" placeholder="https://careers.example.com/jobs/senior-frontend-engineer" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
            </Field>
          ) : (
            <Field label="Job text" hint="The whole post: title, responsibilities and requirements.">
              <TextArea value={text} onChange={setText} rows={10} placeholder="Senior Frontend Engineer – Acme…" />
            </Field>
          )}
          <Button tone="primary" type="submit" disabled={mode === 'link' ? !/^https?:\/\/\S{3,}/.test(url.trim()) : text.trim().length < 50}>Analyse job</Button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            {result.source === 'structured' ? 'Read from the job post’s structured data.' : result.source === 'page' ? 'Read from the page text; check the details.' : 'From the text you pasted.'}
            {' '}<button type="button" className="font-bold text-cyan-300" onClick={() => setResult(null)}>Use another link or text</button>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Role"><input className={inputClass} value={fields.role} onChange={(e) => setFields({ ...fields, role: e.target.value })} /></Field>
            <Field label="Company"><input className={inputClass} value={fields.company} onChange={(e) => setFields({ ...fields, company: e.target.value })} /></Field>
            <Field label="Location"><input className={inputClass} value={fields.location} onChange={(e) => setFields({ ...fields, location: e.target.value })} /></Field>
          </div>
          <JobFacts analysis={result.analysis} />
          <SkillChips analysis={result.analysis} proof={result.proof} />
          <details className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
            <summary className="cursor-pointer font-bold text-slate-300">Job text ({result.text.length.toLocaleString()} characters)</summary>
            <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap leading-5">{result.text}</p>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" onClick={() => save('saved')}>Save to tracker</Button>
            <Button onClick={() => save('applied')}>Save as already applied</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function AppCard({ app, onOpen, onMove }: { app: ApplicationSummary; onOpen: () => void; onMove?: () => void }) {
  const readOnly = useReadOnly();
  const overdue = app.nextStepAt && app.nextStepAt < today() && !CLOSED.includes(app.status);
  return (
    <li className="group rounded-xl border border-white/10 bg-slate-950/80 transition hover:border-cyan-300/40">
      <button type="button" onClick={onOpen} className="block w-full p-3 text-left">
        <p className="truncate text-sm font-black text-white">{app.role || 'Untitled role'}</p>
        <p className="truncate text-xs text-slate-300">{app.company || '—'}{app.location ? <span className="text-slate-500"> · {app.location}</span> : null}</p>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
          <span className={`rounded px-1.5 py-0.5 ${app.resumeId ? 'bg-lime-300/10 text-lime-200' : 'bg-white/5 text-slate-500'}`}>{app.sent ? 'Resume sent' : app.resumeId ? 'Resume' : 'No resume'}</span>
          {app.hasKit && <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-cyan-200">Kit</span>}
          {app.hasInterview && <span className="rounded bg-purple-300/10 px-1.5 py-0.5 text-purple-200">Prep</span>}
          {app.workMode && <span className="rounded bg-white/5 px-1.5 py-0.5 capitalize text-slate-400">{app.workMode}</span>}
        </div>
        {app.nextStep && (
          <p className={`mt-2 truncate text-[11px] ${overdue ? 'font-bold text-red-300' : 'text-slate-400'}`}>
            {overdue ? 'Overdue: ' : 'Next: '}{app.nextStep}{app.nextStepAt ? ` · ${new Date(`${app.nextStepAt}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}
          </p>
        )}
      </button>
      {onMove && NEXT[app.status] && (
        <div className="border-t border-white/5 px-3 py-1.5">
          <button type="button" disabled={readOnly} onClick={onMove} className="text-[11px] font-bold text-cyan-300 hover:text-white disabled:opacity-40">Move to {STATUS_LABELS[NEXT[app.status]!]} →</button>
        </div>
      )}
    </li>
  );
}

/** Applications: a board of jobs from saved to offer, each with its job analysis, resume, kit and interview prep. */
export function ApplicationsTab({ notify }: { notify: Notify }) {
  const readOnly = useReadOnly();
  const [apps, setApps] = useState<ApplicationSummary[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(() => api<ApplicationSummary[]>('GET', '/api/applications').then(setApps).catch((error) => notify(describeError(error), 'error')), [notify]);
  useEffect(() => { void load(); }, [load]);

  async function move(app: ApplicationSummary, status: ApplicationStatus) {
    try {
      await api('PATCH', `/api/applications/${app.id}`, { status });
      notify(`${app.role || 'Application'} moved to ${STATUS_LABELS[status]}.${status === 'applied' && app.resumeId ? ' The resume version you sent is saved with it.' : ''}`);
      void load();
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  if (openId !== null) {
    return <ApplicationDetail id={openId} notify={notify} onBack={() => { setOpenId(null); void load(); }} />;
  }
  if (!apps) return <Loading />;
  const closed = apps.filter((a) => CLOSED.includes(a.status));
  const active = apps.filter((a) => !CLOSED.includes(a.status));
  const sent = apps.filter((a) => a.status !== 'saved').length;
  const interviews = apps.filter((a) => a.status === 'interview' || a.status === 'offer').length;

  return (
    <div className="space-y-4 sm:space-y-5">
      {adding ? (
        <NewApplication notify={notify} onCancel={() => setAdding(false)} onSaved={(id) => { setAdding(false); setOpenId(id); }} />
      ) : (
        <Card title="Applications" actions={<Button tone="primary" disabled={readOnly} onClick={() => setAdding(true)}>+ New application</Button>}>
          <p className="text-sm leading-6 text-slate-300">
            Paste a job link: see what it asks for and what you can prove, make a tailored resume, write the cover letter and messages, and prepare for the interview.
            Each application remembers the exact resume you sent.
          </p>
          {apps.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              {apps.length} job{apps.length === 1 ? '' : 's'} · {sent} applied · {interviews} interview{interviews === 1 ? '' : 's'} or offer{interviews === 1 ? '' : 's'}
            </p>
          )}
        </Card>
      )}

      {apps.length === 0 && !adding ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">No applications yet. Start with <b className="text-slate-200">+ New application</b>.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BOARD.map((status) => {
            const column = active.filter((a) => a.status === status);
            return (
              <section key={status} aria-label={STATUS_LABELS[status]} className="min-w-0 rounded-2xl border border-white/10 bg-white/[.02] p-2.5">
                <h3 className="mb-2 flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <span className={`rounded-full border px-2 py-0.5 ${STATUS_TONES[status]}`}>{STATUS_LABELS[status]}</span>
                  <span>{column.length}</span>
                </h3>
                {column.length === 0 ? <p className="px-1 py-3 text-center text-[11px] text-slate-600">—</p> : (
                  <ul className="space-y-2">
                    {column.map((app) => <AppCard key={app.id} app={app} onOpen={() => setOpenId(app.id)} onMove={() => move(app, NEXT[app.status]!)} />)}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowClosed(!showClosed)} className="text-xs font-bold text-slate-400 hover:text-white">{showClosed ? '▾' : '▸'} Closed ({closed.length})</button>
          {showClosed && <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{closed.map((app) => <AppCard key={app.id} app={app} onOpen={() => setOpenId(app.id)} />)}</ul>}
        </div>
      )}
    </div>
  );
}
