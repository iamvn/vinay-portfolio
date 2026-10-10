import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { requireAnyTab } from '@/lib/auth/roles';
import { assetUrl, completeAsset, getAsset } from '@/lib/assets';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** Finishes an upload once every part has arrived. */
export async function POST(request: Request, { params }: Context) {
  const { error } = await requireAnyTab(request, ['design', 'projects']);
  if (error) return error;
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) return jsonError('Upload not found.', 404);
  try {
    const done = asset.status === 'ready' ? asset : await completeAsset(asset);
    return NextResponse.json({ id: done.id, fileName: done.fileName, size: done.size, uploadedAt: done.uploadedAt, url: assetUrl(done) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not finish the upload.', 400);
  }
}
