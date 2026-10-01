'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, describeError } from '@/components/admin/api';
import { Button, Card, ConfirmButton, Field, Loading, TextArea, inputClass, useReadOnly, type Notify } from '@/components/admin/ui';
import { STATUS_TONES } from './status';
import { coverageSummary, describeIssues, evidenceText, mapRequirements, unsupportedClaims, type Coverage, type EvidenceItem } from '@/lib/career/evidence';
import type { ResumeData } from '@/lib/resume-builder/types';
import {
  KIT_KINDS, KIT_LABELS, QUESTION_CATEGORIES, QUESTION_LABELS, STATUSES, STATUS_LABELS,
  type Application, type ApplicationStatus, type Contact, type KitKind,
} from '@/lib/career/types';
import { JobFacts } from './job-facts';

type Detail = { application: Application; resume: { label: string; kind: 'sent' | 'linked' | 'profile'; data: ResumeData }; profile: EvidenceItem[] };
type Section = 'overview' | 'resume' | 'kit' | 'interview' | 'timeline';
type ResumeSummary = { id: number; name: string; updatedAt: string };

const COVERAGE_TONE: Record<Coverage, string> = {
  strong: 'text-lime-200', partial: 'text-yellow-200', profile: 'text-cyan-200', missing: 'text-red-200',
};
const COVERAGE_LABEL: Record<Coverage, string> = { strong: 'Strong', partial: 'Partial', profile: 'In profile', missing: 'Missing' };
const date = (iso: string) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00` : iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function copyText(text: string, notify: Notify) {
  navigator.clipboard?.writeText(text).then(() => notify('Copied.'), () => notify('Could not copy: select the text and copy it.', 'error'));
}

// ---------- overview ----------

function Overview({ detail, onSaved, notify }: { detail: Detail; onSaved: (app: Application) => void; notify: Notify }) {
  const readOnly = useReadOnly();
  const app = detail.application;
  const initial = { company: app.company, role: app.role, location: app.location, url: app.url, nextStep: app.nextStep, nextStepAt: app.nextStepAt, notes: app.notes, appliedAt: app.appliedAt };
  const [form, setForm] = useState(initial);
  const [contacts, setContacts] = useState<Contact[]>(app.contacts);
  const [jobText, setJobText] = useState(app.jobDescription);
  const [editingJob, setEditingJob] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || JSON.stringify(contacts) !== JSON.stringify(app.contacts) || jobText !== app.jobDescription;
  const keywords = useMemo(() => [...(app.analysis?.required ?? []), ...(app.analysis?.preferred ?? [])], [app.analysis]);
  const matches = useMemo(() => mapRequirements(keywords, detail.resume.data, detail.profile, new Set(app.analysis?.required.map((k) => k.term))), [keywords, detail, app.analysis]);
  const summary = coverageSummary(matches);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    try {
      const saved = await api<Application>('PATCH', `/api/applications/${app.id}`, {
        ...form, contacts: contacts.filter((c) => c.name || c.email || c.linkedin), ...(jobText !== app.jobDescription ? { jobDescription: jobText } : {}),
      });
      onSaved(saved);
      setEditingJob(false);
      notify('Saved.');
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  return (
    <div className="space-y-4">
      {app.analysis && (
        <Card title="What the job asks for">
          <div className="space-y-4">
            <JobFacts analysis={app.analysis} />
            {matches.length > 0 && (
              <div>
                <p className="mb-2 text-xs leading-5 text-slate-400">
                  Against <b className="text-slate-200">{detail.resume.label}</b>: {summary.strong} strong, {summary.partial} partial, {summary.profile} only in your profile, {summary.missing} missing.
                  {summary.required > 0 && <> Required covered: <b className="text-slate-100">{summary.requiredCovered}/{summary.required}</b>.</>}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500"><th className="py-1.5 pr-3">Requirement</th><th className="py-1.5 pr-3">Coverage</th><th className="py-1.5">Your evidence</th></tr></thead>
                    <tbody>
                      {matches.map((m) => (
                        <tr key={m.term} className="border-b border-white/5 align-top">
                          <td className="py-1.5 pr-3 font-bold text-slate-100">{m.label}{m.required && <span className="ml-1 text-[10px] font-normal text-slate-500">required</span>}</td>
                          <td className={`py-1.5 pr-3 font-bold ${COVERAGE_TONE[m.coverage]}`}>{COVERAGE_LABEL[m.coverage]}</td>
                          <td className="py-1.5 text-slate-400">{m.onResume[0]?.label ?? m.inProfile[0]?.source ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {app.resumeId && <p className="mt-2 text-[11px] text-slate-500">Fix gaps in the resume editor: its ATS tab has the full requirement map with one-click fixes.</p>}
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role"><input className={inputClass} readOnly={readOnly} value={form.role} onChange={(e) => set('role')(e.target.value)} /></Field>
          <Field label="Company"><input className={inputClass} readOnly={readOnly} value={form.company} onChange={(e) => set('company')(e.target.value)} /></Field>
          <Field label="Location"><input className={inputClass} readOnly={readOnly} value={form.location} onChange={(e) => set('location')(e.target.value)} /></Field>
          <Field label="Job link"><input className={inputClass} readOnly={readOnly} type="url" value={form.url} placeholder="https://…" onChange={(e) => set('url')(e.target.value)} /></Field>
          <Field label="Next step" hint="e.g. “Follow up with recruiter”, “Tech round 2”"><input className={inputClass} readOnly={readOnly} value={form.nextStep} onChange={(e) => set('nextStep')(e.target.value)} /></Field>
          <Field label="Next step date"><input className={inputClass} readOnly={readOnly} type="date" value={form.nextStepAt} onChange={(e) => set('nextStepAt')(e.target.value)} /></Field>
          <Field label="Applied on"><input className={inputClass} readOnly={readOnly} type="date" value={form.appliedAt.slice(0, 10)} onChange={(e) => set('appliedAt')(e.target.value)} /></Field>
        </div>
        <div className="mt-3"><Field label="Notes"><TextArea value={form.notes} onChange={set('notes')} rows={4} placeholder="Referral from…, salary discussed…, questions to ask…" /></Field></div>

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Contacts</p>
          <ul className="space-y-2">
            {contacts.map((c, i) => (
              <li key={i} className="grid gap-2 rounded-lg border border-white/10 p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                {(['name', 'title', 'email', 'linkedin'] as const).map((key) => (
                  <input key={key} aria-label={key} className={inputClass} readOnly={readOnly} placeholder={{ name: 'Name', title: 'Recruiter / Hiring manager', email: 'Email', linkedin: 'LinkedIn URL' }[key]}
                    value={c[key]} onChange={(e) => setContacts((list) => list.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))} />
                ))}
                <Button disabled={readOnly} label="Remove contact" onClick={() => setContacts((list) => list.filter((_, j) => j !== i))}>✕</Button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={readOnly} onClick={() => setContacts((list) => [...list, { name: '', title: '', email: '', linkedin: '' }])} className="mt-2 text-xs font-bold text-cyan-300 disabled:opacity-40">+ Add contact</button>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Job text</p>
            <button type="button" onClick={() => setEditingJob(!editingJob)} className="text-xs font-bold text-cyan-300">{editingJob ? 'Done' : 'Edit'}</button>
          </div>
          {editingJob
            ? <TextArea value={jobText} onChange={setJobText} rows={10} />
            : <p className="line-clamp-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">{jobText || 'No job text yet: paste it so the kit and interview prep know the job.'}</p>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="primary" disabled={readOnly || !dirty} onClick={save}>Save details</Button>
          {dirty && <Button onClick={() => { setForm(initial); setContacts(app.contacts); setJobText(app.jobDescription); }}>Cancel</Button>}
        </div>
      </Card>
    </div>
  );
}

// ---------- resume ----------

function ResumeSection({ detail, onChanged, notify }: { detail: Detail; onChanged: () => void; notify: Notify }) {
  const readOnly = useReadOnly();
  const app = detail.application;
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => { api<ResumeSummary[]>('GET', '/api/resume-builder').then(setResumes).catch(() => setResumes([])); }, []);
  const linked = resumes?.find((r) => r.id === app.resumeId);

  async function act(body: Record<string, unknown>, done: string) {
    try {
      await api('POST', `/api/applications/${app.id}/resume`, body);
      notify(done);
      onChanged();
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Resume for this job">
        {app.resumeId ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-200">Linked: <b>{linked?.name ?? `Resume #${app.resumeId}`}</b>{linked && <span className="text-xs text-slate-500"> · edited {date(linked.updatedAt)}</span>}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/admin/resume-builder/${app.resumeId}`} className="inline-flex min-h-11 items-center rounded-lg bg-lime-300 px-3.5 py-2 text-xs font-black uppercase tracking-wide text-black sm:min-h-0">Open in editor ↗</a>
              <Button disabled={readOnly} onClick={() => act({ action: 'unlink' }, 'Resume unlinked.')}>Unlink</Button>
            </div>
            <p className="text-xs leading-5 text-slate-400">The editor already has this job’s text, so its ATS tab shows the requirement → evidence map and “Tailor with AI” works straight away.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">No resume yet. Make one from your profile with this job’s text, or link one you already have.</p>
            <div className="flex flex-wrap items-end gap-2">
              <Button tone="primary" disabled={readOnly} onClick={() => act({ action: 'create' }, 'Created a resume for this job. Open it to tailor it.')}>Create tailored resume</Button>
              {resumes && resumes.length > 0 && (
                <>
                  <select className={`${inputClass} w-auto max-w-xs`} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Existing resume">
                    <option value="">Link an existing resume…</option>
                    {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <Button disabled={readOnly || !pick} onClick={() => act({ action: 'link', resumeId: Number(pick) }, 'Resume linked.')}>Link</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title="Version you sent">
        {app.snapshot ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p>Saved <b className="text-slate-100">{date(app.snapshot.at)}</b> from “{app.snapshot.name}”. Interview prep uses exactly this version, even if you edit the resume later.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
              <li>{app.snapshot.data.basics.headline || '—'}</li>
              {app.snapshot.data.experience.filter((e) => !e.hidden).slice(0, 2).map((e, i) => <li key={i}>{e.role} · {e.company}: {e.bullets[0] ?? ''}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button disabled={readOnly || !app.resumeId} onClick={() => act({ action: 'snapshot' }, 'Saved the current resume as the sent version.')}>Replace with current resume</Button>
              <Button disabled={readOnly} onClick={() => act({ action: 'restore' }, 'The sent version is now a resume you can open.')}>Open sent version as a new resume</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <p>Not saved yet. It’s saved automatically when you move this job to <b>Applied</b> with a resume linked; or save it now.</p>
            <Button disabled={readOnly || !app.resumeId} onClick={() => act({ action: 'snapshot' }, 'Saved the resume as the sent version.')}>Save the version I sent</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- application kit ----------

function KitSection({ detail, onSaved, notify }: { detail: Detail; onSaved: (app: Application) => void; notify: Notify }) {
  const readOnly = useReadOnly();
  const app = detail.application;
  const [tone, setTone] = useState<'professional' | 'warm' | 'concise'>('professional');
  const [recipient, setRecipient] = useState(app.contacts[0]?.name ?? '');
  const [drafts, setDrafts] = useState<Partial<Record<KitKind, { text: string; subject?: string }>>>({});
  const base = useMemo(() => `${evidenceText(detail.profile, detail.resume.data)}\n${app.company}\n${app.role}`, [detail, app.company, app.role]);

  async function write(kinds: KitKind[]) {
    try {
      const result = await api<{ application: Application; basedOn: string }>('POST', `/api/applications/${app.id}/kit`, { kinds, tone, recipient });
      setDrafts((d) => { const next = { ...d }; for (const k of kinds.length ? kinds : KIT_KINDS) delete next[k]; return next; });
      onSaved(result.application);
      notify(`Written from ${result.basedOn}. Check every line before sending.`);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }
  async function saveEdit(kind: KitKind) {
    const draft = drafts[kind];
    if (!draft) return;
    try {
      onSaved(await api<Application>('PATCH', `/api/applications/${app.id}`, { kit: { [kind]: draft } }));
      setDrafts((d) => { const next = { ...d }; delete next[kind]; return next; });
      notify(`${KIT_LABELS[kind]} saved.`);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  const hasAny = KIT_KINDS.some((k) => app.kit[k]);
  return (
    <div className="space-y-4">
      <Card title="Application kit">
        <p className="text-sm leading-6 text-slate-300">
          Cover letter, recruiter and LinkedIn messages and an application email for this job, written from <b className="text-slate-100">{detail.resume.label}</b> and your profile.
          The AI may only use facts you’ve given; anything new is marked <b className="text-yellow-200">⚠</b>.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <Field label="Tone">
            <select className={`${inputClass} sm:w-44`} value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
              <option value="professional">Professional</option><option value="warm">Warm</option><option value="concise">Concise</option>
            </select>
          </Field>
          <Field label="Addressed to (optional)"><input className={inputClass} value={recipient} placeholder="Priya Sharma" onChange={(e) => setRecipient(e.target.value)} /></Field>
          <Button tone="primary" disabled={readOnly || app.jobDescription.length < 50} onClick={() => write([])}>{hasAny ? 'Rewrite all' : '✨ Write the kit'}</Button>
        </div>
        {app.jobDescription.length < 50 && <p className="mt-2 text-xs text-yellow-200">Add the job text in Overview first.</p>}
      </Card>

      {KIT_KINDS.map((kind) => {
        const item = app.kit[kind];
        if (!item) return null;
        const draft = drafts[kind];
        const text = draft?.text ?? item.text;
        const subject = draft?.subject ?? item.subject;
        const issues = unsupportedClaims(`${subject ?? ''}\n${text}`, base);
        const limit = kind === 'linkedinMessage' ? 300 : null;
        return (
          <Card key={kind} title={KIT_LABELS[kind]} actions={<>
            <Button view onClick={() => copyText(subject !== undefined ? `Subject: ${subject}\n\n${text}` : text, notify)}>Copy</Button>
            <Button disabled={readOnly} onClick={() => write([kind])}>Rewrite</Button>
          </>}>
            {subject !== undefined && (
              <Field label="Subject"><input className={inputClass} readOnly={readOnly} value={subject} onChange={(e) => setDrafts((d) => ({ ...d, [kind]: { text, subject: e.target.value } }))} /></Field>
            )}
            <textarea className={`${inputClass} mt-2 min-h-32 leading-6`} readOnly={readOnly} rows={kind === 'coverLetter' ? 14 : 6} value={text} aria-label={KIT_LABELS[kind]}
              onChange={(e) => setDrafts((d) => ({ ...d, [kind]: { text: e.target.value, ...(subject !== undefined ? { subject } : {}) } }))} />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
              <span className={limit && text.length > limit ? 'font-bold text-red-300' : 'text-slate-500'}>{text.length}{limit ? ` / ${limit}` : ''} characters · {text.split(/\s+/).filter(Boolean).length} words</span>
              {issues.length
                ? <span className="text-yellow-100"><b className="text-yellow-300">⚠ Check:</b> mentions {describeIssues(issues)}, not in your resume or profile. Keep only if true (or if it’s just naming the job’s stack).</span>
                : <span className="font-bold text-lime-300">✓ Only facts from your resume and profile</span>}
              {draft && <Button tone="primary" className="min-h-8 px-2.5 py-1" onClick={() => saveEdit(kind)}>Save edits</Button>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- interview prep ----------

function InterviewSection({ detail, onSaved, notify }: { detail: Detail; onSaved: (app: Application) => void; notify: Notify }) {
  const readOnly = useReadOnly();
  const app = detail.application;
  const prep = app.interview;
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<number | null>(0);

  async function prepare() {
    try {
      onSaved(await api<Application>('POST', `/api/applications/${app.id}/interview`));
      setNotes({});
      notify('Interview questions ready.');
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }
  async function saveNote(index: number) {
    if (notes[index] === undefined) return;
    try {
      onSaved(await api<Application>('PATCH', `/api/applications/${app.id}`, { interviewNotes: { [index]: notes[index] } }));
      setNotes((n) => { const next = { ...n }; delete next[index]; return next; });
      notify('Answer notes saved.');
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Interview prep">
        <p className="text-sm leading-6 text-slate-300">
          Questions this interviewer is likely to ask, based on <b className="text-slate-100">{prep?.basedOn ?? detail.resume.label}</b> and the job: your claims and numbers, the job’s required skills, your gaps, and behavioural questions, each with follow-ups and tips.
        </p>
        {detail.resume.kind !== 'sent' && <p className="mt-1 text-xs text-slate-500">Tip: move the job to Applied (with a resume linked) so prep uses exactly the version you sent.</p>}
        <div className="mt-3"><Button tone="primary" disabled={readOnly || app.jobDescription.length < 50} onClick={prepare}>{prep ? 'Prepare new questions' : '✨ Prepare questions'}</Button></div>
      </Card>

      {prep && QUESTION_CATEGORIES.map((category) => {
        const list = prep.questions.map((q, index) => ({ q, index })).filter(({ q }) => q.category === category);
        if (!list.length) return null;
        return (
          <section key={category} className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">{QUESTION_LABELS[category]} ({list.length})</h3>
            <ul className="space-y-2">
              {list.map(({ q, index }) => {
                const expanded = open === index;
                const note = notes[index] ?? q.notes ?? '';
                return (
                  <li key={index} className="rounded-xl border border-white/10 bg-slate-950/70">
                    <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : index)} className="flex w-full items-start gap-3 p-3 text-left">
                      <span className="mt-0.5 text-xs text-slate-500">{expanded ? '▾' : '▸'}</span>
                      <span className="flex-1 text-sm font-bold text-slate-100">{q.question}</span>
                      {q.notes && <span className="shrink-0 rounded bg-lime-300/10 px-1.5 py-0.5 text-[10px] font-bold text-lime-200">Notes</span>}
                    </button>
                    {expanded && (
                      <div className="space-y-3 border-t border-white/5 p-3 pl-9 text-xs leading-5">
                        {q.why && <p className="text-slate-400"><b className="text-slate-300">Why they ask:</b> {q.why}</p>}
                        {q.evidence && q.evidence !== 'none' && <p className="text-slate-400"><b className="text-slate-300">Your evidence:</b> {q.evidence}</p>}
                        {q.followUps.length > 0 && (
                          <div><p className="font-bold text-slate-300">Follow-ups</p><ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-400">{q.followUps.map((f, i) => <li key={i}>{f}</li>)}</ol></div>
                        )}
                        {q.tips.length > 0 && (
                          <div><p className="font-bold text-slate-300">How to answer</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-400">{q.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                        )}
                        <label className="block">
                          <span className="font-bold text-slate-300">My answer notes</span>
                          <textarea className={`${inputClass} mt-1`} rows={3} readOnly={readOnly} value={note} placeholder="Situation, what I did, the result…"
                            onChange={(e) => setNotes((n) => ({ ...n, [index]: e.target.value }))} onBlur={() => saveNote(index)} />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ---------- timeline ----------

function TimelineSection({ app, onSaved, notify }: { app: Application; onSaved: (app: Application) => void; notify: Notify }) {
  const readOnly = useReadOnly();
  const [note, setNote] = useState('');
  async function add() {
    try {
      onSaved(await api<Application>('PATCH', `/api/applications/${app.id}`, { timelineNote: note }));
      setNote('');
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }
  return (
    <Card title="Timeline">
      <ol className="relative space-y-3 border-l border-white/10 pl-4">
        {[...app.timeline].reverse().map((e, i) => (
          <li key={i} className="text-sm">
            <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-cyan-300/70" aria-hidden="true" />
            <p className="text-slate-200">{e.text}</p>
            <p className="text-[11px] text-slate-500">{new Date(e.at).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex gap-2">
        <input className={inputClass} readOnly={readOnly} value={note} placeholder="Add a note: “Recruiter called”, “Round 1 went well”…" onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) void add(); }} />
        <Button disabled={readOnly || !note.trim()} onClick={add}>Add</Button>
      </div>
    </Card>
  );
}

// ---------- the page ----------

/** One application: status, the job and your evidence, resume, kit, interview prep and timeline. */
export function ApplicationDetail({ id, onBack, notify }: { id: number; onBack: () => void; notify: Notify }) {
  const readOnly = useReadOnly();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [section, setSection] = useState<Section>('overview');

  const load = useCallback(() => api<Detail>('GET', `/api/applications/${id}`).then(setDetail).catch((error) => { notify(describeError(error), 'error'); onBack(); }), [id, notify, onBack]);
  useEffect(() => { void load(); }, [load]);
  // Saving returns the application; the judged resume can change (e.g. a version was sent), so reload the rest.
  const onSaved = useCallback((application: Application) => {
    setDetail((d) => (d ? { ...d, application } : d));
    if (application.snapshot?.at !== detail?.application.snapshot?.at || application.resumeId !== detail?.application.resumeId) void load();
  }, [detail, load]);

  if (!detail) return <Loading />;
  const app = detail.application;

  async function setStatus(status: ApplicationStatus) {
    try {
      const saved = await api<Application>('PATCH', `/api/applications/${app.id}`, { status });
      onSaved(saved);
      notify(`Moved to ${STATUS_LABELS[status]}.${status === 'applied' && saved.snapshot && !app.snapshot ? ' The resume you sent is saved with it.' : ''}`);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }
  async function remove() {
    try {
      await api('DELETE', `/api/applications/${app.id}`);
      notify('Application deleted.');
      onBack();
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  const sections: [Section, string][] = [
    ['overview', 'Overview'], ['resume', app.snapshot ? 'Resume ✓' : 'Resume'], ['kit', Object.keys(app.kit).length ? 'Kit ✓' : 'Kit'],
    ['interview', app.interview ? 'Interview ✓' : 'Interview'], ['timeline', `Timeline (${app.timeline.length})`],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <Button onClick={onBack} label="Back to applications">← Back</Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-black text-white">{app.role || 'Untitled role'}</h2>
          <p className="truncate text-sm text-slate-300">{app.company || '—'}{app.location ? ` · ${app.location}` : ''}
            {app.url && <> · <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">job post ↗</a></>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="app-status">Status</label>
          <select id="app-status" disabled={readOnly} value={app.status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            className={`min-h-11 rounded-lg border px-3 text-xs font-black uppercase tracking-wide sm:min-h-9 ${STATUS_TONES[app.status]}`}>
            {STATUSES.map((s) => <option key={s} value={s} className="bg-slate-900 text-white">{STATUS_LABELS[s]}</option>)}
          </select>
          <ConfirmButton disabled={readOnly} onConfirm={remove} confirmLabel="Delete for good?">Delete</ConfirmButton>
        </div>
      </div>

      <nav aria-label="Application sections" className="flex gap-1 overflow-x-auto">
        {sections.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-black uppercase tracking-wide ${section === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
        ))}
      </nav>

      {section === 'overview' && <Overview key={app.updatedAt} detail={detail} onSaved={onSaved} notify={notify} />}
      {section === 'resume' && <ResumeSection detail={detail} onChanged={load} notify={notify} />}
      {section === 'kit' && <KitSection detail={detail} onSaved={onSaved} notify={notify} />}
      {section === 'interview' && <InterviewSection detail={detail} onSaved={onSaved} notify={notify} />}
      {section === 'timeline' && <TimelineSection app={app} onSaved={onSaved} notify={notify} />}
    </div>
  );
}
