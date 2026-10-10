import { NextResponse } from 'next/server';
import { handleDbError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import { clearTraffic, trafficReport, type Filters, type Period } from '@/lib/traffic';

export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const RANGES = ['today', '7d', '30d', '90d', '12m'] as const;
type RangeKey = (typeof RANGES)[number];

/** The period for a range in the viewer's time zone, the one before it (for "+12% vs before"), and its chart buckets. */
function periodFor(range: RangeKey, tzMinutes: number, now = Date.now()) {
  const shift = tzMinutes * 60 * 1000;
  const today = Math.floor((now + shift) / DAY) * DAY - shift; // local midnight, as a UTC time
  const days = { today: 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 }[range];
  const from = today - (days - 1) * DAY;
  const to = range === 'today' ? now : today + DAY;
  const bucket: Period['bucket'] = range === 'today' ? 'hour' : range === '12m' ? 'month' : 'day';

  // Every bucket label, so days without visits still show on the chart.
  const keys: string[] = [];
  const local = (ms: number) => new Date(ms + shift).toISOString();
  if (bucket === 'hour') for (let t = today; t < today + DAY; t += 60 * 60 * 1000) keys.push(local(t).slice(0, 13));
  else if (bucket === 'day') for (let t = from; t < to; t += DAY) keys.push(local(t).slice(0, 10));
  else for (let t = from; t < to; t += DAY) { const key = local(t).slice(0, 7); if (keys.at(-1) !== key) keys.push(key); }

  const iso = (ms: number) => new Date(ms).toISOString();
  // Today is compared with yesterday up to the same time; other ranges with the same number of days before.
  const [prevFrom, prevTo] = range === 'today' ? [today - DAY, now - DAY] : [from - days * DAY, from];
  const period: Period = { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo), tzMinutes, bucket };
  return { period, keys };
}

/** Admin → Insights: visitors, sources, places, pages, devices and recent visits. ?range=7d&tz=330&source=LinkedIn */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'insights');
  if (error) return error;
  const params = new URL(request.url).searchParams;
  const range = (RANGES as readonly string[]).includes(params.get('range') ?? '') ? (params.get('range') as RangeKey) : '7d';
  const tz = Math.max(-14 * 60, Math.min(14 * 60, Number(params.get('tz')) || 0));
  const filters: Filters = {};
  for (const key of ['source', 'country', 'device', 'page'] as const) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value.slice(0, 300);
  }
  try {
    const { period, keys } = periodFor(range, tz);
    const [report, projects] = await Promise.all([
      trafficReport(period, filters),
      prisma.project.findMany({ select: { slug: true, title: true } }).catch(() => []),
    ]);
    // Page titles for project pages ("/projects/vinay-portfolio" → "Vinay's portfolio").
    const titles = Object.fromEntries(projects.map((p) => [`/projects/${p.slug}`, p.title]));
    return NextResponse.json({ range, period, buckets: keys, filters, titles, ...report });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Deletes this site's visitor analytics. */
export async function DELETE(request: Request) {
  const { error } = await requireTab(request, 'insights');
  if (error) return error;
  try {
    await clearTraffic();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleDbError(err);
  }
}
