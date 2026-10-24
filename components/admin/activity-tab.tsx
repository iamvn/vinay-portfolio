'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, inputClass, type Notify } from './ui';
import type { Post } from '@/lib/community/types';

type Kind = 'user.login' | 'user.impersonated' | 'user.added' | 'user.updated' | 'user.removed' | 'site.created' | 'site.updated' | 'site.deleted'
  | 'community.posted' | 'community.updated' | 'community.deleted' | 'community.hidden' | 'community.shown' | 'community.removed' | 'support.requested' | 'support.answered' | 'design.shared' | 'design.unshared' | 'data.cleaned' | 'log.cleared';
type Activity = { id: number; at: string; site: string; siteName: string; actor: string; kind: Kind; details: Record<string, string> };
type Stats = { count: number; oldest: string | null };
type Page = { items: Activity[]; total: number; sites: { site: string; siteName: string }[]; stats?: Stats };

const PAGE_SIZE = 25;

const KIND_LABELS: Record<Kind, string> = {
  'user.login': 'Signed in',
  'user.impersonated': 'Super admin sign-in',
  'user.added': 'Added user',
  'user.updated': 'Changed user',
  'user.removed': 'Removed user',
  'site.created': 'Created site',
  'site.updated': 'Changed site',
  'site.deleted': 'Deleted site',
  'community.posted': 'Posted to community',
  'community.updated': 'Edited community post',
  'community.deleted': 'Deleted community post',
  'community.hidden': 'Hid community post',
  'community.shown': 'Showed community post',
  'community.removed': 'Removed community post',
  'support.requested': 'Sent a request',
  'support.answered': 'Answered a request',
  'design.shared': 'Published a template',
  'design.unshared': 'Unpublished a template',
  'data.cleaned': 'Deleted old data',
  'log.cleared': 'Cleared the log',
};
const KIND_TONES: Record<Kind, string> = {
  'user.login': 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  'user.impersonated': 'border-amber-300/40 bg-amber-300/10 text-amber-100',
  'user.added': 'border-lime-300/30 bg-lime-300/10 text-lime-200',
  'user.updated': 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200',
  'user.removed': 'border-red-400/30 bg-red-400/10 text-red-200',
  'site.created': 'border-lime-300/30 bg-lime-300/10 text-lime-200',
  'site.updated': 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200',
  'site.deleted': 'border-red-400/30 bg-red-400/10 text-red-200',
  'community.posted': 'border-purple-300/30 bg-purple-300/10 text-purple-200',
  'community.updated': 'border-purple-300/30 bg-purple-300/10 text-purple-200',
  'community.deleted': 'border-red-400/30 bg-red-400/10 text-red-200',
  'community.hidden': 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200',
  'community.shown': 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200',
  'community.removed': 'border-red-400/30 bg-red-400/10 text-red-200',
  'support.requested': 'border-amber-300/30 bg-amber-300/10 text-amber-200',
  'support.answered': 'border-lime-300/30 bg-lime-300/10 text-lime-200',
  'design.shared': 'border-purple-300/30 bg-purple-300/10 text-purple-200',
  'design.unshared': 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  'data.cleaned': 'border-amber-300/30 bg-amber-300/10 text-amber-200',
  'log.cleared': 'border-slate-400/30 bg-slate-400/10 text-slate-200',
};

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'user.', label: 'All user activity' },
  { value: 'user.login', label: '· Sign-ins' },
  { value: 'user.impersonated', label: '· Super admin sign-ins' },
  { value: 'user.added', label: '· Users added' },
  { value: 'user.updated', label: '· Users changed' },
  { value: 'user.removed', label: '· Users removed' },
  { value: 'site.', label: 'All site activity' },
  { value: 'site.created', label: '· Sites created' },
  { value: 'site.updated', label: '· Sites changed' },
  { value: 'site.deleted', label: '· Sites deleted' },
  { value: 'community.', label: 'All community activity' },
  { value: 'community.posted', label: '· Posts shared' },
  { value: 'community.updated', label: '· Posts edited' },
  { value: 'community.deleted', label: '· Posts deleted by their site' },
  { value: 'community.hidden', label: '· Posts hidden by you' },
  { value: 'community.removed', label: '· Posts removed by you' },
  { value: 'support.', label: 'Support & requests' },
  { value: 'support.requested', label: '· Requests sent' },
  { value: 'support.answered', label: '· Requests answered' },
  { value: 'design.', label: 'Shared templates' },
  { value: 'data.cleaned', label: 'Old data deleted' },
  { value: 'log.cleared', label: 'Log cleared' },
];

