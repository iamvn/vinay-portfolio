import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { requireAnyTab } from '@/lib/auth/roles';
import { MAX_FILE_BYTES, MAX_SITE_BYTES, PART_BYTES, assetUrl, createAsset, listAssets, partCount, usedBytes } from '@/lib/assets';

export const dynamic = 'force-dynamic';

/** Uploaded PDFs, for the project editor and PDF blocks in Admin → Design. */
export async function GET(request: Request) {
  const { error } = await requireAnyTab(request, ['design', 'projects']);
  if (error) return error;
  const [assets, used] = await Promise.all([listAssets(), usedBytes()]);
  return NextResponse.json({
    assets: assets.map((a) => ({ id: a.id, fileName: a.fileName, size: a.size, uploadedAt: a.uploadedAt, url: assetUrl(a) })),
    usedBytes: used, maxSiteBytes: MAX_SITE_BYTES, maxFileBytes: MAX_FILE_BYTES,
  });
}

const startSchema = z.object({ fileName: z.string().trim().min(1).max(300), size: z.number().int().positive(), mimeType: z.literal('application/pdf') }).strict();

/** Starts an upload: send the parts to /api/assets/<id>/parts/<n>, then POST /api/assets/<id>/complete. */
export async function POST(request: Request) {
  const { user, error } = await requireAnyTab(request, ['design', 'projects']);
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, startSchema);
  if (invalid) return invalid;
  if (!/\.pdf$/i.test(data.fileName)) return jsonError('Only PDF files can be uploaded here.', 415);
  try {
    const asset = await createAsset({ ...data, uploadedBy: user.email });
    return NextResponse.json({ id: asset.id, partBytes: PART_BYTES, parts: partCount(asset.size) }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not start the upload.', 400);
  }
}
