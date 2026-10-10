import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { ACTIVITY_GROUPS, ACTIVITY_KINDS, activityStats, actorLabel, clearActivity, listActivity, logActivity } from '@/lib/sites/activity';
import { requirePlatformAdmin } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';

/**
 * The activity log (main site's admins only). Query: ?limit=50&offset=0&site=<slug>&kind=<kind or "user."/"site.">&q=<text>
 */
export async function GET(request: Request) {
  const { site: manager, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!manager.isMain) return jsonError('Only the platform owner can see the activity log.', 403);
  const params = new URL(request.url).searchParams;
  const number = (name: string, fallback: number, max: number) => {
    const value = Number(params.get(name));
    return Number.isInteger(value) && value >= 0 ? Math.min(value, max) : fallback;
  };
  const kind = params.get('kind') ?? '';
  if (kind && !(ACTIVITY_KINDS as readonly string[]).includes(kind) && !(ACTIVITY_GROUPS as readonly string[]).includes(kind)) return jsonError('Unknown activity type.', 400);
  const result = await listActivity({
    limit: number('limit', 50, 200) || 50,
    offset: number('offset', 0, 1_000_000),
    site: params.get('site')?.trim() || undefined,
    kind: kind || undefined,
    search: params.get('q')?.trim().slice(0, 100) || undefined,
  });
  return NextResponse.json({ ...result, stats: await activityStats() });
}

/**
 * Frees space: deletes log entries older than 7, 15 or 30 days, or all of them (?olderThan=7|15|30|all).
 * One entry saying what was cleared is kept, so the log shows who cleared it and when.
 */
export async function DELETE(request: Request) {
  const { user, site: manager, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!manager.isMain) return jsonError('Only the platform owner can clear the activity log.', 403);
  const olderThan = new URL(request.url).searchParams.get('olderThan') ?? '';
  if (!['7', '15', '30', 'all'].includes(olderThan)) return jsonError('Choose 7, 15 or 30 days, or all.', 400);
  const days = olderThan === 'all' ? null : Number(olderThan);
  const deleted = await clearActivity(days);
  await logActivity(manager, actorLabel(user), 'log.cleared', { scope: days === null ? 'all entries' : `entries older than ${days} days`, deleted: String(deleted) }, { includeMain: true });
  return NextResponse.json({ deleted, stats: await activityStats() });
}
