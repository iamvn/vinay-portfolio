import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { readUpload } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024;
const PATH = '/api/profile-image';

const metadata = (row: { fileName: string; mimeType: string; size: number; uploadedAt: string }) => ({
  fileName: row.fileName,
  mimeType: row.mimeType,
  size: row.size,
  uploadedAt: row.uploadedAt,
  // The version query changes on every upload, so browsers never show a stale picture.
  url: `${PATH}?v=${Date.parse(row.uploadedAt)}`,
});

/** Serves the uploaded profile picture. Add ?meta=1 to get its details as JSON instead. */
export async function GET(request: Request) {
  try {
    const image = await prisma.profileImage.findUnique({ where: { id: 1 } });
    if (!image) return jsonError('No profile picture uploaded yet.', 404);
    const params = new URL(request.url).searchParams;
    if (params.has('meta')) return NextResponse.json(metadata(image));
    return new Response(Buffer.from(image.data), {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': String(image.size),
        'Cache-Control': params.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleDbError(error);
  }
}

/**
 * Uploads (or replaces) the profile picture and points profile.profileImage at it.
 * multipart/form-data with a "file" field; .jpg, .jpeg, .png or .webp, max 2 MB.
 */
export async function POST(request: Request) {
  const { file, error } = await readUpload(request, { jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp' }, MAX_BYTES);
  if (error) return error;
  const row = { ...file, uploadedAt: new Date().toISOString() };
  try {
    const url = metadata(row).url;
    const [image] = await prisma.$transaction([
      prisma.profileImage.upsert({ where: { id: 1 }, create: { id: 1, ...row }, update: row }),
      prisma.profile.update({ where: { id: 1 }, data: { profileImage: url } }),
    ]);
    return NextResponse.json(metadata(image), { status: 201 });
  } catch (err) {
    return handleDbError(err, 'Profile not found. Run npm run db:setup.');
  }
}

/** Deletes the uploaded picture; if the profile was using it, the site falls back to your initials. */
export async function DELETE() {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: 1 } });
    await prisma.$transaction([
      prisma.profileImage.delete({ where: { id: 1 } }),
      ...(profile?.profileImage.startsWith(PATH) ? [prisma.profile.update({ where: { id: 1 }, data: { profileImage: '' } })] : []),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, 'No profile picture uploaded yet.');
  }
}
