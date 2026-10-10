import { NextResponse } from 'next/server';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { requirePlatformAdmin } from '@/lib/sites/platform';
import { listAll } from '@/lib/support/store';
import { SUPPORT_STATUSES, type SupportStatus } from '@/lib/support/types';

export const dynamic = 'force-dynamic';

/** The platform owner's inbox. ?filter=active (default) | all | open | in-progress | done | declined. */
export async function GET(request: Request) {
  const { site, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!site.isMain) return jsonError('Only the platform owner sees support requests.', 403);
  const raw = new URL(request.url).searchParams.get('filter') ?? 'active';
  const filter = raw === 'all' || raw === 'active' || (SUPPORT_STATUSES as readonly string[]).includes(raw) ? (raw as 'all' | 'active' | SupportStatus) : 'active';
  try {
    return NextResponse.json(await listAll(filter));
  } catch (err) {
    return handleDbError(err);
  }
}
