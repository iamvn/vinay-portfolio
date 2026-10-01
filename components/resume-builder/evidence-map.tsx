'use client';

import { useMemo, useState } from 'react';
import { Button, useReadOnly, type Notify } from '@/components/admin/ui';
import { coverageSummary, mapRequirements, type Coverage, type EvidenceItem, type RequirementMatch } from '@/lib/career/evidence';
import { addSkills } from '@/lib/resume-builder/ats-fixes';
import { keywordCategory, type JobKeyword } from '@/lib/resume-builder/keywords';
import type { ResumeData } from '@/lib/resume-builder/types';

type Update = (change: (data: ResumeData) => ResumeData) => void;

const COVERAGE: Record<Coverage, { label: string; tone: string; hint: string }> = {
  strong: { label: 'Strong', tone: 'border-lime-300/40 bg-lime-300/10 text-lime-200', hint: 'Shown in a bullet: you used it, in context.' },
  partial: { label: 'Partial', tone: 'border-yellow-300/40 bg-yellow-300/10 text-yellow-100', hint: 'Only listed (skills/summary): claimed, not demonstrated.' },
  profile: { label: 'In profile', tone: 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100', hint: 'Not on this resume, but your profile proves it.' },
  missing: { label: 'Missing', tone: 'border-red-400/40 bg-red-400/10 text-red-200', hint: 'No evidence anywhere.' },
};

const sameCompany = (a: string, b: string) => {
  const x = a.trim().toLowerCase(); const y = b.trim().toLowerCase();
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

/** The one thing to do for a requirement, as text and (when possible) a one-click change. */
function recommendation(match: RequirementMatch, data: ResumeData): { text: string; action?: { label: string; change: (d: ResumeData) => ResumeData; done: string } } {
  if (match.coverage === 'strong') {
    if (match.prominent || !match.required) return { text: match.prominent ? 'Good: it’s near the top of a recent role.' : 'Good.' };
    const spot = match.onResume.find((s) => s.kind === 'experience' && s.bullet > 0);
    if (spot && spot.kind === 'experience') {
      return {
        text: `Required, but buried (${spot.label}). Recruiters read the first two bullets of each role.`,
        action: {
          label: 'Move to top',
          done: `Moved the ${match.label} bullet to the top of ${data.experience[spot.role]?.company || 'that role'}.`,
          change: (d) => ({ ...d, experience: d.experience.map((role, i) => (i === spot.role ? { ...role, bullets: [role.bullets[spot.bullet], ...role.bullets.filter((_, j) => j !== spot.bullet)] } : role)) }),
        },
      };
    }
    return { text: 'Good.' };
  }

  // A bullet from your profile that belongs to a role on this resume.
  const bullet = match.inProfile.find((item) => item.kind === 'experience' && item.company && data.experience.some((role) => !role.hidden && sameCompany(role.company, item.company!)));
  if (bullet) {
    const index = data.experience.findIndex((role) => !role.hidden && sameCompany(role.company, bullet.company!));
    return {
      text: `Your profile shows it at ${bullet.source}: “${bullet.text.length > 110 ? `${bullet.text.slice(0, 110)}…` : bullet.text}”`,
      action: {
        label: `Add bullet to ${data.experience[index].company || 'that role'}`,
        done: `Added your ${match.label} bullet to ${data.experience[index].company}.`,
        change: (d) => ({ ...d, experience: d.experience.map((role, i) => (i === index ? { ...role, bullets: [bullet.text, ...role.bullets] } : role)) }),
      },
    };
  }
  // A project from your profile that's on this resume but hidden.
  const project = match.inProfile.find((item) => item.kind === 'project' && item.project);
  const hiddenIndex = project ? data.projects.findIndex((p) => p.hidden && p.name.trim().toLowerCase() === project.project!.trim().toLowerCase()) : -1;
  if (project && hiddenIndex >= 0) {
    return {
      text: `${project.source} shows it, but that project is hidden on this resume.`,
      action: {
        label: `Show ${data.projects[hiddenIndex].name}`,
        done: `${data.projects[hiddenIndex].name} is now on the resume.`,
        change: (d) => ({ ...d, projects: d.projects.map((p, i) => (i === hiddenIndex ? { ...p, hidden: false } : p)), layout: { ...d.layout, hidden: d.layout.hidden.filter((s) => s !== 'projects') } }),
      },
    };
  }
  if (match.coverage === 'partial') return { text: 'Listed but never shown in action. Add a bullet saying where and how you used it.' };
  if (match.coverage === 'profile') {
    const proof = match.inProfile[0];
    const skillsListed = data.skills.some((group) => group.items.toLowerCase().includes(match.label.toLowerCase()));
    return {
      text: `Backed by ${proof.source}.`,
      action: skillsListed ? undefined : {
        label: 'Add to Skills',
        done: `Added ${match.label} to Skills (backed by ${proof.source}).`,
        change: addSkills([{ label: match.label, term: match.term, category: keywordCategory(match.term) }]),
      },
    };
  }
  return { text: 'No evidence in your resume or profile. Add it only if you really have it; then add a bullet showing where.' };
}

function Row({ match, data, update, notify }: { match: RequirementMatch; data: ResumeData; update: Update; notify: Notify }) {
  const readOnly = useReadOnly();
  const [confirming, setConfirming] = useState(false);
  const rec = recommendation(match, data);
  const c = COVERAGE[match.coverage];
  const where = match.onResume.slice(0, 2).map((s) => s.label).join(' · ') || match.inProfile.slice(0, 1).map((i) => i.source).join('');
  return (
    <li className="grid gap-2 border-b border-white/5 py-2.5 last:border-0 sm:grid-cols-[9.5rem_6.5rem_1fr] sm:items-start">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{match.label}</p>
        <p className="text-[11px] text-slate-500">{match.required ? 'Required' : 'Mentioned'}</p>
      </div>
      <div><span title={c.hint} className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${c.tone}`}>{c.label}</span></div>
      <div className="min-w-0 space-y-1.5 text-xs leading-5">
        {where && <p className="text-slate-400"><span className="text-slate-500">Evidence:</span> {where}</p>}
        <p className="text-slate-300">{rec.text}</p>
        {rec.action && (
          <Button className="min-h-8 px-2.5 py-1" disabled={readOnly} onClick={() => { update(rec.action!.change); notify(`${rec.action!.done} Undo in the top bar reverts it.`); }}>{rec.action.label}</Button>
        )}
        {match.coverage === 'missing' && (!confirming ? (
          <button type="button" disabled={readOnly} onClick={() => setConfirming(true)} className="text-[11px] font-bold text-slate-400 underline decoration-dotted hover:text-white disabled:opacity-40">I have this…</button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-300/30 bg-yellow-300/[.06] p-2">
            <span className="text-[11px] text-yellow-100">Only if it’s true: you may be asked about it in the interview.</span>
            <Button className="min-h-8 px-2.5 py-1" onClick={() => {
              update(addSkills([{ label: match.label, term: match.term, category: keywordCategory(match.term) }]));
              notify(`Added ${match.label} to Skills. Add a bullet showing where you used it to make it strong.`);
              setConfirming(false);
            }}>Yes, add to Skills</Button>
            <button type="button" onClick={() => setConfirming(false)} className="text-[11px] font-bold text-slate-400 hover:text-white">Cancel</button>
          </div>
        ))}
      </div>
    </li>
  );
}

/**
 * Requirement → evidence: for each skill the job asks for, where this resume proves it, how strongly, and
 * the one thing to do about it. Strong = used in a bullet; Partial = only listed; In profile = provable
 * from your profile but not on this resume; Missing = nowhere.
 */
export function EvidenceMap({ keywords, data, profile, update, notify }: {
  keywords: JobKeyword[]; data: ResumeData; profile: EvidenceItem[]; update: Update; notify: Notify;
}) {
  const matches = useMemo(() => mapRequirements(keywords, data, profile), [keywords, data, profile]);
  const [filter, setFilter] = useState<'all' | 'todo'>('todo');
  const summary = coverageSummary(matches);
  const rank: Record<Coverage, number> = { missing: 0, profile: 1, partial: 2, strong: 3 };
  const sorted = [...matches].sort((a, b) => Number(b.required) - Number(a.required) || rank[a.coverage] - rank[b.coverage]);
  const todo = sorted.filter((m) => m.coverage !== 'strong' || (m.required && !m.prominent && m.onResume.some((s) => s.kind === 'experience' && s.bullet > 0)));
  const shown = filter === 'todo' ? todo : sorted;
  if (!matches.length) return null;

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:p-4" aria-labelledby="evidence-map">
      <div>
        <h3 id="evidence-map" className="text-sm font-bold text-white">Requirement → evidence</h3>
        <p className="mt-0.5 text-xs leading-5 text-slate-400">
          For each skill the job asks for: where you <b className="text-slate-200">prove</b> it, not just whether the word appears.
          {summary.required > 0 && <> You cover <b className="text-slate-100">{summary.requiredCovered} of {summary.required}</b> required skills.</>}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['strong', 'partial', 'profile', 'missing'] as Coverage[]).map((key) => (
          <div key={key} title={COVERAGE[key].hint} className={`rounded-lg border px-3 py-2 ${COVERAGE[key].tone}`}>
            <p className="text-lg font-black leading-none">{summary[key]}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">{COVERAGE[key].label}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-[11px] font-bold">
        {(['todo', 'all'] as const).map((key) => (
          <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
            className={`rounded-md px-2.5 py-1 ${filter === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
            {key === 'todo' ? `Needs attention (${todo.length})` : `All (${sorted.length})`}
          </button>
        ))}
      </div>
      {shown.length === 0
        ? <p className="text-xs text-lime-200">Every requirement is shown in a bullet, and the required ones are near the top. Nice.</p>
        : <ul>{shown.map((match) => <Row key={match.term} match={match} data={data} update={update} notify={notify} />)}</ul>}
    </section>
  );
}
