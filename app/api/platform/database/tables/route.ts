import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { requirePlatformOwner } from '@/lib/sites/platform';
import { siteTables } from '@/lib/sites/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Platform owner only: one site's tables with rows and approximate size. ?site=main or a site's address. */
export async function GET(request: Request) {
  const { error } = await requirePlatformOwner(request);
  if (error) return error;
  const slug = new URL(request.url).searchParams.get('site') ?? '';
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return jsonError('Pick a site.', 400);
  try {
    const result = await siteTables(slug);
    if (!result) return jsonError('Site not found.', 404);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not read that database.', 502);
  }
}
