'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, TextArea, inputClass, useReadOnly, type Notify } from './ui';
import { CATEGORIES, DIFFICULTIES, LEVELS, OUTCOMES, TAG_SUGGESTIONS, normalizeTag, type Post, type PostInput } from '@/lib/community/types';
import type { Application, ApplicationSummary } from '@/lib/career/types';

/**
 * Admin → Community: share interview experiences on the platform's public community board (/community),
 * so other job seekers can prepare. Every site's posts go to the same board; this tab lists this site's own.
 */

type Author = { name: string; headline: string };
const EMPTY: PostInput = {
  title: '', company: '', role: '', location: '', category: 'Frontend', level: '', outcome: '', difficulty: '', interviewedOn: '', tags: [],
  summary: '', rounds: [], questions: [], preparation: '', resources: [], authorName: '', authorHeadline: '', anonymous: false, published: true,
};
const STATUS: Record<Post['status'], [string, string]> = {
  published: ['On the board', 'bg-lime-300/10 text-lime-200'],
  draft: ['Draft', 'bg-white/5 text-slate-300'],
  hidden: ['Hidden by the platform owner', 'bg-red-400/10 text-red-200'],
};
const date = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** A best guess at the field from the role's name (you can change it). */
function guessCategory(role: string): PostInput['category'] {
  const r = role.toLowerCase();
  if (/full.?stack/.test(r)) return 'Full-stack';
  if (/front.?end|react|ui engineer|web developer/.test(r)) return 'Frontend';
  if (/back.?end|node|java|python|golang|api/.test(r)) return 'Backend';
  if (/android|ios|mobile|react native|flutter/.test(r)) return 'Mobile';
  if (/devops|sre|cloud|platform engineer|infra/.test(r)) return 'DevOps / Cloud';
  if (/data|machine learning|\bml\b|\bai\b/.test(r)) return 'Data / ML / AI';
  if (/qa|test|sdet/.test(r)) return 'QA / Testing';
  if (/interior/.test(r)) return 'Interior design';
  if (/architect(?!ure)/.test(r) && !/software|solution/.test(r)) return 'Architecture';
  if (/ux|ui\/ux|product designer/.test(r)) return 'UI / UX design';
  if (/product manager|\bpm\b/.test(r)) return 'Product';
  return 'Other';
}

const OUTCOME_FROM_STATUS: Partial<Record<Application['status'], PostInput['outcome']>> = {
  offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrew', interview: 'In progress', applied: 'In progress',
};

/** Turns one of your applications (with its Prep notes) into a draft post. */
function fromApplication(app: Application, base: PostInput): PostInput {
  const asked = app.prep.questions.filter((q) => q.kind === 'asked');
  const months = asked.map((q) => q.date.slice(0, 7)).filter(Boolean).sort();
  const roundNames = [...new Set(asked.map((q) => q.round).filter(Boolean))];
  return {
    ...base,
    title: `${app.role || 'Interview'}${app.company ? ` at ${app.company}` : ''}`.slice(0, 140),
    company: app.company, role: app.role, location: app.location,
    category: guessCategory(app.role),
    outcome: OUTCOME_FROM_STATUS[app.status] ?? '',
    interviewedOn: months[0] ?? '',
    tags: (app.analysis?.required ?? []).slice(0, 6).map((k) => k.label),
    rounds: roundNames.map((name) => ({ name, details: '' })),
    questions: asked.map((q) => ({ question: q.question, round: q.round, answer: q.answer })),
    preparation: app.prep.notes,
    resources: app.prep.links.map((l) => ({ label: l.label, url: l.url })),
  };
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState('');
  const add = (value: string) => {
    const tag = normalizeTag(value.replace(/^#/, ''));
    if (tag && tags.length < 12 && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...tags, tag]);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); }
    else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 p-2">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-lime-300/15 px-2 py-1 text-xs font-bold text-lime-100">
          #{tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="text-lime-200/70 hover:text-white">✕</button>
        </span>
      ))}
      <input className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-slate-500" list="community-tags" value={text}
        placeholder={tags.length ? 'Add another…' : 'React, Node.js, System design… (Enter to add)'} aria-label="Add a topic"
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))} onKeyDown={onKey} onBlur={() => text && add(text)} />
      <datalist id="community-tags">{TAG_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
    </div>
  );
}

