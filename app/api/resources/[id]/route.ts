import { NextResponse } from 'next/server';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { hideResource } from '@/lib/community/resources';
import { requirePlatformOwner } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';

/** The platform owner removes a link from the free resources library. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePlatformOwner(request);
  if (error) return error;
  try {
    return (await hideResource((await params).id)) ? NextResponse.json({ ok: true }) : jsonError('Not found.', 404);
  } catch (err) {
    return handleDbError(err);
  }
}
