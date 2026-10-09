import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { requireAnyTab } from '@/lib/auth/roles';
import { PART_BYTES, getAsset, savePart } from '@/lib/assets';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; n: string }> };

/** One part of an upload (raw bytes, at most 3 MB: Vercel caps requests at 4.5 MB). */
export async function PUT(request: Request, { params }: Context) {
  const { error } = await requireAnyTab(request, ['design', 'projects']);
  if (error) return error;
  const { id, n } = await params;
  const asset = await getAsset(id);
  if (!asset || asset.status !== 'uploading') return jsonError('Upload not found (it may have finished or expired).', 404);
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > PART_BYTES) return jsonError('Part too large.', 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  try {
    await savePart(asset, Number(n), bytes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not save this part.', 400);
  }
}
