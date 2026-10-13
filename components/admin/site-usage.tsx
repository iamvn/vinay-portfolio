'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, describeError } from './api';
import { Button, inputClass, type Notify } from './ui';

/**
 * Platform owner (Sites tab): how much each site is used: last sign-in, visitors, content and database
 * usage. Inactive sites can be paused or deleted from here (deleting needs the site's address typed).
 */
type Usage = {
  slug: string; name: string; ownerEmail: string; domain: string | null; status: string; createdAt: string; isMain: boolean;
  lastLogin: { at: string; email: string } | null;
  users: number | null; projects: number | null; views30: number | null; visitors30: number | null; lastView: string | null;
  storageBytes: number | null; rowsRead: number | null; rowsWritten: number | null; error?: string;
};
type Report = { sites: Usage[]; totals: { sites: number; storageBytes: number; rowsRead: number; rowsWritten: number }; usageAvailable: boolean; trackingSince: string | null; generatedAt: string };

const DAY = 86_400_000;
const FILTERS = [['all', 'All'], ['inactive', 'Inactive 30+ days'], ['quiet', 'No visitors in 30 days'], ['paused', 'Paused']] as const;
type Filter = (typeof FILTERS)[number][0];
const SORTS = [['idle', 'Longest inactive'], ['storage', 'Most storage'], ['writes', 'Most writes'], ['name', 'Name']] as const;
type Sort = (typeof SORTS)[number][0];

const bytes = (n: number | null) => (n === null ? '–' : n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);
const count = (n: number | null) => (n === null ? '–' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
const ago = (iso: string | null | undefined) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};
/** Days since the site was last used: the latest sign-in, or since it was created when nobody has signed in. */
const idleDays = (u: Usage) => {
  const last = u.lastLogin?.at ?? u.createdAt;
  return last ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : 0;
};

