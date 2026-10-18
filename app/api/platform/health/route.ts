import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { requirePlatformOwner } from '@/lib/sites/platform';
import { checkHealth, workflowRuns } from '@/lib/sites/health';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Platform owner only: a fresh health check of every database, plus the latest backup and uptime-check runs. */
export async function GET(request: Request) {
  const { error } = await requirePlatformOwner(request);
  if (error) return error;
  try {
    const [health, runs] = await Promise.all([checkHealth(), workflowRuns().catch(() => null)]);
    return NextResponse.json({ ...health, runs }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not check health.', 502);
  }
}
