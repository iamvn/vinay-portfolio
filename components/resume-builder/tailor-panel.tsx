'use client';

import { useMemo, useState } from 'react';
import { describeIssues, evidenceText, unsupportedClaims, type ClaimIssue, type EvidenceItem } from '@/lib/career/evidence';
import { api, describeError } from '@/components/admin/api';
import { Button, useReadOnly, type Notify } from '@/components/admin/ui';
import type { TailorSuggestion } from '@/lib/resume-builder/tailor';
import type { ResumeData } from '@/lib/resume-builder/types';

type Update = (change: (data: ResumeData) => ResumeData) => void;

/** "Backed by your resume/profile" or "adds GraphQL, 40% — not in your profile" (then Apply needs a second, deliberate click). */
function Guard({ issues }: { issues: ClaimIssue[] }) {
  if (!issues.length) return <p className="text-[11px] font-bold text-lime-300">✓ Backed by your resume and profile</p>;
  return (
    <p className="text-[11px] leading-5 text-yellow-100">
      <b className="text-yellow-300">⚠ Needs your confirmation:</b> adds {describeIssues(issues)}, which {issues.length === 1 ? 'isn’t' : 'aren’t'} in your resume or profile.
      Apply only if true, or edit afterwards.
    </p>
  );
}

function Compare({ before, after, onApply, applied, issues }: { before: string[]; after: string[]; onApply: () => void; applied: boolean; issues: ClaimIssue[] }) {
  const [confirming, setConfirming] = useState(false);
  const flagged = issues.length > 0;
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Now</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">{before.map((line, i) => <li key={i}>{line}</li>)}</ul>
      </div>
      <div className="rounded-lg border border-lime-300/25 bg-lime-300/[.04] p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-lime-300">Suggested</p>
          <Button tone={applied ? 'ghost' : flagged && !confirming ? 'ghost' : 'primary'} className="min-h-8 px-2.5 py-1" disabled={applied}
            onClick={() => { if (flagged && !confirming) { setConfirming(true); return; } setConfirming(false); onApply(); }}>
            {applied ? 'Applied ✓' : flagged ? (confirming ? 'Yes, it’s true: apply' : 'Apply…') : 'Apply'}
          </Button>
        </div>
        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-100">{after.map((line, i) => <li key={i}>{line}</li>)}</ul>
      </div>
      <div className="lg:col-span-2"><Guard issues={issues} /></div>
    </div>
  );
}

/** "Tailor with AI": suggestions for one job description, applied piece by piece (or all at once). */
export function TailorPanel({ data, jobDescription, update, notify, customCode, profile = [] }: {
  data: ResumeData; jobDescription: string; update: Update; notify: Notify; customCode: boolean; profile?: EvidenceItem[];
}) {
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ suggestion: TailorSuggestion; provider: string; base: string } | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const mark = (key: string) => setApplied((current) => new Set(current).add(key));

  async function run() {
    if (jobDescription.trim().length < 50) return notify('Paste the job description in the ATS score tab first.', 'error');
    setBusy(true);
    setResult(null);
    setApplied(new Set());
    try {
      // What the suggestions are checked against: your profile plus this resume as it was when you asked.
      const base = evidenceText(profile, data);
      setResult({ ...(await api<{ suggestion: TailorSuggestion; provider: string }>('POST', '/api/resume-builder/tailor', { data, jobDescription })), base });
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const s = result?.suggestion;
  const experience = useMemo(() => (s?.experience ?? []).filter((item) => data.experience[item.index] && item.bullets.length), [s, data.experience]);
  const issues = useMemo(() => {
    if (!s || !result) return null;
    const check = (text: string) => unsupportedClaims(text, result.base);
    return {
      headline: check(s.headline),
      summary: check(s.summary),
      roles: new Map(experience.map((item) => [item.index, check(item.bullets.join('\n'))])),
      skills: check(s.skills.map((g) => g.items).join(', ')),
    };
  }, [s, result, experience]);

  const apply = {
    headline: () => { update((d) => ({ ...d, basics: { ...d.basics, headline: s!.headline } })); mark('headline'); },
    summary: () => { update((d) => ({ ...d, basics: { ...d.basics, summary: s!.summary } })); mark('summary'); },
    role: (index: number, bullets: string[]) => { update((d) => ({ ...d, experience: d.experience.map((e, i) => (i === index ? { ...e, bullets } : e)) })); mark(`role-${index}`); },
    skills: () => { update((d) => ({ ...d, skills: s!.skills })); mark('skills'); },
  };
  // Applies everything backed by your resume/profile; flagged parts wait for your confirmation one by one.
  function applyAll() {
    if (!s || !issues) return;
    let skipped = 0;
    const ok = (list: ClaimIssue[]) => { if (list.length) skipped += 1; return !list.length; };
    if (s.headline && ok(issues.headline)) apply.headline();
    if (s.summary && ok(issues.summary)) apply.summary();
    for (const item of experience) if (ok(issues.roles.get(item.index) ?? [])) apply.role(item.index, item.bullets);
    if (s.skills.length && ok(issues.skills)) apply.skills();
    notify(skipped
      ? `Applied the suggestions backed by your profile. ${skipped} need${skipped === 1 ? 's' : ''} your confirmation (marked ⚠). Undo reverts changes.`
      : 'All suggestions applied. Check the preview; Undo in the top bar reverts changes.');
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
        <p>
          AI rewrites your summary and bullets for the job description (from the ATS score tab), using the job&apos;s wording.
          It is told <b>never to invent</b> experience, numbers or skills, and every suggestion is checked against your resume and profile:
          anything new is marked <b className="text-yellow-200">⚠</b> and needs your confirmation.
        </p>
        <p className="mt-1 text-xs text-slate-500">Uses the providers from Admin → AI assistant.</p>
        {customCode && <p className="mt-2 text-xs text-yellow-200">This resume uses custom code: applying a suggestion rewrites that section of your code; your other code edits are kept.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button tone="primary" onClick={run} disabled={busy || readOnly}>{busy ? 'Thinking… (up to a minute)' : result ? 'Suggest again' : '✨ Tailor to this job'}</Button>
          {s && <Button onClick={applyAll} disabled={readOnly}>Apply all backed suggestions</Button>}
        </div>
      </div>

      {s && (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-500">Suggestions from {result?.provider}.</p>
          {s.headline && s.headline !== data.basics.headline && (
            <section className="space-y-2"><h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">Headline</h3>
              <Compare before={[data.basics.headline || '—']} after={[s.headline]} applied={applied.has('headline')} onApply={apply.headline} issues={issues?.headline ?? []} /></section>
          )}
          {s.summary && (
            <section className="space-y-2"><h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">Summary</h3>
              <Compare before={[data.basics.summary || '—']} after={[s.summary]} applied={applied.has('summary')} onApply={apply.summary} issues={issues?.summary ?? []} /></section>
          )}
          {experience.map((item) => (
            <section key={item.index} className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">{data.experience[item.index].role} · {data.experience[item.index].company}</h3>
              <Compare before={data.experience[item.index].bullets} after={item.bullets} applied={applied.has(`role-${item.index}`)} onApply={() => apply.role(item.index, item.bullets)} issues={issues?.roles.get(item.index) ?? []} />
            </section>
          ))}
          {s.skills.length > 0 && (
            <section className="space-y-2"><h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">Skills (reordered for this job)</h3>
              <Compare before={data.skills.map((g) => `${g.group}: ${g.items}`)} after={s.skills.map((g) => `${g.group}: ${g.items}`)} applied={applied.has('skills')} onApply={apply.skills} issues={issues?.skills ?? []} /></section>
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
