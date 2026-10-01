'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, describeError } from './api';
import { Button, Card, Loading, inputClass, type Notify } from './ui';

type Kind = 'user.login' | 'user.added' | 'user.updated' | 'user.removed' | 'site.created' | 'site.updated' | 'site.deleted';
type Activity = { id: number; at: string; site: string; siteName: string; actor: string; kind: Kind; details: Record<string, string> };
type Page = { items: Activity[]; total: number; sites: { site: string; siteName: string }[] };

const PAGE_SIZE = 25;

const KIND_LABELS: Record<Kind, string> = {
  'user.login': 'Signed in',
  'user.added': 'Added user',
  'user.updated': 'Changed user',
  'user.removed': 'Removed user',
  'site.created': 'Created site',
  'site.updated': 'Changed site',
  'site.deleted': 'Deleted site',
};
const KIND_TONES: Record<Kind, string> = {
  'user.login': 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  'user.added': 'border-lime-300/30 bg-lime-300/10 text-lime-200',
  'user.updated': 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200',
  'user.removed': 'border-red-400/30 bg-red-400/10 text-red-200',
  'site.created': 'border-lime-300/30 bg-lime-300/10 text-lime-200',
  'site.updated': 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200',
  'site.deleted': 'border-red-400/30 bg-red-400/10 text-red-200',
};

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'user.', label: 'All user activity' },
  { value: 'user.login', label: '· Sign-ins' },
  { value: 'user.added', label: '· Users added' },
  { value: 'user.updated', label: '· Users changed' },
  { value: 'user.removed', label: '· Users removed' },
  { value: 'site.', label: 'All site activity' },
  { value: 'site.created', label: '· Sites created' },
  { value: 'site.updated', label: '· Sites changed' },
  { value: 'site.deleted', label: '· Sites deleted' },
];

const person = (d: Record<string, string>) => (d.name ? <><b className="text-slate-100">{d.name}</b> <span className="text-slate-400">{d.email}</span></> : <b className="text-slate-100">{d.email}</b>);
const site = (d: Record<string, string>) => <><b className="text-slate-100">{d.name || d.slug}</b>{d.name && d.slug && <span className="text-slate-400"> ({d.domain ?? d.slug})</span>}</>;

/** The "Details" cell: who or what was affected, and how. */
function details(item: Activity): ReactNode {
  const d = item.details;
  switch (item.kind) {
    case 'user.login': return <span className="text-slate-400">as {d.role === 'admin' ? 'admin' : 'editor'}</span>;
    case 'user.added': return <>{person(d)} <span className="text-slate-400">as {d.role === 'admin' ? 'admin' : 'editor'}{d.access ? `, ${d.access}` : ''}</span></>;
    case 'user.removed': return <>{person(d)}</>;
    case 'user.updated': {
      const changes = [d.role && `role → ${d.role}`, d.renamed !== undefined && `name → ${d.renamed || '(empty)'}`, d.tabs && `tabs → ${d.tabs}`, d.readOnly && `read-only ${d.readOnly}`].filter(Boolean);
      return <>{person(d)} <span className="text-slate-400">{changes.join(' · ')}</span></>;
    }
    case 'site.created': return <>{site(d)} <span className="text-slate-400">owner {d.ownerEmail}</span></>;
    case 'site.deleted': return <>{site(d)}</>;
    case 'site.updated': {
      const changes = [
        d.renamed && `renamed ${d.renamed}`, d.status, d.domain && `domain → ${d.domain}`,
        d.canAddUsers && `add users ${d.canAddUsers}`, d.canAddSites && `create sites ${d.canAddSites}`, d.siteLimit && `site limit → ${d.siteLimit}`,
      ].filter(Boolean);
      return <>{site(d)} <span className="text-slate-400">{changes.join(' · ')}</span></>;
    }
    default: return null;
  }
}

function when(iso: string) {
  const date = new Date(iso);
  return { short: date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), full: date.toLocaleString() };
}

