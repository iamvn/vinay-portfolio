'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, Loading, type Notify } from './ui';

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
    </div>
  );
}
