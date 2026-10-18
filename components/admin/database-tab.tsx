'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, Loading, inputClass, type Notify } from './ui';
import { SiteUsage } from './site-usage';

/**
 * Admin → Database (platform owner only): how much of the Turso plan Kritipath uses, which sites and tables
 * take the space, and deleting old logs after a preview and a typed DELETE.
 */
type SiteRow = { slug: string; name: string; isMain: boolean; status: string; dataBytes: number | null; storageBytes: number | null; rowsRead: number | null; rowsWritten: number | null; error?: string };
type Overview = {
  plan: { name: string; storageBytes: number; rowsRead: number; rowsWritten: number; databases: number };
  usageAvailable: boolean;
  totals: { storageBytes: number; dataBytes: number; rowsRead: number; rowsWritten: number; databases: number; sites: number };
  unused: { name: string }[];
  sites: SiteRow[];
  cleanup: { id: string; label: string; hint: string; mainOnly: boolean }[];
  days: number[];
  generatedAt: string;
};
type Table = { name: string; label: string; rows: number; bytes: number };
type CleanupResult = { kind: string; days: number; cutoff: string; total: number; sites: { slug: string; name: string; rows: number; error?: string }[] };

export const bytes = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '–';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};
const count = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
};
const slugKey = (s: SiteRow) => (s.isMain ? 'main' : s.slug);

/** A usage bar: lime under 60%, amber from 60%, red from 80% (with a hint to clean up or upgrade). */
function Meter({ label, used, limit, format, unknown = false, note }: { label: string; used: number; limit: number; format: (n: number) => string; unknown?: boolean; note?: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 80 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-300' : 'bg-lime-300';
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-slate-300">{label}</p>
        <p className="text-[11px] tabular-nums text-slate-500">{unknown ? '–' : `${pct < 1 && used > 0 ? '<1' : Math.round(pct)}%`}</p>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${unknown ? 0 : Math.max(pct, used > 0 ? 1 : 0)}%` }} />
      </div>
      <p className="mt-2 text-sm font-black tabular-nums text-white">{unknown ? 'Not available' : format(used)} <span className="text-xs font-normal text-slate-500">of {format(limit)}</span></p>
      {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
      {!unknown && pct >= 80 && <p className="mt-1 text-xs text-red-300">Time to clean up or upgrade the plan.</p>}
    </div>
  );
}

type TabTotal = { tab: string; rows: number; bytes: number };

function SizeRows({ rows, tone }: { rows: { key: string; label: string; sub?: string; rows: number; bytes: number }[]; tone: string }) {
  const max = Math.max(1, ...rows.map((r) => r.bytes));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5rem_5rem]">
          <span className="min-w-0 truncate text-sm text-slate-200">{r.label}{r.sub && <span className="ml-1 font-mono text-[11px] text-slate-500">{r.sub}</span>}</span>
          <span className="order-last col-span-2 h-1.5 overflow-hidden rounded-full bg-white/10 sm:order-none sm:col-span-1"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${(r.bytes / max) * 100}%` }} /></span>
          <span className="hidden text-right text-xs tabular-nums text-slate-400 sm:block">{count(r.rows)} {r.rows === 1 ? 'row' : 'rows'}</span>
          <span className="text-right text-xs font-bold tabular-nums text-slate-200">{bytes(r.bytes)}</span>
        </li>
      ))}
    </ul>
  );
}

