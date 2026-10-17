import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { requirePlatformOwner } from '@/lib/sites/platform';
import { databaseOverview } from '@/lib/sites/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Platform owner only: plan usage and every site's database size and reads/writes this month. */
export async function GET(request: Request) {
  const { error } = await requirePlatformOwner(request);
  if (error) return error;
  try {
    return NextResponse.json(await databaseOverview(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not read the databases.', 502);
  }
}