function SiteRow({ u, onChanged, notify }: { u: Usage; onChanged: () => void; notify: Notify }) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const idle = idleDays(u);
  const inactive = !u.isMain && idle >= 30;
  const run = (method: string, body: unknown, done: string) =>
    api(method, `/api/platform/sites/${u.slug}`, body).then(() => { notify(done); onChanged(); }).catch((error) => notify(describeError(error), 'error'));
  return (
    <li className="py-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_11rem] sm:items-center">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <b className="truncate text-white">{u.name}</b>
            {u.isMain && <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-200">Main</span>}
            {u.status === 'suspended' && <span className="rounded bg-slate-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-300">Paused</span>}
            {inactive && <span className="rounded bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">Inactive {idle}d</span>}
          </p>
          <p className="truncate text-xs text-slate-500">{u.isMain ? 'your site' : u.domain ?? u.slug}{u.ownerEmail ? ` · ${u.ownerEmail}` : ''}</p>
          {u.error && <p className="text-[11px] text-red-300">Couldn&apos;t read everything ({u.error})</p>}
        </div>
        <Stat label="Last sign-in" value={ago(u.lastLogin?.at) ?? 'none recorded'} hint={u.lastLogin?.email} warn={inactive} />
        <Stat label="Visitors 30d" value={count(u.visitors30)} hint={u.lastView ? `last visit ${ago(u.lastView)}` : 'no visits'} warn={!u.isMain && u.visitors30 === 0} />
        <Stat label="Storage" value={bytes(u.storageBytes)} hint={`${count(u.projects)} project${u.projects === 1 ? '' : 's'} · ${count(u.users)} user${u.users === 1 ? '' : 's'}`} />
        <Stat label="This month" value={`${count(u.rowsWritten)} writes`} hint={`${count(u.rowsRead)} reads`} />
        {u.isMain ? <span className="hidden sm:block" /> : (
          <div className="flex gap-2 sm:justify-end">
            <Button onClick={() => run('PATCH', { status: u.status === 'active' ? 'suspended' : 'active' }, u.status === 'active' ? `${u.name} is paused.` : `${u.name} is live again.`)}>
              {u.status === 'active' ? 'Pause' : 'Resume'}
            </Button>
            <Button tone="danger" onClick={() => setDeleting((d) => !d)}>Delete…</Button>
          </div>
        )}
      </div>
      {deleting && (
        <div className="mt-3 space-y-2 rounded-xl border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-100">
          <p>This deletes <b>{u.name}</b>&apos;s site and its whole database (content, users, resumes, visitors). It can&apos;t be undone. A nightly backup, if set up, keeps a copy for 90 days.</p>
          <label className="block text-xs text-red-200">Type <b>{u.slug}</b> to confirm
            <input className={`${inputClass} mt-1`} value={confirm} onChange={(e) => setConfirm(e.target.value.trim())} autoComplete="off" />
          </label>
          <div className="flex gap-2">
            <Button tone="danger" disabled={confirm !== u.slug} onClick={() => run('DELETE', { confirm }, `Deleted ${u.name}.`)}>Delete forever</Button>
            <Button onClick={() => { setDeleting(false); setConfirm(''); }}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function Stat({ label, value, hint, warn = false }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="min-w-0 max-sm:flex max-sm:items-baseline max-sm:gap-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 max-sm:w-24 max-sm:shrink-0">{label}</p>
      <div className="min-w-0">
        <p className={`truncate text-sm font-bold ${warn ? 'text-amber-200' : 'text-slate-100'}`}>{value}</p>
        {hint && <p className="truncate text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function SiteUsage({ notify, onChanged }: { notify: Notify; onChanged: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('idle');
  const fetchReport = useCallback(() => api<Report>('GET', '/api/platform/usage', undefined, { fresh: true })
    .then(setReport).catch((error) => notify(describeError(error), 'error')).finally(() => setLoading(false)), [notify]);
  useEffect(() => { void fetchReport(); }, [fetchReport]);
  const load = () => { setLoading(true); void fetchReport(); };

  const list = useMemo(() => {
    if (!report) return [];
    const rows = report.sites.filter((u) =>
      filter === 'all' ? true
        : filter === 'inactive' ? !u.isMain && idleDays(u) >= 30
          : filter === 'quiet' ? !u.isMain && u.visitors30 === 0
            : u.status === 'suspended');
    const by: Record<Sort, (a: Usage, b: Usage) => number> = {
      idle: (a, b) => idleDays(b) - idleDays(a),
      storage: (a, b) => (b.storageBytes ?? 0) - (a.storageBytes ?? 0),
      writes: (a, b) => (b.rowsWritten ?? 0) - (a.rowsWritten ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...rows].sort((a, b) => Number(b.isMain) - Number(a.isMain) || by[sort](a, b));
  }, [report, filter, sort]);

  if (!report) return <p className="text-sm text-slate-500">{loading ? 'Reading every site…' : 'Usage not loaded.'}</p>;
  const inactive = report.sites.filter((u) => !u.isMain && idleDays(u) >= 30).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['Sites', String(report.totals.sites)], ['Inactive 30+ days', String(inactive)], ['Storage, all sites', report.usageAvailable ? bytes(report.totals.storageBytes) : '–'], ['Writes this month', report.usageAvailable ? count(report.totals.rowsWritten) : '–']].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className={`text-xl font-black ${label.startsWith('Inactive') && inactive ? 'text-amber-200' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold ${filter === id ? 'border-lime-300 bg-lime-300 text-black' : 'border-white/15 text-slate-300 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <select aria-label="Sort" className={`${inputClass} sm:ml-auto sm:!w-52`} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <Button onClick={load} disabled={loading} view>{loading ? 'Refreshing…' : 'Refresh'}</Button>
      </div>
      {list.length ? <ul className="divide-y divide-white/5">{list.map((u) => <SiteRow key={u.slug} u={u} notify={notify} onChanged={() => { load(); onChanged(); }} />)}</ul>
        : <p className="text-sm text-slate-400">No sites match.</p>}
      <p className="text-[11px] text-slate-500">
        &ldquo;Inactive&rdquo; means nobody has signed in for 30 days (or since the site was created).
        {report.trackingSince && <> Sign-ins are recorded since {new Date(report.trackingSince).toLocaleDateString()}; earlier ones weren&apos;t kept.</>}
        {!report.usageAvailable && ' Storage and reads/writes need TURSO_API_TOKEN and TURSO_ORG.'}
        {' '}Updated {new Date(report.generatedAt).toLocaleTimeString()}.
      </p>
    </div>
  );
}
