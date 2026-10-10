import { NextResponse } from 'next/server';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { listAll } from '@/lib/community/store';
import { requirePlatformAdmin } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';

/** Every community post, for the platform owner (?q=&status=published|draft|hidden). */
export async function GET(request: Request) {
  const { site: manager, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!manager.isMain) return jsonError('Only the platform owner can moderate the community.', 403);
  const params = new URL(request.url).searchParams;
  const status = params.get('status') ?? '';
  try {
    return NextResponse.json(await listAll({ q: params.get('q')?.trim().slice(0, 100) ?? '', status: ['published', 'draft', 'hidden'].includes(status) ? status : '' }));
  } catch (err) {
    return handleDbError(err);
  }
}
