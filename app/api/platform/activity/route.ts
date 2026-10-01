import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { ACTIVITY_KINDS, listActivity } from '@/lib/sites/activity';
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
  if (kind && !(ACTIVITY_KINDS as readonly string[]).includes(kind) && kind !== 'user.' && kind !== 'site.') return jsonError('Unknown activity type.', 400);
  const result = await listActivity({
    limit: number('limit', 50, 200) || 50,
    offset: number('offset', 0, 1_000_000),
    site: params.get('site')?.trim() || undefined,
    kind: kind || undefined,
    search: params.get('q')?.trim().slice(0, 100) || undefined,
  });
  return NextResponse.json(result);
}