function Remove({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={label} className="min-h-10 shrink-0 px-2 text-xs font-bold text-red-300 hover:text-red-200">Remove</button>;
}

function PostEditor({ initial, editingId, applications, onDone, onCancel, notify }: {
  initial: PostInput; editingId: string | null; applications: boolean; onDone: (post: Post) => void; onCancel: () => void; notify: Notify;
}) {
  const [form, setForm] = useState<PostInput>(initial);
  const [busy, setBusy] = useState(false);
  const [apps, setApps] = useState<ApplicationSummary[] | null>(null);
  const set = <K extends keyof PostInput>(key: K, value: PostInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!applications || editingId) return;
    let live = true;
    api<ApplicationSummary[]>('GET', '/api/applications').then((list) => { if (live) setApps(list); }).catch(() => { if (live) setApps([]); });
    return () => { live = false; };
  }, [applications, editingId]);

  async function prefill(id: string) {
    if (!id) return;
    try {
      const { application } = await api<{ application: Application }>('GET', `/api/applications/${id}`);
      setForm((f) => fromApplication(application, f));
      notify(`Filled in from ${application.role || 'the application'}${application.company ? ` at ${application.company}` : ''}. Check it before you post.`);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  async function save() {
    const clean: PostInput = {
      ...form,
      rounds: form.rounds.filter((r) => r.name.trim()),
      questions: form.questions.filter((q) => q.question.trim()),
      resources: form.resources.filter((r) => r.url.trim()),
    };
    const bad = clean.resources.find((r) => !/^https?:\/\/\S+\.\S+/i.test(r.url.trim()));
    if (bad) { notify(`“${bad.url}” isn’t a full web address. Links need to start with https://`, 'error'); return; }
    setBusy(true);
    try {
      const post = editingId ? await api<Post>('PUT', `/api/community/${editingId}`, clean) : await api<Post>('POST', '/api/community', clean);
      notify(post.status === 'published' ? (editingId ? 'Post updated on the community board.' : 'Posted to the community board.') : 'Saved as a draft.');
      onDone(post);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const select = inputClass;
  return (
    <div className="space-y-4">
      <Card title={editingId ? 'Edit your post' : 'Share an interview experience'} actions={<Button onClick={onCancel}>Cancel</Button>}>
        <p className="text-sm leading-6 text-slate-300">
          Help other job seekers prepare: the process, the questions you were asked, and what you used to prepare. It appears on the public
          community board with your name (or anonymously) and the date.
        </p>
        {apps && apps.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Start from one of your applications" hint="Copies the company, role, the questions you noted in Prep notes, your prep material and links.">
              <select className={`${select} sm:w-96`} defaultValue="" onChange={(e) => prefill(e.target.value)}>
                <option value="">Choose an application…</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.role || 'Untitled role'}{a.company ? ` · ${a.company}` : ''}{a.prepQuestions ? ` (${a.prepQuestions} questions)` : ''}</option>)}
              </select>
            </Field>
          </div>
        )}
      </Card>

      <Card title="The basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title" hint="e.g. “Senior Frontend Engineer at Acme: 4 rounds, offer”.">
              <input className={inputClass} value={form.title} maxLength={140} onChange={(e) => set('title', e.target.value)} />
            </Field>
          </div>
          <Field label="Company"><input className={inputClass} value={form.company} maxLength={100} onChange={(e) => set('company', e.target.value)} /></Field>
          <Field label="Role"><input className={inputClass} value={form.role} maxLength={120} onChange={(e) => { set('role', e.target.value); }} /></Field>
          <Field label="Location (optional)"><input className={inputClass} value={form.location} maxLength={100} placeholder="Bengaluru, Remote…" onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Field">
            <select className={select} value={form.category} onChange={(e) => set('category', e.target.value as PostInput['category'])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Level">
            <select className={select} value={form.level} onChange={(e) => set('level', e.target.value as PostInput['level'])}>
              <option value="">Not saying</option>{LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Outcome">
            <select className={select} value={form.outcome} onChange={(e) => set('outcome', e.target.value as PostInput['outcome'])}>
              <option value="">Not saying</option>{OUTCOMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Difficulty">
            <select className={select} value={form.difficulty} onChange={(e) => set('difficulty', e.target.value as PostInput['difficulty'])}>
              <option value="">Not saying</option>{DIFFICULTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="When (month)"><input className={inputClass} type="month" value={form.interviewedOn} onChange={(e) => set('interviewedOn', e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Topics" group hint="Up to 12. They become filters on the board (React, Node.js, System design, AutoCAD…).">
              <TagInput tags={form.tags} onChange={(tags) => set('tags', tags)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Your experience">
        <TextArea value={form.summary} onChange={(v) => set('summary', v)} rows={6} placeholder="How it went overall: the process, what surprised you, tips for the next person." />
      </Card>

      <Card title={`Rounds (${form.rounds.length})`} actions={<Button onClick={() => set('rounds', [...form.rounds, { name: '', details: '' }])}>+ Add round</Button>}>
        {form.rounds.length === 0 ? <p className="text-sm text-slate-500">e.g. “Online test”, “Technical: React”, “System design”, “HR”.</p> : (
          <ol className="space-y-2">
            {form.rounds.map((round, i) => (
              <li key={i} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-start">
                <input className={inputClass} value={round.name} placeholder={`Round ${i + 1}`} aria-label={`Round ${i + 1} name`} maxLength={80}
                  onChange={(e) => set('rounds', form.rounds.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                <textarea className={inputClass} rows={2} value={round.details} placeholder="What happened in this round" aria-label={`Round ${i + 1} details`} maxLength={2000}
                  onChange={(e) => set('rounds', form.rounds.map((r, j) => (j === i ? { ...r, details: e.target.value } : r)))} />
                <Remove label={`Remove round ${i + 1}`} onClick={() => set('rounds', form.rounds.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title={`Questions asked (${form.questions.length})`} actions={<Button onClick={() => set('questions', [...form.questions, { question: '', round: '', answer: '' }])}>+ Add question</Button>}>
        <datalist id="community-rounds">{form.rounds.map((r) => r.name).filter(Boolean).map((r) => <option key={r} value={r} />)}</datalist>
        {form.questions.length === 0 ? <p className="text-sm text-slate-500">The questions they asked, with how you answered or a tip.</p> : (
          <ul className="space-y-2">
            {form.questions.map((q, i) => (
              <li key={i} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-2.5">
                <div className="flex gap-2">
                  <textarea className={inputClass} rows={2} value={q.question} placeholder="The question" aria-label={`Question ${i + 1}`} maxLength={1000}
                    onChange={(e) => set('questions', form.questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
                  <Remove label={`Remove question ${i + 1}`} onClick={() => set('questions', form.questions.filter((_, j) => j !== i))} />
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                  <input className={inputClass} list="community-rounds" value={q.round} placeholder="Round (optional)" aria-label={`Question ${i + 1} round`} maxLength={80}
                    onChange={(e) => set('questions', form.questions.map((x, j) => (j === i ? { ...x, round: e.target.value } : x)))} />
                  <textarea className={inputClass} rows={2} value={q.answer} placeholder="How you answered, or a tip (optional)" aria-label={`Question ${i + 1} answer`} maxLength={4000}
                    onChange={(e) => set('questions', form.questions.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="How you prepared">
        <TextArea value={form.preparation} onChange={(v) => set('preparation', v)} rows={5} placeholder="What you studied, for how long, what helped most." />
        <div className="mt-3 space-y-2">
          {form.resources.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center">
              <input className={inputClass} value={r.label} placeholder="Name (optional)" aria-label={`Resource ${i + 1} name`} maxLength={120}
                onChange={(e) => set('resources', form.resources.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className={inputClass} type="url" inputMode="url" value={r.url} placeholder="https://…" aria-label={`Resource ${i + 1} link`}
                onChange={(e) => set('resources', form.resources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <Remove label={`Remove resource ${i + 1}`} onClick={() => set('resources', form.resources.filter((_, j) => j !== i))} />
            </div>
          ))}
          <Button onClick={() => set('resources', [...form.resources, { label: '', url: '' }])}>+ Add a link (course, article, doc, video)</Button>
        </div>
      </Card>

      <Card title="Shown as">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputClass} value={form.authorName} maxLength={80} disabled={form.anonymous} onChange={(e) => set('authorName', e.target.value)} /></Field>
          <Field label="Headline (optional)"><input className={inputClass} value={form.authorHeadline} maxLength={120} disabled={form.anonymous} placeholder="Senior Software Engineer" onChange={(e) => set('authorHeadline', e.target.value)} /></Field>
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 accent-lime-300" checked={form.anonymous} onChange={(e) => set('anonymous', e.target.checked)} />
          <span><span className="block text-sm font-bold text-slate-100">Post anonymously</span>
            <span className="block text-xs text-slate-400">Your name, headline and portfolio link aren’t shown. The platform owner can still see which site posted it.</span></span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 accent-lime-300" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
          <span><span className="block text-sm font-bold text-slate-100">Publish on the community board</span>
            <span className="block text-xs text-slate-400">Untick to keep it as a draft only people on this site can see.</span></span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="primary" disabled={busy || !form.title.trim() || !form.company.trim() || !form.role.trim()} onClick={save}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : form.published ? 'Post to the board' : 'Save draft'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

export function CommunityTab({ notify, canUseApplications }: { notify: Notify; canUseApplications: boolean }) {
  const readOnly = useReadOnly();
  const [data, setData] = useState<{ posts: Post[]; author: Author } | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; initial: PostInput } | null>(null);

  const load = useCallback(() => api<{ posts: Post[]; author: Author }>('GET', '/api/community', undefined, { fresh: true }).then(setData).catch((error) => notify(describeError(error), 'error')), [notify]);
  useEffect(() => { void load(); }, [load]);

  async function remove(post: Post) {
    try {
      await api('DELETE', `/api/community/${post.id}`);
      notify('Post deleted.');
      void load();
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  if (!data) return <Loading />;
  if (editing) {
    return <PostEditor key={editing.id ?? 'new'} initial={editing.initial} editingId={editing.id} applications={canUseApplications} notify={notify}
      onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void load(); }} />;
  }
  const startNew = () => setEditing({ id: null, initial: { ...EMPTY, authorName: data.author.name, authorHeadline: data.author.headline } });

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title="Community" actions={<>
        <a href="/community" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60 sm:min-h-0 sm:py-2">Open the board ↗</a>
        <Button tone="primary" disabled={readOnly} onClick={startNew}>+ Share an experience</Button>
      </>}>
        <p className="text-sm leading-6 text-slate-300">
          A public, read-only board where everyone on this platform shares interview experiences: the rounds, the questions asked and how they prepared,
          searchable by company, field and topic. Share yours here; anyone can read them at <b className="text-slate-100">/community</b>.
        </p>
      </Card>

      <Card title={`This site’s posts (${data.posts.length})`}>
        {data.posts.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing shared yet. <b className="text-slate-200">+ Share an experience</b> to post your first one.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.posts.map((post) => {
              const [label, tone] = STATUS[post.status];
              const { id: _id, site: _site, siteName: _siteName, authorUrl: _url, status: _status, createdAt: _c, updatedAt: _u, ...input } = post; // eslint-disable-line @typescript-eslint/no-unused-vars
              return (
                <li key={post.id} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white">{post.title}</p>
                    <p className="text-xs text-slate-400">{post.company} · {post.role} · {post.category} · {post.questions.length} question{post.questions.length === 1 ? '' : 's'}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className={`rounded px-1.5 py-0.5 font-bold ${tone}`}>{label}</span>
                      <span>Posted {date(post.createdAt)}{post.updatedAt.slice(0, 10) !== post.createdAt.slice(0, 10) ? ` · updated ${date(post.updatedAt)}` : ''}</span>
                      <span>{post.anonymous ? 'Anonymous' : `as ${post.authorName || data.author.name}`}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.status === 'published' && <a href={`/community/${post.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 text-xs font-bold text-cyan-200 hover:border-cyan-300/60 sm:min-h-9">View ↗</a>}
                    <Button disabled={readOnly} onClick={() => setEditing({ id: post.id, initial: input })}>Edit</Button>
                    <ConfirmButton disabled={readOnly} onConfirm={() => remove(post)} confirmLabel="Delete for good?">Delete</ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
