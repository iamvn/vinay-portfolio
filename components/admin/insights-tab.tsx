'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, type Notify } from './ui';

type Submission = { id: number; form: string; fields: Record<string, string>; page: string; createdAt: string };

/** Messages from forms built in Admin → Design. */
function FormMessages({ notify }: { notify: Notify }) {
  const [items, setItems] = useState<Submission[] | null>(null);
  const load = useCallback(() => api<Submission[]>('GET', '/api/forms').then(setItems).catch((error) => notify(describeError(error), 'error')), [notify]);
  useEffect(() => { void load(); }, [load]);
  async function remove(id: number) {
    try { await api('DELETE', `/api/forms/${id}`); setItems((list) => list?.filter((x) => x.id !== id) ?? null); notify('Message deleted.'); }
    catch (error) { notify(describeError(error), 'error'); }
  }
  return (
    <Card title={`Form messages${items ? ` (${items.length})` : ''}`}>
      {!items ? <Loading /> : items.length === 0 ? (
        <p className="text-sm text-slate-500">No messages yet. Add a Form block in Design → Forms; what visitors send appears here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 font-bold text-cyan-200">{item.form}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                {item.page && <span>· from {item.page}</span>}
                <span className="flex-1" />
                <ConfirmButton className="min-h-8 px-2.5 py-1" onConfirm={() => remove(item.id)} confirmLabel="Delete?">Delete</ConfirmButton>
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
                {Object.entries(item.fields).map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="whitespace-pre-wrap break-words text-slate-100">{/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? <a className="text-cyan-300 underline" href={`mailto:${value}`}>{value}</a> : value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type Count = { last7: number; last30: number; total: number };
type Insights = { counts: Record<string, Count>; questions: { detail: string; createdAt: string }[] };
type AssistantStatus = { enabled: boolean; remainingToday?: number; dailyLimit?: number };

const METRICS: { key: string; label: string; hint: string }[] = [
  { key: 'resume_download', label: 'Resume downloads', hint: 'Visitors who downloaded your resume (your own downloads while signed in aren’t counted).' },
  { key: 'contact_email', label: 'Email clicks', hint: 'Clicks on any email link or the X shortcut.' },
  { key: 'contact_copy', label: 'Email copied', hint: 'Uses of the “Copy email” button.' },
  { key: 'contact_linkedin', label: 'LinkedIn clicks', hint: 'Clicks on any LinkedIn link.' },
  { key: 'ask', label: 'Assistant questions', hint: 'Questions asked to “Ask my resume”.' },
];

export function InsightsTab({ notify }: { notify: Notify }) {
  const [data, setData] = useState<Insights | null>(null);
  const [assistant, setAssistant] = useState<AssistantStatus | null>(null);

  const load = useCallback(() => {
    api<Insights>('GET', '/api/insights').then(setData).catch((error) => notify(describeError(error), 'error'));
    api<AssistantStatus>('GET', '/api/ask').then(setAssistant).catch(() => setAssistant(null));
  }, [notify]);

  useEffect(load, [load]);

  if (!data) return <Loading />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Anonymous counts from your site. No names, IPs or cookies are stored.</p>
        <Button view onClick={load}>Refresh</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {METRICS.map(({ key, label, hint }) => {
          const count = data.counts[key] ?? { last7: 0, last30: 0, total: 0 };
          return (
            <div key={key} title={hint} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-white">{count.last7}</p>
              <p className="text-[11px] text-slate-500">last 7 days</p>
              <p className="mt-2 text-xs text-slate-400">{count.last30} · 30 days &nbsp;·&nbsp; {count.total} total</p>
            </div>
          );
        })}
      </div>

      <Card title="Page views">
        <p className="text-sm leading-6 text-slate-400">
          Visits, countries, devices and where visitors came from (LinkedIn, Google, job sites…) are in{' '}
          <b className="text-slate-200">Vercel → your project → Analytics</b>. Admin and login pages aren’t counted.
        </p>
      </Card>

      <Card title="Ask my resume">
        <p className="mb-4 text-sm text-slate-400">
          {assistant === null ? 'Checking…'
            : assistant.enabled
              ? `On. ${assistant.remainingToday ?? '?'} of ${assistant.dailyLimit ?? '?'} questions left today (the daily limit keeps costs predictable).`
              : 'Off. An admin can turn it on in the AI assistant tab: add a provider (Anthropic, OpenAI, Gemini…) with an API key.'}
        </p>
        <h4 className="mb-2 text-[11px] font-black uppercase tracking-[.2em] text-lime-300/80">Latest questions</h4>
        {data.questions.length === 0 ? (
          <p className="text-sm text-slate-500">No questions yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.questions.map((question, index) => (
              <li key={index} className="py-2.5">
                <p className="text-sm text-slate-200">{question.detail}</p>
                <p className="text-[11px] text-slate-500">{new Date(question.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <FormMessages notify={notify} />
    </div>
  );
}
