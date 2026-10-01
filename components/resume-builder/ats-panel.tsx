'use client';

import { useMemo, useState } from 'react';
import { Button, TextArea, inputClass, useReadOnly, type Notify } from '@/components/admin/ui';
import type { AtsReport, CheckStatus, KeywordResult } from '@/lib/resume-builder/ats';
import { addSkills, applyAllFixes, buildFixes, gainOf, mentionInSummary, type Fix } from '@/lib/resume-builder/ats-fixes';
import { CATEGORY_LABELS, type KeywordCategory } from '@/lib/resume-builder/keywords';
import type { ResumeData } from '@/lib/resume-builder/types';
import { profileProof, type EvidenceItem } from '@/lib/career/evidence';
import { EvidenceMap } from './evidence-map';

type Update = (change: (data: ResumeData) => ResumeData) => void;

const tone = (score: number) => (score >= 80 ? 'text-lime-300' : score >= 60 ? 'text-yellow-300' : 'text-red-300');
const ring = (score: number) => (score >= 80 ? '#bef264' : score >= 60 ? '#fde047' : '#fca5a5');
const ICON: Record<CheckStatus, string> = { pass: '✓', warn: '!', fail: '✕' };
const ICON_TONE: Record<CheckStatus, string> = {
  pass: 'bg-lime-300/15 text-lime-300', warn: 'bg-yellow-300/15 text-yellow-300', fail: 'bg-red-400/15 text-red-300',
};
const Gain = ({ value }: { value: number }) => (value > 0
  ? <span className="shrink-0 rounded-full bg-lime-300/15 px-2 py-0.5 text-[11px] font-black text-lime-300">+{value}</span>
  : null);

export function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const radius = 15.9;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3.2" />
        <circle cx="18" cy="18" r={radius} fill="none" stroke={ring(score)} strokeWidth="3.2" strokeLinecap="round" strokeDasharray={`${score} 100`} pathLength={100} />
      </svg>
      <span className={`text-xl font-black ${tone(score)}`}>{score}</span>
    </span>
  );
}

// ---------- one fix ----------

