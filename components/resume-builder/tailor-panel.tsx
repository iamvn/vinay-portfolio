'use client';

import { useState } from 'react';
import { api, describeError } from '@/components/admin/api';
import { Button, useReadOnly, type Notify } from '@/components/admin/ui';
import type { TailorSuggestion } from '@/lib/resume-builder/tailor';
import type { ResumeData } from '@/lib/resume-builder/types';

type Update = (change: (data: ResumeData) => ResumeData) => void;

function Compare({ before, after, onApply, applied }: { before: string[]; after: string[]; onApply: () => void; applied: boolean }) {
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Now</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">{before.map((line, i) => <li key={i}>{line}</li>)}</ul>
      </div>
      <div className="rounded-lg border border-lime-300/25 bg-lime-300/[.04] p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-lime-300">Suggested</p>
          <Button tone={applied ? 'ghost' : 'primary'} className="min-h-8 px-2.5 py-1" disabled={applied} onClick={onApply}>{applied ? 'Applied ✓' : 'Apply'}</Button>
        </div>
        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-100">{after.map((line, i) => <li key={i}>{line}</li>)}</ul>
      </div>
    </div>
  );
}

/** "Tailor with AI": suggestions for one job description, applied piece by piece (or all at once). */
export function TailorPanel({ data, jobDescription, update, notify, customCode }: {
  data: ResumeData; jobDescription: string; update: Update; notify: Notify; customCode: boolean;
}) {
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ suggestion: TailorSuggestion; provider: string } | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const mark = (key: string) => setApplied((current) => new Set(current).add(key));

  async function run() {
    if (jobDescription.trim().length < 50) return notify('Paste the job description in the ATS score tab first.', 'error');
    setBusy(true);
    setResult(null);
    setApplied(new Set());
    try {
      setResult(await api('POST', '/api/resume-builder/tailor', { data, jobDescription }));
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const s = result?.suggestion;
  const experience = (s?.experience ?? []).filter((item) => data.experience[item.index] && item.bullets.length);

  const apply = {
    headline: () => { update((d) => ({ ...d, basics: { ...d.basics, headline: s!.headline } })); mark('headline'); },
    summary: () => { update((d) => ({ ...d, basics: { ...d.basics, summary: s!.summary } })); mark('summary'); },
    role: (index: number, bullets: string[]) => { update((d) => ({ ...d, experience: d.experience.map((e, i) => (i === index ? { ...e, bullets } : e)) })); mark(`role-${index}`); },
    skills: () => { update((d) => ({ ...d, skills: s!.skills })); mark('skills'); },
  };
  function applyAll() {
    if (!s) return;
    if (s.headline) apply.headline();
    if (s.summary) apply.summary();
    for (const item of experience) apply.role(item.index, item.bullets);
    if (s.skills.length) apply.skills();
    notify('All suggestions applied. Check the preview; Undo in the top bar reverts changes.');
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
        <p>
          AI rewrites your summary and bullets for the job description (from the ATS score tab), using the job&apos;s wording.
          It is told <b>never to invent</b> experience, numbers or skills; review every suggestion before applying.
        </p>
        <p className="mt-1 text-xs text-slate-500">Uses the providers from Admin → AI assistant.</p>
        {customCode && <p className="mt-2 text-xs text-yellow-200">This resume uses custom code: applying a suggestion rewrites that section of your code; your other code edits are kept.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button tone="primary" onClick={run} disabled={busy || readOnly}>{busy ? 'Thinking… (up to a minute)' : result ? 'Suggest again' : '✨ Tailor to this job'}</Button>
          {s && <Button onClick={applyAll} disabled={readOnly}>Apply all</Button>}
        </div>
      </div>

      {s && (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-500">Suggestions from {result?.provider}.</p>
          {s.headline && s.headline !== data.basics.headline && (
            <section className="space-y-2"><h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">Headline</h3>
              <Compare before={[data.basics.headline || '—']} after={[s.headline]} applied={applied.has('headline')} onApply={apply.headline} /></section>
          )}
          {s.summary && (
            <section className="space-y-2"><h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">Summary</h3>
              <Compare before={[data.basics.summary || '—']} after={[s.summary]} applied={applied.has('summary')} onApply={apply.summary} /></section>
          )}
          {experience.map((item) => (
            <section key={item.index} className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">{data.experience[item.index].role} · {data.experience[item.index].company}</h3>
              <Compare before={data.experience[item.index].bullets} after={item.bullets} applied={applied.has(`role-${item.index}`)} onApply={() => apply.role(item.index, item.bullets)} />
            </section>
          ))}
          {s.skills.length > 0 && (
            <section className="space-y-2"><h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">Skills (reordered for this job)</h3>
              <Compare before={data.skills.map((g) => `${g.group}: ${g.items}`)} after={s.skills.map((g) => `${g.group}: ${g.items}`)} applied={applied.has('skills')} onApply={apply.skills} /></section>
          )}
          {s.missingKeywords.length > 0 && (
            <section className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <h3 className="mb-1.5 text-xs font-black uppercase tracking-wider text-cyan-300">The job asks for, but your resume doesn&apos;t show</h3>
              <div className="flex flex-wrap gap-1.5">{s.missingKeywords.map((k) => <span key={k} className="rounded-md border border-yellow-300/30 bg-yellow-300/10 px-2 py-1 text-xs text-yellow-100">{k}</span>)}</div>
              <p className="mt-2 text-[11px] text-slate-500">Only add these if you really have the experience (e.g. as a bullet or in Skills).</p>
            </section>
          )}
          {s.notes.length > 0 && (
            <section className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <h3 className="mb-1.5 text-xs font-black uppercase tracking-wider text-cyan-300">Tips</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">{s.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
