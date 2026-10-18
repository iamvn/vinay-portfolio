import { NextResponse } from 'next/server';
import { cachedHealth } from '@/lib/sites/health';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Public uptime check (the "Check health" GitHub Action calls it every 15 minutes): 200 when the main database
 * and every live site's database answer, 503 otherwise. Only counts are shown, never which sites.
 */
export async function GET() {
  const report = await cachedHealth().catch(() => null);
  const ok = Boolean(report?.ok);
  const sites = report?.sites ?? [];
  return NextResponse.json(
    { ok, main: report?.main.ok ? 'ok' : 'down', sites: { total: sites.length, down: sites.filter((s) => !s.ok).length }, checkedAt: report?.checkedAt ?? new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
