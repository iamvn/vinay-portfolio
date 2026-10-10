'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, describeError } from '@/components/admin/api';
import { Button, Card, Field, Loading, SaveBar, TextArea, inputClass, useReadOnly, type Notify } from '@/components/admin/ui';
import { PREP_ROUNDS, type Prep, type PrepLink, type PrepQuestion } from '@/lib/career/types';
import type { BankLink, BankQuestion } from '@/lib/career/prep';

/**
 * Your own interview notes ("Prep notes"): the questions you were asked or want to practise, with your answers;
 * free-form prep material; and links to notes kept elsewhere (Notion, Google Drive…). Used per application and
 * for the general prep in the question bank.
 */

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, '').slice(0, 16);
const KIND_LABEL: Record<PrepQuestion['kind'], string> = { asked: 'Asked', practice: 'To practise' };
const shortDate = (d: string) => (d ? new Date(`${d}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const today = () => new Date().toISOString().slice(0, 10);

/** "Notion", "Google Drive"… for a link, so a list of links is easy to scan. */
export function linkService(url: string): string {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  if (/(^|\.)notion\.(so|site)$/.test(host)) return 'Notion';
  if (host === 'docs.google.com') return 'Google Docs';
  if (host === 'drive.google.com') return 'Google Drive';
  if (/(^|\.)github\.com$/.test(host)) return 'GitHub';
  if (/(^|\.)dropbox\.com$/.test(host)) return 'Dropbox';
  if (/sharepoint\.com$|onedrive\.live\.com$|^1drv\.ms$/.test(host)) return 'OneDrive';
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return 'YouTube';
  if (/(^|\.)leetcode\.com$/.test(host)) return 'LeetCode';
  if (/(^|\.)obsidian\.md$/.test(host)) return 'Obsidian';
  return host;
}
const isWebLink = (url: string) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url.trim());
const linkTitle = (link: Pick<PrepLink, 'label' | 'url'>) => link.label.trim() || linkService(link.url) || link.url;

function QuestionEditor({ q, onChange, onRemove, open, readOnly }: { q: PrepQuestion; onChange: (q: PrepQuestion) => void; onRemove: () => void; open: boolean; readOnly: boolean }) {
  const set = <K extends keyof PrepQuestion>(key: K, value: PrepQuestion[K]) => onChange({ ...q, [key]: value });
  return (
    <li>
      <details open={open} className="group rounded-xl border border-white/10 bg-black/20">
        <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="mt-0.5 text-xs text-slate-500 transition group-open:rotate-90">▸</span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-bold ${q.question.trim() ? 'text-slate-100' : 'italic text-slate-500'}`}>{q.question.trim() || 'New question'}</span>
            <span className="mt-1 flex flex-wrap gap-1 text-[10px] font-bold">
              <span className={`rounded px-1.5 py-0.5 ${q.kind === 'asked' ? 'bg-cyan-300/10 text-cyan-200' : 'bg-purple-300/10 text-purple-200'}`}>{KIND_LABEL[q.kind]}</span>
              {q.round && <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-300">{q.round}</span>}
              {q.date && <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-400">{shortDate(q.date)}</span>}
              {q.practiced && <span className="rounded bg-lime-300/10 px-1.5 py-0.5 text-lime-200">Practised ✓</span>}
              {!q.answer.trim() && <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-500">No answer yet</span>}
            </span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-white/5 px-3 pb-3 pt-3">
          <Field label="Question">
            <textarea className={`${inputClass} min-h-16`} rows={2} readOnly={readOnly} value={q.question} placeholder="“How would you design a rate limiter?”"
              onChange={(e) => set('question', e.target.value)} aria-label="Question" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
            <div>
              <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-400">Type</span>
              <div className="flex gap-1" role="radiogroup" aria-label="Type">
                {(['asked', 'practice'] as const).map((kind) => (
                  <button key={kind} type="button" role="radio" aria-checked={q.kind === kind} disabled={readOnly} onClick={() => set('kind', kind)}
                    className={`min-h-10 rounded-lg px-3 text-xs font-bold ${q.kind === kind ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{KIND_LABEL[kind]}</button>
                ))}
              </div>
            </div>
            <Field label="Round">
              <input className={inputClass} list="prep-rounds" readOnly={readOnly} value={q.round} placeholder="Technical, HR…" onChange={(e) => set('round', e.target.value)} aria-label="Round" />
            </Field>
            <Field label="Date">
              <input className={inputClass} type="date" readOnly={readOnly} value={q.date} onChange={(e) => set('date', e.target.value)} aria-label="Date" />
            </Field>
          </div>
          <Field label="Your answer and notes" hint="What you said, what you’d say better next time, follow-ups they asked.">
            <TextArea value={q.answer} onChange={(value) => set('answer', value)} rows={5} placeholder="Situation, what I did, the result…" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" className="size-4 accent-lime-300" disabled={readOnly} checked={q.practiced} onChange={(e) => set('practiced', e.target.checked)} />
              Practised
            </label>
            <span className="flex-1" />
            {!readOnly && <button type="button" onClick={onRemove} className="min-h-10 text-xs font-bold text-red-300 hover:text-red-200">Remove question</button>}
          </div>
        </div>
      </details>
    </li>
  );
}

/** Edits one set of prep notes; nothing is saved until "Save prep notes". */
export function PrepEditor({ value, onSave, notify, scope }: { value: Prep; onSave: (prep: Prep) => Promise<void>; notify: Notify; scope: 'application' | 'general' }) {
  const readOnly = useReadOnly();
  const [prep, setPrep] = useState<Prep>(value);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(prep) !== JSON.stringify(value);

  const addQuestion = (kind: PrepQuestion['kind']) => {
    const q: PrepQuestion = { id: newId(), kind, question: '', answer: '', round: '', date: kind === 'asked' ? today() : '', practiced: false };
    setPrep((p) => ({ ...p, questions: [q, ...p.questions] }));
    setOpened((o) => new Set(o).add(q.id));
  };
  const updateQuestion = (q: PrepQuestion) => setPrep((p) => ({ ...p, questions: p.questions.map((x) => (x.id === q.id ? q : x)) }));
  const removeQuestion = (id: string) => setPrep((p) => ({ ...p, questions: p.questions.filter((x) => x.id !== id) }));
  const addLink = () => setPrep((p) => ({ ...p, links: [...p.links, { id: newId(), label: '', url: '' }] }));
  const updateLink = (link: PrepLink) => setPrep((p) => ({ ...p, links: p.links.map((x) => (x.id === link.id ? link : x)) }));
  const removeLink = (id: string) => setPrep((p) => ({ ...p, links: p.links.filter((x) => x.id !== id) }));

  const badLinks = prep.links.filter((l) => l.url.trim() && !isWebLink(l.url));

  async function save() {
    if (badLinks.length) { notify('Some links aren’t full web addresses. They need to start with https://', 'error'); return; }
    // Empty questions and links are simply left out.
    const clean: Prep = {
      ...prep,
      questions: prep.questions.filter((q) => q.question.trim()).map((q) => ({ ...q, question: q.question.trim() })),
      links: prep.links.filter((l) => l.url.trim()).map((l) => ({ ...l, url: l.url.trim(), label: l.label.trim() })),
    };
    setBusy(true);
    try {
      await onSave(clean);
      setPrep(clean);
      notify('Prep notes saved.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const asked = prep.questions.filter((q) => q.kind === 'asked').length;
  return (
    <div className="space-y-4">
      <datalist id="prep-rounds">{PREP_ROUNDS.map((r) => <option key={r} value={r} />)}</datalist>
      <Card title={`Questions (${prep.questions.length})`} actions={!readOnly && (
        <>
          <Button tone="primary" onClick={() => addQuestion('asked')}>+ Question I was asked</Button>
          <Button onClick={() => addQuestion('practice')}>+ To practise</Button>
        </>
      )}>
        <p className="mb-3 text-sm leading-6 text-slate-400">
          {scope === 'application'
            ? 'Write down what they asked in each round, with your answer. Everything here also shows up in the Question bank, so before your next interview you can practise all of it in one place.'
            : 'Questions that aren’t tied to one job: ones you get everywhere, or topics you want to practise.'}
          {asked > 0 && scope === 'application' ? ` ${asked} asked so far.` : ''}
        </p>
        {prep.questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-500">No questions yet.</p>
        ) : (
          <ul className="space-y-2">
            {prep.questions.map((q) => (
              <QuestionEditor key={q.id} q={q} open={opened.has(q.id)} readOnly={readOnly} onChange={updateQuestion} onRemove={() => removeQuestion(q.id)} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Prep material">
        <Field label="Notes" hint="Topics to revise, STAR stories, things to ask them, salary notes… Plain text.">
          <TextArea value={prep.notes} onChange={(notes) => setPrep((p) => ({ ...p, notes }))} rows={10}
            placeholder={'Revise: React rendering, caching, system design basics\nStories: FDC3 integration (ownership), UI revamp (performance)\nAsk them: team size, release process'} />
        </Field>
      </Card>

      <Card title={`Links (${prep.links.length})`} actions={!readOnly && <Button onClick={addLink}>+ Add link</Button>}>
        <p className="mb-3 text-sm leading-6 text-slate-400">Your notes kept elsewhere: a Notion page, a Google Drive folder, a doc of past questions, a video.</p>
        {prep.links.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-500">No links yet.</p>
        ) : (
          <ul className="space-y-2">
            {prep.links.map((link) => {
              const bad = link.url.trim() !== '' && !isWebLink(link.url);
              return (
                <li key={link.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center">
                  <input className={inputClass} readOnly={readOnly} value={link.label} placeholder={linkService(link.url) || 'Name (optional)'} aria-label="Link name"
                    onChange={(e) => updateLink({ ...link, label: e.target.value })} />
                  <div className="min-w-0">
                    <input className={`${inputClass} ${bad ? 'border-red-400/70' : ''}`} readOnly={readOnly} type="url" inputMode="url" value={link.url} placeholder="https://www.notion.so/…" aria-label="Link address" aria-invalid={bad}
                      onChange={(e) => updateLink({ ...link, url: e.target.value })} />
                    {bad && <p className="mt-1 text-xs text-red-300">Use the full address, starting with https://</p>}
                  </div>
                  <div className="flex gap-2">
                    {isWebLink(link.url) && <a href={link.url.trim()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-3 text-xs font-bold text-cyan-200 hover:border-cyan-300/60">Open ↗</a>}
                    {!readOnly && <Button tone="danger" onClick={() => removeLink(link.id)} label={`Remove ${linkTitle(link)}`}>Remove</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setPrep(value)} saveLabel="Save prep notes" />
    </div>
  );
}

// ---------- the question bank ----------

type Bank = { questions: BankQuestion[]; links: BankLink[]; general: Prep };
const sourceLabel = (s: { appId: number | null; company: string; role: string }) => (s.appId === null ? 'General prep' : [s.company, s.role].filter(Boolean).join(' · ') || 'Untitled application');

/** Every question and prep link from all applications, plus your general prep, to practise before an interview. */
export function QuestionBank({ notify, onBack, onOpen }: { notify: Notify; onBack: () => void; onOpen: (appId: number) => void }) {
  const readOnly = useReadOnly();
  const [bank, setBank] = useState<Bank | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | PrepQuestion['kind']>('all');
  const [round, setRound] = useState('');
  const [source, setSource] = useState('');
  const [todo, setTodo] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);

  const load = useCallback(() => api<Bank>('GET', '/api/applications/bank', undefined, { fresh: true }).then(setBank).catch((error) => notify(describeError(error), 'error')), [notify]);
  useEffect(() => { void load(); }, [load]);

  const key = (q: BankQuestion) => `${q.appId ?? 'g'}:${q.id}`;
  const shown = useMemo(() => {
    if (!bank) return [];
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    let list = bank.questions.filter((q) =>
      (kind === 'all' || q.kind === kind) && (!round || q.round === round) && (!source || String(q.appId ?? 'general') === source) && (!todo || !q.practiced)
      && words.every((w) => `${q.question} ${q.answer} ${q.company} ${q.role} ${q.round}`.toLowerCase().includes(w)));
    if (order) {
      const rank = new Map(order.map((k, i) => [k, i]));
      list = [...list].sort((a, b) => (rank.get(key(a)) ?? 0) - (rank.get(key(b)) ?? 0));
    }
    return list;
  }, [bank, search, kind, round, source, todo, order]);

  if (!bank) return <Loading />;
  const rounds = [...new Set(bank.questions.map((q) => q.round).filter(Boolean))].sort();
  const sources = [...new Map(bank.questions.map((q) => [String(q.appId ?? 'general'), sourceLabel(q)])).entries()];
  const practised = bank.questions.filter((q) => q.practiced).length;

  function shuffle() {
    const keys = bank!.questions.map(key);
    for (let i = keys.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
    setOrder(keys);
  }
  async function togglePractised(q: BankQuestion, practiced: boolean) {
    setBank((b) => b && { ...b, questions: b.questions.map((x) => (key(x) === key(q) ? { ...x, practiced } : x)) });
    try {
      await api('PATCH', '/api/applications/bank', { appId: q.appId, questionId: q.id, practiced });
    } catch (error) {
      notify(describeError(error), 'error');
      void load();
    }
  }
  async function saveGeneral(prep: Prep) {
    setBank(await api<Bank>('PUT', '/api/applications/bank', { prep }));
  }

  const select = `${inputClass} sm:w-auto`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <Button onClick={onBack} label="Back to applications">← Back</Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-white">Question bank</h2>
          <p className="text-sm text-slate-400">{bank.questions.length} question{bank.questions.length === 1 ? '' : 's'} · {practised} practised · {bank.links.length} link{bank.links.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <Card title="Practise" actions={bank.questions.length > 1 && <Button onClick={shuffle}>Shuffle</Button>}>
        <p className="mb-3 text-sm leading-6 text-slate-400">
          Every question you were asked or want to practise, from all your applications. Answers stay hidden until you open a question, so you can answer it yourself first.
        </p>
        <div className="mb-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <input className={`${inputClass} sm:max-w-xs`} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions and answers" aria-label="Search questions" />
          <select className={select} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type">
            <option value="all">Asked and to practise</option><option value="asked">Asked in interviews</option><option value="practice">To practise</option>
          </select>
          {rounds.length > 0 && (
            <select className={select} value={round} onChange={(e) => setRound(e.target.value)} aria-label="Round">
              <option value="">Every round</option>{rounds.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {sources.length > 1 && (
            <select className={select} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Application">
              <option value="">Every application</option>{sources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          )}
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" className="size-4 accent-lime-300" checked={todo} onChange={(e) => setTodo(e.target.checked)} /> Not practised yet
          </label>
        </div>
        {bank.questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
            No questions yet. Open an application and use <b className="text-slate-200">Prep notes → + Question I was asked</b>, or add general ones below.
          </p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No questions match these filters.</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((q) => (
              <li key={key(q)}>
                <details className="group rounded-xl border border-white/10 bg-black/20">
                  <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="mt-0.5 text-xs text-slate-500 transition group-open:rotate-90">▸</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-100">{q.question}</span>
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400">
                        <span className={q.kind === 'asked' ? 'text-cyan-200' : 'text-purple-200'}>{KIND_LABEL[q.kind]}</span>
                        {q.round && <span>· {q.round}</span>}
                        {q.date && <span>· {shortDate(q.date)}</span>}
                        <span className="text-slate-300">· {sourceLabel(q)}</span>
                        {q.practiced && <span className="font-bold text-lime-200">· Practised ✓</span>}
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-white/5 px-3 pb-3 pt-3 sm:pl-8">
                    {q.answer.trim()
                      ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{q.answer}</p>
                      : <p className="text-sm text-slate-500">No answer written yet.</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-200">
                        <input type="checkbox" className="size-4 accent-lime-300" disabled={readOnly} checked={q.practiced} onChange={(e) => togglePractised(q, e.target.checked)} /> Practised
                      </label>
                      {q.appId !== null && <button type="button" onClick={() => onOpen(q.appId!)} className="min-h-10 text-xs font-bold text-cyan-300 hover:text-white">Open application →</button>}
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`All prep links (${bank.links.length})`}>
        {bank.links.length === 0 ? (
          <p className="text-sm text-slate-500">No links yet. Add your Notion pages or Drive folders in an application’s Prep notes, or under General prep below.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {bank.links.map((link) => (
              <li key={`${link.appId ?? 'g'}:${link.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="min-w-0 font-bold text-cyan-200 hover:underline">{linkTitle(link)} ↗</a>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">{linkService(link.url)}</span>
                <span className="text-xs text-slate-500">{sourceLabel(link)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section aria-label="General prep" className="space-y-2">
        <h3 className="px-1 text-sm font-black uppercase tracking-wider text-lime-300/80">General prep</h3>
        <PrepEditor key={JSON.stringify(bank.general)} value={bank.general} scope="general" notify={notify} onSave={saveGeneral} />
      </section>
    </div>
  );
}