/** One site's data: total per admin tab first, then (folded) every table. */
function SiteTables({ slug, notify }: { slug: string; notify: Notify }) {
  const [data, setData] = useState<{ tables: Table[]; tabs: TabTotal[] } | null>(null);
  const [showTables, setShowTables] = useState(false);
  useEffect(() => {
    api<{ tables: Table[]; tabs: TabTotal[] }>('GET', `/api/platform/database/tables?site=${encodeURIComponent(slug)}`, undefined, { fresh: true })
      .then(setData).catch((error) => { notify(describeError(error), 'error'); setData({ tables: [], tabs: [] }); });
  }, [slug, notify]);
  if (!data) return <p className="py-3 text-xs text-slate-500">Reading tables…</p>;
  if (!data.tables.length) return <p className="py-3 text-xs text-slate-500">No tables found.</p>;
  const total = data.tabs.reduce((n, t) => n + t.bytes, 0);
  return (
    <div className="space-y-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-cyan-300">By tab</h4>
        <span className="text-xs tabular-nums text-slate-400">Total <b className="text-slate-100">{bytes(total)}</b></span>
      </div>
      <SizeRows tone="bg-lime-300/80" rows={data.tabs.map((t) => ({ key: t.tab, label: t.tab, rows: t.rows, bytes: t.bytes }))} />
      <button type="button" aria-expanded={showTables} onClick={() => setShowTables((v) => !v)} className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-slate-400 hover:text-white">
        <span aria-hidden="true" className={`transition ${showTables ? 'rotate-90' : ''}`}>▸</span>{showTables ? 'Hide' : 'Show'} all {data.tables.length} tables
      </button>
      {showTables && <SizeRows tone="bg-cyan-300/70" rows={data.tables.map((t) => ({ key: t.name, label: t.label, sub: t.name !== t.label ? t.name : undefined, rows: t.rows, bytes: t.bytes }))} />}
      <p className="text-[11px] text-slate-500">Sizes count the data itself; Turso&apos;s storage figure above also includes indexes and free pages.</p>
    </div>
  );
}