function Preview({ items }: { items: { before: string; after: string }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  return (
    <div className="space-y-1.5">
      {shown.map((item, index) => (
        <div key={index} className="rounded-lg bg-black/30 p-2 text-xs leading-5">
          <p className="text-slate-500 line-through decoration-slate-600">{item.before}</p>
          {item.after !== '(removed)' && <p className="text-lime-100">{item.after}</p>}
        </div>
      ))}
      {items.length > 3 && <button type="button" onClick={() => setAll(!all)} className="text-xs font-bold text-cyan-300">{all ? 'Show less' : `Show all ${items.length}`}</button>}
    </div>
  );
}

function FixCard({ fix, data, update, notify }: { fix: Fix; data: ResumeData; update: Update; notify: Notify }) {
  const readOnly = useReadOnly();
  const [values, setValues] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const filled = fix.fields?.some((field) => values[field.key]?.trim());

  return (
    <li className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{fix.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-400">{fix.detail}</p>
        </div>
        <Gain value={fix.gain} />
      </div>

      {fix.kind === 'apply' && (
        <>
          {fix.preview && <Preview items={fix.preview} />}
          <Button tone="primary" disabled={readOnly} onClick={() => { update(fix.apply!); notify(`${fix.title}: done. Undo in the top bar reverts it.`); }}>Apply</Button>
        </>
      )}

      {fix.kind === 'form' && (
        <form className="grid gap-2 sm:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          if (!filled) return notify('Fill in at least one field.', 'error');
          update(fix.build!(values));
          notify(`${fix.title}: saved.`);
          setValues({});
        }}>
          {fix.fields!.map((field) => (
            <label key={field.key} className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {field.label}
              <input className={`${inputClass} mt-1 normal-case tracking-normal`} value={values[field.key] ?? ''} placeholder={field.placeholder} disabled={readOnly}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} />
            </label>
          ))}
          <div className="sm:col-span-3"><Button tone="primary" type="submit" disabled={readOnly || !filled}>Add to resume</Button></div>
        </form>
      )}

      {fix.kind === 'edit' && (
        <ul className="space-y-2">
          {fix.items!.map((item) => {
            const key = `${item.role}-${item.bullet}`;
            const current = data.experience[item.role]?.bullets[item.bullet] ?? item.text;
            const draft = drafts[key] ?? current;
            return (
              <li key={key} className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.context}</p>
                <textarea className={`${inputClass} min-h-16`} rows={2} value={draft} disabled={readOnly}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} />
                <div className="flex items-center gap-2">
                  <Button disabled={readOnly || draft.trim() === current.trim() || !draft.trim()} onClick={() => {
                    update((d) => ({ ...d, experience: d.experience.map((role, i) => (i === item.role ? { ...role, bullets: role.bullets.map((b, j) => (j === item.bullet ? draft.trim() : b)) } : role)) }));
                    setDrafts((d) => { const next = { ...d }; delete next[key]; return next; });
                    notify('Bullet updated.');
                  }}>Save</Button>
                  <span className="text-[11px] text-slate-500">e.g. “…for 50k daily users”, “…cutting load time 40%”, “…across 6 teams”</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

// ---------- missing keywords ----------

const ORDER: KeywordCategory[] = ['language', 'frontend', 'backend', 'data', 'cloud', 'testing', 'tools', 'ai', 'concept', 'soft', 'domain', 'other'];
const SUMMARY_ONLY = new Set<KeywordCategory>(['soft', 'domain', 'other']);

function MissingKeywords({ report, data, jobDescription, pages, update, notify, profile }: {
  report: AtsReport; data: ResumeData; jobDescription: string; pages: number | null; update: Update; notify: Notify; profile: EvidenceItem[];
}) {
  const readOnly = useReadOnly();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Truth guard: keywords with no evidence in your profile need an explicit "yes, I have these".
  const [confirm, setConfirm] = useState<{ list: KeywordResult[]; where: 'skills' | 'summary' } | null>(null);
  const proof = useMemo(() => new Map(report.keywords.map((k) => [k.term, profileProof(k.term, profile)])), [report.keywords, profile]);
  const missing = report.keywords.filter((k) => !k.found);
  const found = report.keywords.filter((k) => k.found);
  const groups = ORDER.map((category) => ({ category, items: missing.filter((k) => k.category === category) })).filter((g) => g.items.length);
  const picked = missing.filter((k) => selected.has(k.term));
  const toSkills = picked.filter((k) => !SUMMARY_ONLY.has(k.category));
  const toSummary = picked.filter((k) => SUMMARY_ONLY.has(k.category));
  const skillsGain = toSkills.length ? gainOf(data, addSkills(toSkills), jobDescription, pages) : 0;
  const summaryGain = toSummary.length ? gainOf(data, mentionInSummary(toSummary), jobDescription, pages) : 0;
  const toggle = (k: KeywordResult) => setSelected((s) => { const next = new Set(s); if (next.has(k.term)) next.delete(k.term); else next.add(k.term); return next; });

  function add(list: KeywordResult[], where: 'skills' | 'summary', confirmed = false) {
    const unproven = list.filter((k) => !proof.get(k.term));
    if (unproven.length && !confirmed) { setConfirm({ list, where }); return; }
    setConfirm(null);
    update(where === 'skills' ? addSkills(list) : mentionInSummary(list));
    setSelected((s) => { const next = new Set(s); for (const k of list) next.delete(k.term); return next; });
    notify(`Added ${list.map((k) => k.label).join(', ')} to your ${where}. Undo in the top bar reverts it.`);
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Keywords from the job · {found.length}/{report.keywords.length} on your resume</p>
          {missing.length > 0 && <p className="mt-0.5 text-xs leading-5 text-slate-400">Tick the ones you <b className="text-slate-200">really have</b> and add them in one click. <span className="text-cyan-200">◆</span> = your profile already proves it. Technical skills go into your Skills section (the right group is picked for you); soft skills and domain words go into your summary.</p>}
        </div>
      </div>

      {groups.map(({ category, items }) => (
        <div key={category}>
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{CATEGORY_LABELS[category]}</p>
            <button type="button" className="text-[11px] font-bold text-cyan-300 disabled:opacity-40" disabled={readOnly}
              onClick={() => setSelected((s) => { const next = new Set(s); const all = items.every((k) => next.has(k.term)); for (const k of items) { if (all) next.delete(k.term); else next.add(k.term); } return next; })}>
              {items.every((k) => selected.has(k.term)) ? 'none' : 'all'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((k) => {
              const on = selected.has(k.term);
              return (
                <button key={k.term} type="button" role="checkbox" aria-checked={on} disabled={readOnly} onClick={() => toggle(k)}
                  title={k.weight >= 6 ? 'Mentioned often / required' : undefined}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${on ? 'border-lime-300 bg-lime-300/15 text-lime-100' : 'border-red-400/30 bg-red-400/[.07] text-red-100 hover:border-red-300/60'}`}>
                  <span aria-hidden="true" className={`grid size-4 place-items-center rounded border text-[10px] ${on ? 'border-lime-300 bg-lime-300 text-black' : 'border-red-300/50'}`}>{on ? '✓' : ''}</span>
                  {k.label}{k.weight >= 6 && <span className="text-[10px] text-red-300">★</span>}
                  {proof.get(k.term) && <span className="text-[10px] text-cyan-200" title={`Backed by ${proof.get(k.term)!.source}`}>◆</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {confirm && (
        <div role="alert" className="space-y-2 rounded-lg border border-yellow-300/40 bg-yellow-300/[.07] p-3 text-xs leading-5 text-yellow-50">
          <p>
            <b>{confirm.list.filter((k) => !proof.get(k.term)).map((k) => k.label).join(', ')}</b> {confirm.list.filter((k) => !proof.get(k.term)).length === 1 ? 'isn’t' : 'aren’t'} anywhere in your profile or resume.
            Add only what you really have: recruiters ask about every skill you list.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" onClick={() => add(confirm.list, confirm.where, true)}>Yes, I have {confirm.list.length === 1 ? 'it' : 'all of these'}</Button>
            {confirm.list.some((k) => proof.get(k.term)) && (
              <Button onClick={() => add(confirm.list.filter((k) => proof.get(k.term)), confirm.where, true)}>Add only the {confirm.list.filter((k) => proof.get(k.term)).length} backed by my profile</Button>
            )}
            <button type="button" onClick={() => setConfirm(null)} className="text-xs font-bold text-slate-300 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {picked.length > 0 && !confirm && (
        <div className="sticky bottom-0 -mx-3 flex flex-wrap items-center gap-2 border-t border-white/10 bg-slate-950/95 px-3 pt-3 pb-1 sm:-mx-4 sm:px-4">
          {toSkills.length > 0 && <Button tone="primary" onClick={() => add(toSkills, 'skills')}>Add {toSkills.length} to Skills {skillsGain > 0 ? `· +${skillsGain}` : ''}</Button>}
          {toSummary.length > 0 && <Button tone="primary" onClick={() => add(toSummary, 'summary')}>Mention {toSummary.length} in summary {summaryGain > 0 ? `· +${summaryGain}` : ''}</Button>}
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-bold text-slate-400 hover:text-white">Clear</button>
        </div>
      )}

      {found.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Already on your resume</p>
          <div className="flex flex-wrap gap-1.5">{found.map((k) => <span key={k.term} className="rounded-md border border-lime-300/25 bg-lime-300/10 px-2 py-1 text-xs text-lime-100">✓ {k.label}</span>)}</div>
        </div>
      )}
      {missing.length > 0 && <p className="text-[11px] text-slate-500">★ = the job stresses it (required or repeated).</p>}
    </div>
  );
}

// ---------- panel ----------

export function AtsPanel({ report, jobDescription, onJobDescription, data, update, pages, notify, customCode, profile }: {
  report: AtsReport; jobDescription: string; onJobDescription: (value: string) => void;
  data: ResumeData; update: Update; pages: number | null; notify: Notify; customCode: boolean; profile: EvidenceItem[];
}) {
  const readOnly = useReadOnly();
  const hasJob = report.keywordScore !== null;
  const order: CheckStatus[] = ['fail', 'warn', 'pass'];
  const checks = [...report.checks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const fixes = useMemo(() => buildFixes({ data, jobDescription, pages, report }), [data, jobDescription, pages, report]);
  const oneClick = fixes.filter((fix) => fix.kind === 'apply');
  const allGain = useMemo(() => (oneClick.length ? applyAllFixes(data, jobDescription, pages) : null), [oneClick.length, data, jobDescription, pages]);
  const allGainPoints = allGain ? gainOf(data, () => allGain.data, jobDescription, pages) : 0;
  const [editingJob, setEditingJob] = useState(!jobDescription.trim());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
        <ScoreRing score={report.score} />
        <div className="min-w-0 text-sm">
          <p className="font-black uppercase tracking-wider text-white">{hasJob ? 'ATS match score' : 'ATS format score'}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {hasJob
              ? <>Keywords {report.keywordScore}% · Format {report.formatScore}%. 80+ is a strong match.{report.job?.title ? <> Job: <b className="text-slate-200">{report.job.title}</b>.</> : null}</>
              : <>Paste a job description below to also score keyword match against a specific job.</>}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Job description</p>
          {jobDescription.trim() && <button type="button" onClick={() => setEditingJob(!editingJob)} className="text-xs font-bold text-cyan-300">{editingJob ? 'Done' : 'Edit'}</button>}
        </div>
        {editingJob || !jobDescription.trim()
          ? <TextArea value={jobDescription} rows={6} onChange={onJobDescription} placeholder="Paste the full job post here (responsibilities and requirements)…" />
          : <p className="line-clamp-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">{jobDescription}</p>}
        <p className="mt-1 text-[11px] text-slate-500">Saved with this resume. Also used by “Tailor with AI”.</p>
      </div>

      {customCode && (
        <p className="rounded-xl border border-yellow-300/30 bg-yellow-300/[.06] px-4 py-3 text-xs text-yellow-100">
          This resume uses custom code. Fixes update the matching sections of your code (Skills, Summary, Experience…); the rest of your code edits are kept.
        </p>
      )}

      {hasJob && report.keywords.length > 0 && (
        <EvidenceMap keywords={report.keywords} data={data} profile={profile} update={update} notify={notify} />
      )}

      {fixes.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-xs font-black uppercase tracking-wider text-cyan-300">Improve your score</h3>
            {allGain && allGain.applied.length > 1 && (
              <Button tone="primary" disabled={readOnly} onClick={() => {
                update(() => allGain.data);
                notify(`Applied ${allGain.applied.length} fixes. Undo in the top bar reverts them all.`);
              }}>Apply all {allGain.applied.length} one-click fixes{allGainPoints > 0 ? ` · +${allGainPoints}` : ''}</Button>
            )}
          </div>
          <ul className="space-y-2">{fixes.map((fix) => <FixCard key={fix.id} fix={fix} data={data} update={update} notify={notify} />)}</ul>
        </section>
      )}

      {hasJob && report.keywords.length > 0 && (
        <MissingKeywords report={report} data={data} jobDescription={jobDescription} pages={pages} update={update} notify={notify} profile={profile} />
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">All checks</h3>
        <ul className="space-y-2">
          {checks.map((check) => (
            <li key={check.id} className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <span aria-label={check.status} className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-black ${ICON_TONE[check.status]}`}>{ICON[check.status]}</span>
              <div className="min-w-0 text-sm">
                <p className="font-bold text-slate-100">{check.label}</p>
                <p className="text-xs text-slate-400">{check.detail}</p>
                {check.status !== 'pass' && check.tip && <p className="mt-1 text-xs text-cyan-200/90">Tip: {check.tip}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-[11px] leading-5 text-slate-500">
        Every template is already ATS-safe: one column, real text (no images or tables), standard headings and embedded fonts. The score covers what&apos;s left: your words.
        Want the AI to rewrite bullets for this job? Use the “Tailor with AI” tab.
      </p>
    </div>
  );
}