const person = (d: Record<string, string>) => (d.name ? <><b className="text-slate-100">{d.name}</b> <span className="text-slate-400">{d.email}</span></> : <b className="text-slate-100">{d.email}</b>);
const site = (d: Record<string, string>) => <><b className="text-slate-100">{d.name || d.slug}</b>{d.name && d.slug && <span className="text-slate-400"> ({d.domain ?? d.slug})</span>}</>;

/** The "Details" cell: who or what was affected, and how. */
function details(item: Activity): ReactNode {
  const d = item.details;
  switch (item.kind) {
    case 'user.impersonated': return <span className="text-slate-400">{d.step === 'signed-in' ? `opened the admin as ${d.email}` : 'asked for a sign-in link'}</span>;
    case 'user.login': return <span className="text-slate-400">as {d.role === 'admin' ? 'admin' : 'editor'}</span>;
    case 'user.added': return <>{person(d)} <span className="text-slate-400">as {d.role === 'admin' ? 'admin' : 'editor'}{d.access ? `, ${d.access}` : ''}</span></>;
    case 'user.removed': return <>{person(d)}</>;
    case 'user.updated': {
      const changes = [d.role && `role → ${d.role}`, d.renamed !== undefined && `name → ${d.renamed || '(empty)'}`, d.tabs && `tabs → ${d.tabs}`, d.readOnly && `read-only ${d.readOnly}`].filter(Boolean);
      return <>{person(d)} <span className="text-slate-400">{changes.join(' · ')}</span></>;
    }
    case 'site.created': return <>{site(d)} <span className="text-slate-400">owner {d.ownerEmail}</span></>;
    case 'site.deleted': return <>{site(d)}</>;
    case 'community.posted':
    case 'community.updated':
    case 'community.deleted':
    case 'community.hidden':
    case 'community.shown':
    case 'community.removed':
      return <><b className="text-slate-100">“{d.title}”</b>{d.from && <span className="text-slate-400"> from {d.from}</span>}{d.status === 'draft' && <span className="text-slate-400"> (draft)</span>}</>;
    case 'support.requested':
    case 'support.answered':
      return <><b className="text-slate-100">“{d.subject}”</b> <span className="text-slate-400">{d.kind}{d.status ? ` · ${d.status}` : ''}{d.granted ? ` · turned on ${d.granted}` : ''}</span></>;
    case 'design.shared':
    case 'design.unshared':
      return <><b className="text-slate-100">“{d.name}”</b>{d.kind && <span className="text-slate-400"> ({d.kind})</span>}{d.from && <span className="text-slate-400"> from {d.from}</span>}</>;
    case 'data.cleaned': return <span className="text-slate-400">{d.what}, older than {d.olderThan}: {d.deleted} deleted ({d.sites})</span>;
    case 'log.cleared': return <span className="text-slate-400">{d.scope}: {d.deleted} deleted</span>;
    case 'site.updated': {
      const changes = [
        d.renamed && `renamed ${d.renamed}`, d.status, d.domain && `domain → ${d.domain}`,
        d.canAddUsers && `add users ${d.canAddUsers}`, d.canAddSites && `create sites ${d.canAddSites}`, d.siteLimit && `site limit → ${d.siteLimit}`, d.tabs && `tabs → ${d.tabs}`, d.features && `features → ${d.features}`,
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

/** Frees space: deletes old log entries (one entry saying so is kept). */
function ClearLog({ stats, onCleared, notify }: { stats?: Stats; onCleared: () => void; notify: Notify }) {
  const [scope, setScope] = useState('30');
  const label = scope === 'all' ? 'every entry' : `entries older than ${scope} days`;
  async function clear() {
    try {
      const result = await api<{ deleted: number }>('DELETE', `/api/platform/activity?olderThan=${scope}`);
      notify(result.deleted ? `Deleted ${result.deleted.toLocaleString()} log ${result.deleted === 1 ? 'entry' : 'entries'}.` : 'Nothing that old to delete.');
      onCleared();
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }
  return (
    <Card title="Free up space">
      <p className="mb-3 text-sm leading-6 text-slate-300">
        The log holds <b className="text-white">{(stats?.count ?? 0).toLocaleString()}</b> {stats?.count === 1 ? 'entry' : 'entries'}
        {stats?.oldest ? <>, the oldest from {new Date(stats.oldest).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</> : null}.
        Deleting old entries frees space in your database. It can’t be undone; one entry recording what you cleared is kept.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} sm:w-auto`} value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Which entries to delete">
          <option value="7">Older than 7 days</option>
          <option value="15">Older than 15 days</option>
          <option value="30">Older than 30 days</option>
          <option value="all">Everything</option>
        </select>
        <ConfirmButton onConfirm={clear} confirmLabel={`Delete ${label}?`}>Delete {scope === 'all' ? 'the whole log' : 'old entries'}</ConfirmButton>
      </div>
    </Card>
  );
}

const MOD_STATUS: Record<Post['status'], [string, string]> = {
  published: ['On the board', 'bg-lime-300/10 text-lime-200'],
  draft: ['Draft', 'bg-white/5 text-slate-300'],
  hidden: ['Hidden', 'bg-red-400/10 text-red-200'],
};

/** Every community post, to keep the public board clean: hide (reversible) or remove for good. */
function CommunityPosts({ notify }: { notify: Notify }) {
  const [posts, setPosts] = useState<(Post & { authorUser: string })[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    return api<(Post & { authorUser: string })[]>('GET', `/api/platform/community?${params}`, undefined, { fresh: true })
      .then(setPosts).catch((error) => notify(describeError(error), 'error'));
  }, [q, status, notify]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 250); return () => clearTimeout(t); }, [load]);

  async function hide(post: Post, hidden: boolean) {
    try {
      await api('PATCH', `/api/platform/community/${post.id}`, { hidden });
      notify(hidden ? `“${post.title}” is hidden from the board.` : `“${post.title}” is back on the board.`);
      void load();
    } catch (error) { notify(describeError(error), 'error'); }
  }
  async function remove(post: Post) {
    try {
      await api('DELETE', `/api/platform/community/${post.id}`);
      notify(`Removed “${post.title}”.`);
      void load();
    } catch (error) { notify(describeError(error), 'error'); }
  }

  return (
    <Card title={`Community posts${posts ? ` (${posts.length})` : ''}`} actions={<a href="/community" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60 sm:min-h-0 sm:py-2">Open the board ↗</a>}>
      <p className="mb-3 text-sm leading-6 text-slate-300">
        What every site has shared on the public community board, newest first, with who wrote it. Hide a post to take it off the board (its site can still see it), or remove it for good.
      </p>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className={inputClass} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, companies, sites, people…" aria-label="Search posts" />
        <select className={`${inputClass} sm:w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Every status</option><option value="published">On the board</option><option value="draft">Drafts</option><option value="hidden">Hidden</option>
        </select>
      </div>
      {!posts ? <Loading /> : posts.length === 0 ? <p className="text-sm text-slate-400">No posts{q || status ? ' match' : ' yet'}.</p> : (
        <ul className="divide-y divide-white/5">
          {posts.map((post) => {
            const [label, tone] = MOD_STATUS[post.status];
            return (
              <li key={post.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{post.title}</p>
                  <p className="text-xs text-slate-400">{post.company} · {post.role} · {post.category}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className={`rounded px-1.5 py-0.5 font-bold ${tone}`}>{label}</span>
                    <span className="text-lime-200">{post.siteName || post.site}</span>
                    <span>{post.authorUser}{post.anonymous ? ' (shown as Anonymous)' : ''}</span>
                    <span>{new Date(post.createdAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.status === 'published' && <a href={`/community/${post.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 text-xs font-bold text-cyan-200 hover:border-cyan-300/60 sm:min-h-9">View ↗</a>}
                  <Button onClick={() => hide(post, post.status !== 'hidden')}>{post.status === 'hidden' ? 'Show again' : 'Hide'}</Button>
                  <ConfirmButton onConfirm={() => remove(post)} confirmLabel="Remove for good?">Remove</ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Activity logs (main site's admins only): the log, and the community board's posts. */
export function ActivityTab({ notify }: { notify: Notify }) {
  const [view, setView] = useState<'log' | 'community'>('log');
  return (
    <div className="space-y-4 sm:space-y-5">
      <div role="tablist" aria-label="Activity sections" className="flex gap-1">
        {([['log', 'Activity log'], ['community', 'Community posts']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
            className={`min-h-10 rounded-lg px-3 text-xs font-black uppercase tracking-wide ${view === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
        ))}
      </div>
      {view === 'log' ? <ActivityLog notify={notify} /> : <CommunityPosts notify={notify} />}
    </div>
  );
}

/** The log: sign-ins and changes on other sites, changes made to sites, and community posts. */
function ActivityLog({ notify }: { notify: Notify }) {
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
          What happens on the sites you host: sign-ins, users added, changed or removed, sites created, changed or deleted
          (including changes you make from the Sites tab), and posts shared to the community board. Newest first.
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
      <ClearLog stats={data?.stats} notify={notify} onCleared={() => { setPage(0); void load(true); }} />
    </div>
  );
}
