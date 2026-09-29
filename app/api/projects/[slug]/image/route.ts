import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { isUploadedProjectImage, projectImageUrl } from '@/lib/portfolio-repository';
import { readUpload } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };
const MAX_BYTES = 2 * 1024 * 1024;
const NO_IMAGE = 'This project has no uploaded image.';

const metadata = (row: { slug: string; fileName: string; mimeType: string; size: number; uploadedAt: string }) =>
  ({ fileName: row.fileName, mimeType: row.mimeType, size: row.size, uploadedAt: row.uploadedAt, url: projectImageUrl(row.slug, row.uploadedAt) });

/** Serves the project's uploaded image. Add ?meta=1 for its details as JSON. */
export async function GET(request: Request, { params }: Context) {
  const { slug } = await params;
  try {
    const image = await prisma.projectImage.findUnique({ where: { slug } });
    if (!image) return jsonError(NO_IMAGE, 404);
    const query = new URL(request.url).searchParams;
    if (query.has('meta')) return NextResponse.json(metadata(image));
    return new Response(Buffer.from(image.data), {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': String(image.size),
        'Cache-Control': query.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleDbError(error);
  }
}

/** Uploads (or replaces) the project image and sets the project's "image" to it. .jpg/.jpeg/.png/.webp, max 2 MB. */
export async function POST(request: Request, { params }: Context) {
  const { slug } = await params;
  const { file, error } = await readUpload(request, { jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp' }, MAX_BYTES);
  if (error) return error;
  const row = { ...file, uploadedAt: new Date().toISOString() };
  try {
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) return jsonError('Project not found.', 404);
    const [image] = await prisma.$transaction([
      prisma.projectImage.upsert({ where: { slug }, create: { slug, ...row }, update: row }),
      prisma.project.update({ where: { slug }, data: { image: projectImageUrl(slug, row.uploadedAt) } }),
    ]);
    return NextResponse.json(metadata(image), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Removes the uploaded image; the card falls back to the initials placeholder. */
export async function DELETE(_: Request, { params }: Context) {
  const { slug } = await params;
  try {
    const project = await prisma.project.findUnique({ where: { slug } });
    await prisma.$transaction([
      prisma.projectImage.delete({ where: { slug } }),
      ...(project && isUploadedProjectImage(slug, project.image) ? [prisma.project.update({ where: { slug }, data: { image: '' } })] : []),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, NO_IMAGE);
  }
}