function SitesBySize({ data, notify }: { data: Overview; notify: Notify }) {
  const [open, setOpen] = useState<string | null>(null);
  const size = (s: SiteRow) => s.storageBytes ?? s.dataBytes;
  const max = Math.max(1, ...data.sites.map((s) => size(s) ?? 0));
  return (
    <ul className="divide-y divide-white/5">
      {data.sites.map((s) => {
        const key = slugKey(s);
        const expanded = open === key;
        return (
          <li key={key}>
            <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : key)}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left sm:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)_6rem_7rem]">
              <span aria-hidden="true" className={`text-xs text-slate-500 transition ${expanded ? 'rotate-90' : ''}`}>▸</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">{s.name}{s.status === 'suspended' && <span className="ml-2 rounded bg-slate-400/15 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">Paused</span>}</span>
                <span className="block truncate text-[11px] text-slate-500">{s.isMain ? 'your main database' : s.slug}{s.error ? ` · couldn't read usage` : ''}</span>
              </span>
              <span className="col-span-3 col-start-2 h-1.5 overflow-hidden rounded-full bg-white/10 sm:col-span-1 sm:col-start-auto"><span className="block h-full rounded-full bg-lime-300/80" style={{ width: `${((size(s) ?? 0) / max) * 100}%` }} /></span>
              <span className="row-start-1 col-start-3 text-right tabular-nums sm:row-start-auto sm:col-start-auto">
                <span className="block text-sm font-black text-white">{bytes(size(s))}</span>
                {s.storageBytes !== null && s.dataBytes !== null && <span className="block text-[10px] text-slate-500">{bytes(s.dataBytes)} data</span>}
              </span>
              <span className="hidden text-right text-[11px] tabular-nums text-slate-400 sm:block">{count(s.rowsRead)} reads<br />{count(s.rowsWritten)} writes</span>
            </button>
            {expanded && <div className="pl-6"><SiteTables slug={key} notify={notify} /></div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Turso databases no site points at (e.g. left over from an earlier delete): delete one after typing its name. */
function UnusedDatabases({ names, notify, onDone }: { names: string[]; notify: Notify; onDone: () => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const remove = (name: string) => api('DELETE', '/api/platform/database/unused', { name, confirm })
    .then(() => { notify(`Deleted the database ${name}.`); setDeleting(null); setConfirm(''); onDone(); })
    .catch((e) => notify(describeError(e), 'error'));
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">These databases are in your Turso account, but no site uses them. They still count towards your plan.</p>
      <ul className="divide-y divide-white/5">
        {names.map((name) => (
          <li key={name} className="py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-slate-200">{name}</span>
              <Button tone="danger" onClick={() => { setDeleting(deleting === name ? null : name); setConfirm(''); }}>Delete…</Button>
            </div>
            {deleting === name && (
              <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-red-400/30 bg-red-950/30 p-3">
                <label className="block min-w-0 flex-1 text-xs text-red-200">Type <b>{name}</b> to delete it for good
                  <input id={`unused-${name}`} className={`${inputClass} mt-1`} value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value.trim())} />
                </label>
                <Button tone="danger" disabled={confirm !== name} onClick={() => remove(name)}>Delete forever</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CleanupPanel({ data, notify, onDone }: { data: Overview; notify: Notify; onDone: () => void }) {
  const [kind, setKind] = useState(data.cleanup[0]?.id ?? 'visits');
  const [days, setDays] = useState(data.days[1] ?? 90);
  const [scope, setScope] = useState('all');
  const [preview, setPreview] = useState<CleanupResult | null>(null);
  const [confirm, setConfirm] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const info = data.cleanup.find((c) => c.id === kind);
  const reset = () => { setPreview(null); setConfirm(''); setResult(null); };
  const body = (dryRun: boolean) => ({ kind, days, scope: info?.mainOnly ? 'main' : scope, dryRun, ...(dryRun ? {} : { confirm }) });
  const check = () => api<CleanupResult>('POST', '/api/platform/database/cleanup', body(true)).then((r) => { setPreview(r); setResult(null); }).catch((e) => notify(describeError(e), 'error'));
  const run = () => api<CleanupResult>('POST', '/api/platform/database/cleanup', body(false)).then((r) => {
    const msg = `Deleted ${r.total.toLocaleString()} record${r.total === 1 ? '' : 's'} older than ${r.days} days${r.sites.length > 1 ? ` across ${r.sites.length} sites` : ''}.`;
    setResult(msg); notify(msg); setPreview(null); setConfirm(''); onDone();
  }).catch((e) => notify(describeError(e), 'error'));

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Only logs that grow forever can be cleaned here. Profiles, projects, resumes, designs and users are never touched.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">What to delete</span>
          <select id="db-kind" className={inputClass} value={kind} onChange={(e) => { setKind(e.target.value); reset(); }}>
            {data.cleanup.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Older than</span>
          <select id="db-days" className={inputClass} value={days} onChange={(e) => { setDays(Number(e.target.value)); reset(); }}>
            {data.days.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Sites</span>
          <select id="db-scope" className={inputClass} value={info?.mainOnly ? 'main' : scope} disabled={info?.mainOnly} onChange={(e) => { setScope(e.target.value); reset(); }}>
            <option value="all">All sites</option>
            {data.sites.map((s) => <option key={slugKey(s)} value={slugKey(s)}>{s.name}</option>)}
          </select>
        </label>
      </div>
      {info && <p className="-mt-1 text-xs text-slate-500">{info.hint}</p>}
      <Button onClick={check}>Check how many</Button>

      {preview && (preview.total === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">Nothing to delete: no records older than {preview.days} days.</p>
      ) : (
        <div className="space-y-3 rounded-xl border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">
          <p>This will permanently delete <b>{preview.total.toLocaleString()} record{preview.total === 1 ? '' : 's'}</b> older than {preview.days} days ({new Date(preview.cutoff).toLocaleDateString()}). This can&apos;t be undone, apart from the nightly backup if you set it up.</p>
          {preview.sites.length > 1 && (
            <ul className="grid gap-x-6 gap-y-1 text-xs text-red-200/90 sm:grid-cols-2">
              {preview.sites.map((s) => <li key={s.slug} className="flex justify-between gap-3"><span className="truncate">{s.name}</span><span className="tabular-nums">{s.error ? `error: ${s.error}` : s.rows.toLocaleString()}</span></li>)}
            </ul>
          )}
          <label className="block text-xs text-red-200">Type <b>DELETE</b> to confirm
            <input id="db-confirm" className={`${inputClass} mt-1 sm:max-w-xs`} value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button tone="danger" disabled={confirm.trim().toUpperCase() !== 'DELETE'} onClick={run}>Delete {preview.total.toLocaleString()} records</Button>
            <Button onClick={reset}>Cancel</Button>
          </div>
        </div>
      ))}
      {result && <p role="status" className="text-sm font-bold text-lime-200">{result}</p>}
    </div>
  );
}

export function DatabaseTab({ notify }: { notify: Notify }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(() => api<Overview>('GET', '/api/platform/database', undefined, { fresh: true })
    .then(setData).catch((error) => notify(describeError(error), 'error')).finally(() => setLoading(false)), [notify]);
  useEffect(() => { void fetchData(); }, [fetchData]);
  const refresh = () => { setLoading(true); void fetchData(); };

  if (!data) return loading ? <Loading /> : <p className="text-sm text-slate-400">Couldn&apos;t load the databases.</p>;
  const unknown = !data.usageAvailable;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-black tracking-tight">Database</h2>
          <p className="text-sm text-slate-400">Every site&apos;s database on your {data.plan.name} plan. Only you can see this.</p>
        </div>
        <Button onClick={refresh} disabled={loading} view>{loading ? 'Refreshing…' : 'Refresh'}</Button>
      </div>

      <Card title="Space used" collapsible={false}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Meter label="Storage" used={data.totals.storageBytes} limit={data.plan.storageBytes} format={bytes} unknown={unknown} />
          <Meter label="Rows read this month" used={data.totals.rowsRead} limit={data.plan.rowsRead} format={count} unknown={unknown} />
          <Meter label="Rows written this month" used={data.totals.rowsWritten} limit={data.plan.rowsWritten} format={count} unknown={unknown} />
          <Meter label="Databases" used={data.totals.databases} limit={data.plan.databases} format={(n) => String(n)}
            note={`Your main database + ${data.totals.sites} site${data.totals.sites === 1 ? '' : 's'}${data.unused.length ? ` + ${data.unused.length} unused` : ''}`} />
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          {unknown ? 'Storage and reads/writes need TURSO_API_TOKEN and TURSO_ORG in Vercel. ' : 'Reads and writes reset on the 1st of each month. '}
          Limits are Turso&apos;s free plan; on a paid plan, change them in lib/sites/database.ts. Updated {new Date(data.generatedAt).toLocaleTimeString()}.
        </p>
      </Card>

      <Card title="Sites: activity & inactive" collapsible={false}>
        <p className="-mt-1 mb-3 text-sm text-slate-400">Last sign-in, visitors and load per site. Pause or delete sites nobody uses.</p>
        <SiteUsage notify={notify} onChanged={refresh} />
      </Card>

      <Card title="What takes the most space" collapsible={false}>
        <p className="-mt-1 mb-2 text-sm text-slate-400">Each site&apos;s total size, largest first: {bytes(data.usageAvailable ? data.totals.storageBytes : data.totals.dataBytes)} across all {data.totals.sites + 1} databases. Open a site to see it by tab and by table.</p>
        <SitesBySize data={data} notify={notify} />
      </Card>

      {data.unused.length > 0 && (
        <Card title={`Unused databases (${data.unused.length})`} collapsible={false}>
          <UnusedDatabases names={data.unused.map((u) => u.name)} notify={notify} onDone={refresh} />
        </Card>
      )}

      <Card title="Clean up old data" collapsible={false}>
        <CleanupPanel data={data} notify={notify} onDone={refresh} />
      </Card>
    </div>
  );
}
