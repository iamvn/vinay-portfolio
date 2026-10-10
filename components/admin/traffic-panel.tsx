'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { TrafficReport } from '@/lib/traffic';
import { MEDIUM_LABELS, type Medium } from '@/lib/traffic-sources';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, useReadOnly, type Notify } from './ui';

/**
 * Admin → Insights, visitors: how many people came, where from (LinkedIn, Google, job sites…), where they
 * are, what they looked at, on which devices, and what they did. Data from lib/traffic.ts.
 */

type Filters = { source?: string; country?: string; device?: string; page?: string };
type Report = TrafficReport & { range: Range; buckets: string[]; filters: Filters; titles: Record<string, string>; period: { bucket: 'hour' | 'day' | 'month' } };
type Range = 'today' | '7d' | '30d' | '90d' | '12m';
type Item = { name: string; visitors: number; count: number; [key: string]: unknown };

const RANGES: [Range, string, string][] = [
  ['today', 'Today', 'yesterday'],
  ['7d', '7 days', 'the 7 days before'],
  ['30d', '30 days', 'the 30 days before'],
  ['90d', '90 days', 'the 90 days before'],
  ['12m', '12 months', 'the year before'],
];

const GOALS: { key: string; label: string; types: string[] }[] = [
  { key: 'resume', label: 'Resume downloads', types: ['resume_download'] },
  { key: 'contact', label: 'Contact clicks', types: ['contact_email', 'contact_copy', 'contact_linkedin'] },
  { key: 'ask', label: 'Questions asked', types: ['ask'] },
  { key: 'form', label: 'Form messages', types: ['form'] },
];
const GOAL_LABEL: Record<string, string> = {
  resume_download: 'Downloaded resume', contact_email: 'Clicked email', contact_copy: 'Copied email', contact_linkedin: 'Opened LinkedIn', ask: 'Asked the assistant', form: 'Sent a form',
};

// ---------------------------------------------------------------- formatting

const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } })();
const countryName = (code: string) => (code ? (regionNames?.of(code) ?? code) : 'Unknown');
const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐');
const number = (n: number) => n.toLocaleString();
const percent = (n: number) => `${Math.round(n * 100)}%`;

