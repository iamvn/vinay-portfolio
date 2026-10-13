import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { requirePlatformAdmin } from '@/lib/sites/platform';
import { platformUsage } from '@/lib/sites/usage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Platform owner only: sign-ins, visitors, content and database usage for every site. */
export async function GET(request: Request) {
  const { site, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!site.isMain) return jsonError('Only the platform owner can see usage.', 403);
  try {
    return NextResponse.json(await platformUsage(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not read usage.', 502);
  }
}