/** Activity logs (main site's admins only): sign-ins and changes on other sites, and changes made to sites. */
export function ActivityTab({ notify }: { notify: Notify }) {
  const [filters, setFilters] = useState({ site: '', kind: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<(Page & { key: string }) | null>(null);

  // The query for the current filters and page; the table dims while a different one is loading.
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
  if (filters.site) params.set('site', filters.site);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.q) params.set('q', filters.q);
  const key = params.toString();
  const loading = !data || data.key !== key;

  const load = useCallback((fresh = false) => (
    api<Page>('GET', `/api/platform/activity?${key}`, undefined, { fresh })
      .then((result) => setData({ ...result, key }))
      .catch((error) => notify(describeError(error), 'error'))
  ), [key, notify]);

  useEffect(() => { void load(); }, [load]);

  // Search as you type, once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => { setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })); setPage(0); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const setFilter = (key: 'site' | 'kind', value: string) => { setFilters((f) => ({ ...f, [key]: value })); setPage(0); };
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const filtered = Boolean(filters.site || filters.kind || filters.q);
  const select = `${inputClass} sm:w-auto`;

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title="Activity logs">
        <p className="mb-4 text-sm leading-6 text-slate-300">
          What happens on the sites you host: sign-ins, users added, changed or removed, and sites created, changed or deleted,
          including changes you make to sites from the Sites tab. Newest first.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
          <input className={inputClass} type="search" placeholder="Search people, emails, sites…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search activity" />
          <select className={select} value={filters.site} onChange={(e) => setFilter('site', e.target.value)} aria-label="Site">
            <option value="">All sites</option>
            {data?.sites.map((s) => <option key={s.site} value={s.site}>{s.siteName || s.site}</option>)}
          </select>
          <select className={select} value={filters.kind} onChange={(e) => setFilter('kind', e.target.value)} aria-label="Type of activity">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <Button view onClick={() => load(true)} label="Refresh the log">↻ Refresh</Button>
        </div>
      </Card>

      <Card title={data ? `${data.total} ${data.total === 1 ? 'entry' : 'entries'}${filtered ? ' (filtered)' : ''}` : 'Entries'}>
        {!data ? <Loading /> : data.items.length === 0 ? (
          <p className="text-sm text-slate-400">{filtered ? 'Nothing matches these filters.' : 'Nothing yet. Sign-ins and changes on other sites will appear here.'}</p>
        ) : (
          <div className={`-mx-4 overflow-x-auto px-4 transition-opacity sm:mx-0 sm:px-0 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th scope="col" className="py-2 pr-4 font-black">When</th>
                  <th scope="col" className="py-2 pr-4 font-black">Site</th>
                  <th scope="col" className="py-2 pr-4 font-black">Who</th>
                  <th scope="col" className="py-2 pr-4 font-black">Action</th>
                  <th scope="col" className="py-2 font-black">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const time = when(item.at);
                  return (
                    <tr key={item.id} className="border-b border-white/5 align-top transition-colors hover:bg-white/[.03]">
                      <td className="whitespace-nowrap py-2.5 pr-4 text-xs tabular-nums text-slate-400"><time dateTime={item.at} title={time.full}>{time.short}</time></td>
                      <td className="py-2.5 pr-4">
                        <button type="button" className="text-left font-bold text-lime-200 hover:underline" onClick={() => setFilter('site', item.site)} title={`Only ${item.siteName || item.site}`}>
                          {item.siteName || item.site}
                        </button>
                      </td>
                      <td className="max-w-[14rem] py-2.5 pr-4 text-slate-200"><span className="break-words">{item.actor}</span></td>
                      <td className="whitespace-nowrap py-2.5 pr-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${KIND_TONES[item.kind] ?? KIND_TONES['site.updated']}`}>{KIND_LABELS[item.kind] ?? item.kind}</span>
                      </td>
                      <td className="py-2.5 text-slate-300">{details(item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <Button view disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>← Newer</Button>
              <Button view disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>Older →</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