function duration(ms: number) {
  if (!ms) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Chart bucket labels are local times already ("2026-10-09", "2026-10-09T14", "2026-10"): format them as UTC. */
function bucketLabel(key: string, bucket: 'hour' | 'day' | 'month', long = false) {
  if (bucket === 'hour') return `${key.slice(11, 13)}:00`;
  if (bucket === 'month') return new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' });
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { weekday: long ? 'short' : undefined, day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const pageLabel = (path: string, titles: Record<string, string>) => titles[path] ?? (path === '/' ? 'Homepage' : path);
const host = (url: string) => url.replace(/^[a-z-]+:\/\//, '').replace(/^www\./, '');

// ---------------------------------------------------------------- small pieces

function Change({ now, before, inverse = false }: { now: number; before: number; inverse?: boolean }) {
  if (!before && !now) return null;
  if (!before) return <span className="text-[11px] font-bold text-slate-400">new</span>;
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return <span className="text-[11px] font-bold text-slate-400">no change</span>;
  const good = inverse ? change < 0 : change > 0;
  return (
    <span className={`text-[11px] font-bold ${good ? 'text-lime-300' : 'text-red-300'}`}>
      {change > 0 ? '↑' : '↓'} {Math.abs(Math.round(change * 100))}%
    </span>
  );
}

function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {options.map(([key, text]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)}
          className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${value === key ? 'bg-cyan-300/15 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** A ranked list: label, a bar behind it in proportion to visitors, and the count. Rows can filter the report. */
function BarList({ items, label, render, onPick, empty = 'No visits yet.', unit = 'Visitors' }: {
  items: Item[]; label: string; render: (item: Item) => ReactNode; onPick?: (item: Item) => void; empty?: string; unit?: string;
}) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.visitors), 1);
  const shown = all ? items : items.slice(0, 8);
  return (
    <div>
      <div className="mb-1.5 flex justify-between px-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
        <span>{label}</span><span>{unit}</span>
      </div>
      <ul className="space-y-1">
        {shown.map((item) => {
          const row = (
            <>
              <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-md bg-cyan-300/[.12]" style={{ width: `${Math.max(2, (item.visitors / max) * 100)}%` }} />
              <span className="relative min-w-0 flex-1 truncate">{render(item)}</span>
              <span className="relative shrink-0 font-bold tabular-nums text-slate-100">{number(item.visitors)}</span>
            </>
          );
          return (
            <li key={`${item.name}|${String(item.country ?? item.source ?? item.medium ?? '')}`}>
              {onPick ? (
                <button type="button" onClick={() => onPick(item)} title="Show only these visitors"
                  className="relative flex min-h-9 w-full items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                  {row}
                </button>
              ) : (
                <div className="relative flex min-h-9 items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-sm text-slate-200">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > 8 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 px-2 text-xs font-bold text-cyan-300 hover:underline">
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

/** Visitors (or visits / page views) per hour, day or month. One measure at a time, so one scale. */
function TrendChart({ report }: { report: Report }) {
  const [metric, setMetric] = useState<'visitors' | 'visits' | 'views'>('visitors');
  const [hover, setHover] = useState<number | null>(null);
  const byKey = new Map(report.series.map((p) => [p.t, p]));
  const points = report.buckets.map((key) => ({ key, ...(byKey.get(key) ?? { visitors: 0, visits: 0, views: 0 }) }));
  const values = points.map((p) => p[metric]);
  const max = Math.max(...values, 1);
  const top = niceMax(max);
  const bucket = report.period.bucket;
  const names = { visitors: 'Visitors', visits: 'Visits', views: 'Page views' };
  const ticks = labelTicks(points.length, bucket === 'hour');
  const active = hover ?? null;

  return (
    <Card title="Visitors over time" actions={
      <Tabs label="Chart measure" value={metric} onChange={setMetric} options={[['visitors', 'Visitors'], ['visits', 'Visits'], ['views', 'Page views']]} />
    }>
      <div className="relative">
        <div className="flex gap-2">
          <div aria-hidden="true" className="flex h-44 w-8 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-slate-500 sm:h-52">
            <span>{number(top)}</span><span>{number(Math.round(top / 2))}</span><span>0</span>
          </div>
          <div className="relative h-44 min-w-0 flex-1 sm:h-52" onMouseLeave={() => setHover(null)}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              <span className="border-t border-white/[.06]" /><span className="border-t border-white/[.06]" /><span className="border-t border-white/15" />
            </div>
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {points.map((p, i) => (
                <div key={p.key} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                  <div className={`w-full rounded-t-[4px] transition-colors ${active === i ? 'bg-lime-300' : 'bg-cyan-300/80'}`}
                    style={{ height: p[metric] ? `${Math.max(2, (p[metric] / top) * 100)}%` : '0' }} />
                </div>
              ))}
            </div>
            {active !== null && points[active] && (
              <div role="status" className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs shadow-xl"
                style={{ left: `${Math.min(85, Math.max(15, ((active + 0.5) / points.length) * 100))}%` }}>
                <p className="mb-1 font-bold text-slate-100">{bucketLabel(points[active].key, bucket, true)}</p>
                <p className="text-slate-300"><b className="text-white">{number(points[active].visitors)}</b> visitors · {number(points[active].visits)} visits · {number(points[active].views)} views</p>
              </div>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="relative ml-10 mt-1.5 h-4 text-[10px] text-slate-500">
          {ticks.map((i) => (
            <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / points.length) * 100}%` }}>{bucketLabel(points[i].key, bucket)}</span>
          ))}
        </div>
        <table className="sr-only">
          <caption>{names[metric]} per {bucket}</caption>
          <thead><tr><th>Time</th><th>Visitors</th><th>Visits</th><th>Page views</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.key}><td>{bucketLabel(p.key, bucket, true)}</td><td>{p.visitors}</td><td>{p.visits}</td><td>{p.views}</td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  );
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (n <= m * step) return m * step;
  return 10 * step;
}

/** Up to 5 evenly spaced x labels, so they never collide. */
function labelTicks(count: number, fromStart = false) {
  if (count <= 1) return count ? [0] : [];
  // Evenly spaced: hours from midnight (00, 06, 12, 18), days and months back from the most recent one.
  const step = Math.ceil((count - 1) / 4);
  const ticks: number[] = [];
  if (fromStart) for (let i = 0; i < count; i += step) ticks.push(i);
  else for (let i = count - 1; i >= 0; i -= step) ticks.unshift(i);
  return ticks;
}

function Kpi({ label, value, change, hint }: { label: string; value: string; change: ReactNode; hint: string }) {
  return (
    <div title={hint} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-black tabular-nums text-white sm:text-3xl">{value}</p>
      <p className="mt-1 min-h-4">{change}</p>
    </div>
  );
}

function SourceName({ name, medium }: { name: string; medium?: string }) {
  return (
    <>
      <span className="font-medium">{name}</span>
      {medium && medium !== 'direct' && <span className="ml-2 text-[11px] text-slate-500">{MEDIUM_LABELS[medium as Medium] ?? medium}</span>}
    </>
  );
}

// ---------------------------------------------------------------- the panel

export function TrafficPanel({ notify }: { notify: Notify }) {
  const readOnly = useReadOnly();
  const [range, setRange] = useState<Range>('7d');
  const [filters, setFilters] = useState<Filters>({});
  const [report, setReport] = useState<(Report & { query: string }) | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceTab, setSourceTab] = useState<'sources' | 'channels' | 'referrers' | 'campaigns'>('sources');
  const [placeTab, setPlaceTab] = useState<'countries' | 'cities'>('countries');
  const [pageTab, setPageTab] = useState<'pages' | 'entry'>('pages');
  const [deviceTab, setDeviceTab] = useState<'devices' | 'browsers' | 'os'>('devices');

  const query = useMemo(() => {
    const params = new URLSearchParams({ range, tz: String(-new Date().getTimezoneOffset()) });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return params.toString();
  }, [range, filters]);

  const load = useCallback((fresh = false) => api<Report>('GET', `/api/insights/traffic?${query}`, undefined, { fresh })
    .then((data) => setReport({ ...data, query }))
    .catch((error) => notify(describeError(error), 'error')), [query, notify]);
  const loading = refreshing || (!!report && report.query !== query);
  const refresh = () => { setRefreshing(true); return load(true).finally(() => setRefreshing(false)); };

  useEffect(() => { void load(); }, [load]);
  // Keep "online now" and the recent visits current while the tab is open.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const pick = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const clear = (key: keyof Filters) => setFilters((f) => { const next = { ...f }; delete next[key]; return next; });

  async function wipe() {
    try {
      await api('DELETE', '/api/insights/traffic');
      notify('Visitor data deleted.');
      await load(true);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  if (!report) return <Loading />;
  const { totals: t, previous: p } = report;
  const compared = RANGES.find(([key]) => key === range)?.[2] ?? '';
  const titles = report.titles ?? {};
  const filterLabels: Record<keyof Filters, (v: string) => string> = {
    source: (v) => `From ${v}`, country: (v) => `In ${v === 'unknown' ? 'unknown country' : countryName(v)}`, device: (v) => `On ${v.toLowerCase()}`, page: (v) => `Viewed ${pageLabel(v, titles)}`,
  };

  // Goals per source: one row per source with each goal's count.
  const goalRows = (() => {
    const rows = new Map<string, Record<string, number>>();
    for (const g of report.goals) {
      const kind = GOALS.find((x) => x.types.includes(g.type))?.key;
      if (!kind) continue;
      const row = rows.get(g.source) ?? {};
      row[kind] = (row[kind] ?? 0) + g.count;
      rows.set(g.source, row);
    }
    const visitorsOf = new Map(report.sources.map((s) => [s.name, s.visitors]));
    return [...rows.entries()].map(([source, counts]) => ({ source, counts, visitors: visitorsOf.get(source) ?? 0, total: Object.values(counts).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total);
  })();
  const goalTotals = GOALS.map((g) => ({ ...g, count: report.goals.filter((x) => g.types.includes(x.type)).reduce((n, x) => n + x.count, 0) }));

  return (
    <div className="space-y-4 sm:space-y-5" aria-busy={loading}>
      {/* Range, live count, filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Time range" className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/70 p-1">
          {RANGES.map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={range === key} aria-label={label} onClick={() => setRange(key)}
              className={`min-h-9 rounded-lg px-3 text-xs font-black uppercase tracking-wide transition ${range === key ? 'bg-lime-300 text-black' : 'text-slate-300 hover:text-white'}`}>
              <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{key === 'today' ? 'Today' : key}</span>
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300" title="Visitors in the last 5 minutes">
          <span className={`size-2 rounded-full ${report.live ? 'animate-pulse bg-lime-300' : 'bg-slate-600'}`} aria-hidden="true" />
          {report.live} online now
        </span>
        <span className="flex-1" />
        <Button view onClick={refresh}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </div>

      {Object.keys(filters).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Showing visitors:</span>
          {(Object.entries(filters) as [keyof Filters, string][]).map(([key, value]) => (
            <button key={key} type="button" onClick={() => clear(key)} aria-label={`Remove filter: ${filterLabels[key](value)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-cyan-300/15 px-3 py-1 font-bold text-cyan-100 hover:bg-cyan-300/25">
              {filterLabels[key](value)} <span aria-hidden="true">✕</span>
            </button>
          ))}
          <button type="button" onClick={() => setFilters({})} className="font-bold text-slate-400 hover:text-white">Clear all</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Visitors" value={number(t.visitors)} change={<Change now={t.visitors} before={p.visitors} />} hint={`Different people (counted once per day). Compared with ${compared}.`} />
        <Kpi label="Visits" value={number(t.visits)} change={<Change now={t.visits} before={p.visits} />} hint="Times someone opened your site from outside it (a link, a search, typing the address)." />
        <Kpi label="Page views" value={number(t.views)} change={<Change now={t.views} before={p.views} />} hint="Every page shown, including moving between pages." />
        <Kpi label="Time per visit" value={duration(t.avgTime)} change={<Change now={t.avgTime} before={p.avgTime} />} hint="Average time your pages were on screen per visit." />
        <div className="col-span-2 lg:col-span-1">
          <Kpi label="Bounce rate" value={percent(t.bounceRate)} change={<Change now={t.bounceRate} before={p.bounceRate} inverse />} hint="Visitors who saw only one page. Lower usually means more interest." />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-slate-500">Arrows compare with {compared}.</p>

      <TrendChart report={report} />

      <div className="grid gap-4 lg:grid-cols-2 sm:gap-5">
        <Card title="Where visitors come from">
          <div className="mb-3"><Tabs label="Traffic source view" value={sourceTab} onChange={setSourceTab} options={[['sources', 'Sources'], ['channels', 'Channels'], ['referrers', 'Links'], ['campaigns', 'Campaigns']]} /></div>
          {sourceTab === 'sources' && <BarList items={report.sources} label="Source" onPick={(i) => pick('source', i.name)} render={(i) => <SourceName name={i.name} medium={String(i.medium ?? '')} />} />}
          {sourceTab === 'channels' && <BarList items={report.mediums} label="Channel" render={(i) => MEDIUM_LABELS[i.name as Medium] ?? i.name} />}
          {sourceTab === 'referrers' && <BarList items={report.referrers} label="Linking page" empty="No visits from other websites yet." onPick={(i) => pick('source', String(i.source))}
            render={(i) => <span title={i.name}>{host(i.name)}</span>} />}
          {sourceTab === 'campaigns' && <BarList items={report.campaigns} label="Campaign" empty="No tagged links used yet. Use the links under “Share links that count”." onPick={(i) => pick('source', String(i.source))}
            render={(i) => <><span className="font-medium">{i.name}</span><span className="ml-2 text-[11px] text-slate-500">{String(i.source)}</span></>} />}
        </Card>

        <Card title="Where they are">
          <div className="mb-3"><Tabs label="Location view" value={placeTab} onChange={setPlaceTab} options={[['countries', 'Countries'], ['cities', 'Cities']]} /></div>
          {placeTab === 'countries'
            ? <BarList items={report.countries} label="Country" onPick={(i) => pick('country', i.name || 'unknown')} render={(i) => <><span aria-hidden="true" className="mr-2">{flag(i.name)}</span>{countryName(i.name)}</>} />
            : <BarList items={report.cities} label="City" empty="No city data yet (it appears on the live site)." onPick={(i) => pick('country', String(i.country) || 'unknown')}
                render={(i) => <><span aria-hidden="true" className="mr-2">{flag(String(i.country))}</span>{i.name}<span className="ml-2 text-[11px] text-slate-500">{[String(i.region ?? ''), countryName(String(i.country))].filter(Boolean).join(', ')}</span></>} />}
        </Card>

        <Card title="What they look at">
          <div className="mb-3"><Tabs label="Page view" value={pageTab} onChange={setPageTab} options={[['pages', 'Top pages'], ['entry', 'Landing pages']]} /></div>
          {pageTab === 'pages'
            ? <BarList items={report.pages} label="Page" onPick={(i) => pick('page', i.name)}
                render={(i) => <><span className="font-medium" title={i.name}>{pageLabel(i.name, titles)}</span><span className="ml-2 text-[11px] text-slate-500">{number(i.count)} views{Number(i.time) ? ` · ${duration(Number(i.time))} avg` : ''}</span></>} />
            : <BarList items={report.entryPages} label="First page of a visit" onPick={(i) => pick('page', i.name)} render={(i) => <span title={i.name}>{pageLabel(i.name, titles)}</span>} />}
        </Card>

        <Card title="Devices">
          <div className="mb-3"><Tabs label="Device view" value={deviceTab} onChange={setDeviceTab} options={[['devices', 'Device'], ['browsers', 'Browser'], ['os', 'System']]} /></div>
          {deviceTab === 'devices' && <BarList items={report.devices} label="Device" onPick={(i) => pick('device', i.name)} render={(i) => i.name || 'Unknown'} />}
          {deviceTab === 'browsers' && <BarList items={report.browsers} label="Browser" render={(i) => i.name || 'Unknown'} />}
          {deviceTab === 'os' && <BarList items={report.os} label="Operating system" render={(i) => i.name || 'Unknown'} />}
        </Card>
      </div>

      <Card title="What visitors did">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {goalTotals.map((g) => (
            <div key={g.key} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{g.label}</p>
              <p className="mt-1 text-xl font-black tabular-nums text-white">{number(g.count)}</p>
            </div>
          ))}
        </div>
        {goalRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet in this period. When a visitor downloads your resume, clicks a contact option, asks the assistant or sends a form, you’ll see which source brought them.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th scope="col" className="py-2 pr-3">Source</th>
                  <th scope="col" className="px-2 py-2 text-right">Visitors</th>
                  {GOALS.map((g) => <th key={g.key} scope="col" className="px-2 py-2 text-right">{g.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {goalRows.map((row) => (
                  <tr key={row.source}>
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-200">{row.source}</th>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400">{row.visitors ? number(row.visitors) : '–'}</td>
                    {GOALS.map((g) => <td key={g.key} className="px-2 py-2 text-right tabular-nums text-slate-100">{row.counts[g.key] ? number(row.counts[g.key]) : <span className="text-slate-600">0</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Recent visits">
        {report.visits.length === 0 ? (
          <p className="text-sm text-slate-500">No visits in this period yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {report.visits.map((v) => (
              <li key={v.id} className="py-3">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
                    <span className="w-20 shrink-0 text-xs text-slate-500">{ago(v.at)}</span>
                    <span className="min-w-0 text-sm text-slate-100">
                      <span aria-hidden="true" className="mr-1.5">{flag(v.country)}</span>
                      {[v.city, v.country ? countryName(v.country) : 'Unknown place'].filter(Boolean).join(', ')}
                    </span>
                    <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-[11px] font-bold text-cyan-200">{v.source || 'Direct'}{v.campaign ? ` · ${v.campaign}` : ''}</span>
                    <span className="text-xs text-slate-400">{[v.device, v.browser, v.os].filter(Boolean).join(' · ')}</span>
                    <span className="flex-1" />
                    <span className="text-xs text-slate-400">{v.views} page{v.views === 1 ? '' : 's'} · {duration(v.time)}</span>
                    {v.goals.length > 0 && <span className="rounded bg-lime-300/15 px-1.5 py-0.5 text-[11px] font-bold text-lime-200">{[...new Set(v.goals)].map((g) => GOAL_LABEL[g] ?? g).join(' · ')}</span>}
                    <span aria-hidden="true" className="text-xs text-slate-500 transition group-open:rotate-90">▸</span>
                  </summary>
                  <div className="mt-2 space-y-1 pl-0 text-xs text-slate-400 sm:pl-[5.75rem]">
                    {v.referrer && <p>Came from <span className="text-slate-200">{host(v.referrer)}</span></p>}
                    <p>Pages: {v.pages.map((path) => pageLabel(path, titles)).join(' → ')}</p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ShareLinks />

      <Card title="Privacy">
        <p className="text-sm leading-6 text-slate-400">
          No cookies, no IP addresses, nothing that identifies a person. Each visitor gets an anonymous id that changes every day, so someone coming back
          tomorrow counts as a new visitor and can’t be followed over time. Location (country, region, city) comes from the hosting network, not from the visitor’s device.
          Your own visits while signed in, admin pages and bots aren’t counted. Data older than 400 days is deleted automatically.
        </p>
        {!readOnly && (
          <div className="mt-4">
            <ConfirmButton confirmLabel="Click again to delete all visitor data" onConfirm={wipe}>Delete visitor data</ConfirmButton>
          </div>
        )}
      </Card>
    </div>
  );
}

const noSubscribe = () => () => {};

/** Tagged links: LinkedIn's app often hides where a visitor came from; a tagged link always counts. */
function ShareLinks() {
  const origin = useSyncExternalStore(noSubscribe, () => location.origin, () => '');
  const [copied, setCopied] = useState('');
  const links: [string, string][] = [
    ['LinkedIn post or profile', 'linkedin'],
    ['Resume PDF', 'resume'],
    ['WhatsApp', 'whatsapp'],
    ['Email signature', 'email'],
  ];
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(''), 2000); } catch { /* the field can still be selected */ }
  }
  return (
    <Card title="Share links that count">
      <p className="mb-3 text-sm leading-6 text-slate-400">
        LinkedIn’s app and some messengers hide where a visitor came from, so they show up as “Direct”. Share these links instead and every visit is credited
        to the right place (the tag is removed from the address bar once the page opens).
      </p>
      <ul className="space-y-2">
        {links.map(([label, tag]) => {
          const url = `${origin}/?utm_source=${tag}`;
          return (
            <li key={tag} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-44 shrink-0 text-xs font-bold text-slate-300">{label}</span>
              <input readOnly value={origin ? url : ''} aria-label={`Link for ${label}`} onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-slate-200" />
              <Button view onClick={() => copy(url)}>{copied === url ? 'Copied ✓' : 'Copy'}</Button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Any tag works: add <code className="text-slate-300">?utm_source=name</code> (and optionally <code className="text-slate-300">&amp;utm_campaign=launch</code>) to any page address.</p>
    </Card>
  );
}
