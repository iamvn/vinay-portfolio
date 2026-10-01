'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, TextInput, buttonBase, useReadOnly, type Notify } from './ui';
import { TEMPLATES, type TemplateId } from '@/lib/resume-builder/types';

type ResumeSummary = { id: number; name: string; template: TemplateId; customCode: boolean; hasJob: boolean; createdAt: string; updatedAt: string };

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const templateName = (id: string) => TEMPLATES.find((template) => template.id === id)?.name ?? id;

/** Little page drawings so the templates can be told apart at a glance. */
function TemplateSketch({ id }: { id: TemplateId }) {
  const center = id === 'classic' || id === 'compact';
  const accent = id === 'modern' ? 'bg-blue-500' : 'bg-slate-700';
  const gap = id === 'compact' ? 'gap-0.5' : id === 'minimal' ? 'gap-1.5' : 'gap-1';
  return (
    <div aria-hidden="true" className={`flex h-24 w-[4.4rem] shrink-0 flex-col rounded-sm bg-white p-1.5 shadow ${gap}`}>
      <div className={`h-1.5 w-8 rounded-sm bg-slate-800 ${center ? 'self-center' : ''}`} />
      <div className={`h-0.5 w-10 rounded-sm bg-slate-300 ${center ? 'self-center' : ''}`} />
      {[0, 1, 2].map((block) => (
        <div key={block} className={`flex flex-col ${gap}`}>
          <div className={`mt-0.5 h-0.5 w-5 rounded-sm ${accent}`} />
          {id !== 'minimal' && <div className="h-px w-full bg-slate-300" />}
          <div className="h-0.5 w-full rounded-sm bg-slate-200" />
          <div className="h-0.5 w-4/5 rounded-sm bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function NewResume({ onCreated, notify }: { onCreated: (id: number) => void; notify: Notify }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<TemplateId>('classic');
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return notify('Give the resume a name, e.g. "Frontend – Acme" or "General".', 'error');
    setBusy(true);
    try {
      const resume = await api<{ id: number }>('POST', '/api/resume-builder', { name, template });
      onCreated(resume.id);
    } catch (error) {
      notify(describeError(error), 'error');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="space-y-4">
      <Field label="Name" hint="Only you see this, e.g. the job you're applying for.">
        <TextInput value={name} onChange={setName} placeholder="Senior Frontend – Acme" />
      </Field>
      <div role="radiogroup" aria-label="Template" className="grid gap-2 sm:grid-cols-2">
        {TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={template === item.id}
            onClick={() => setTemplate(item.id)}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${template === item.id ? 'border-lime-300 bg-lime-300/[.06]' : 'border-white/10 hover:border-white/25'}`}
          >
            <TemplateSketch id={item.id} />
            <span>
              <span className="block text-sm font-black text-white">{template === item.id ? '● ' : ''}{item.name}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Your name, contact links, experience, skills and projects are filled in from the other tabs. You can change everything per resume.</p>
      <Button tone="primary" type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? 'Creating…' : 'Create resume'}</Button>
    </form>
  );
}

export function ResumeBuilderTab({ notify }: { notify: Notify }) {
  const readOnly = useReadOnly();
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    api<ResumeSummary[]>('GET', '/api/resume-builder').then(setResumes).catch((error) => notify(describeError(error), 'error'));
  }, [notify]);
  useEffect(load, [load]);

  const router = useRouter();
  const open = (id: number) => router.push(`/admin/resume-builder/${id}`);

  async function run(id: number, action: () => Promise<unknown>, message: string) {
    setBusy(id);
    try {
      await action();
      notify(message);
      load();
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title="Resume builder">
        <p className="text-sm leading-6 text-slate-300">
          Make ATS-friendly resumes from your portfolio: pick a template, adjust the content, and download a PDF. Keep one per job:
          paste the job description to see your <b>ATS score</b> and missing keywords, and let AI suggest tailored bullets.
          Power users can edit the Typst code directly (like Overleaf), or open a LaTeX copy in Overleaf.
        </p>
      </Card>

      <Card title={resumes ? `Your resumes (${resumes.length})` : 'Your resumes'}>
        {!resumes ? <Loading /> : resumes.length === 0 ? (
          <p className="text-sm text-slate-400">No resumes yet. Create your first one below.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {resumes.map((resume) => (
              <li key={resume.id} className="grid gap-3 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <div className="hidden sm:block"><TemplateSketch id={resume.template} /></div>
                <div className="min-w-0">
                  <a href={`/admin/resume-builder/${resume.id}`} className="block truncate text-base font-black text-white hover:text-lime-200">{resume.name}</a>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {templateName(resume.template)}{resume.customCode ? ' · custom code' : ''}{resume.hasJob ? ' · job description added' : ''} · edited {when(resume.updatedAt)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <Button view tone="primary" onClick={() => open(resume.id)}>{readOnly ? 'View' : 'Open editor'}</Button>
                  <a href={`/api/resume-builder/${resume.id}/download`} className={`${buttonBase} border border-white/15 text-slate-200 hover:border-cyan-300/60`}>PDF ↓</a>
                  <Button disabled={busy === resume.id} onClick={() => run(resume.id, () => api('POST', '/api/resume-builder', { name: `${resume.name} (copy)`, copyFrom: resume.id }), `Copied "${resume.name}".`)}>Duplicate</Button>
                  <ConfirmButton disabled={busy === resume.id} confirmLabel="Replace site resume?" onConfirm={() => run(resume.id, () => api('POST', `/api/resume-builder/${resume.id}/publish`), `"${resume.name}" is now the resume visitors download.`)} className="border-lime-300/30! text-lime-200!">Publish to site</ConfirmButton>
                  <ConfirmButton disabled={busy === resume.id} confirmLabel="Tap again to delete" onConfirm={() => run(resume.id, () => api('DELETE', `/api/resume-builder/${resume.id}`), `Deleted "${resume.name}".`)}>Delete</ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!readOnly && (
        <Card title="New resume">
          <NewResume notify={notify} onCreated={open} />
        </Card>
      )}
    </div>
  );
}
