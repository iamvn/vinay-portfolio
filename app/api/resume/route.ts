import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { readUpload } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

// Vercel rejects request bodies over 4.5 MB, so keep uploads safely below that.
const MAX_BYTES = 4 * 1024 * 1024;

const metadata = (row: { fileName: string; mimeType: string; size: number; uploadedAt: string }) =>
  ({ fileName: row.fileName, mimeType: row.mimeType, size: row.size, uploadedAt: row.uploadedAt, url: '/api/resume' });

/** Downloads the current resume. Add ?meta=1 to get its details as JSON instead. */
export async function GET(request: Request) {
  try {
    const resume = await prisma.resume.findUnique({ where: { id: 1 } });
    if (!resume) return jsonError('No resume uploaded yet.', 404);
    if (new URL(request.url).searchParams.has('meta')) return NextResponse.json(metadata(resume));
    return new Response(Buffer.from(resume.data), {
      headers: {
        'Content-Type': resume.mimeType,
        'Content-Length': String(resume.size),
        'Content-Disposition': `attachment; filename="${resume.fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleDbError(error);
  }
}

/** Uploads (or replaces) the resume. multipart/form-data with a "file" field; .pdf or .docx only, max 4 MB. */
export async function POST(request: Request) {
  const { file, error } = await readUpload(request, { pdf: 'pdf', docx: 'docx' }, MAX_BYTES);
  if (error) return error;
  const row = { ...file, uploadedAt: new Date().toISOString() };
  try {
    const resume = await prisma.resume.upsert({ where: { id: 1 }, create: { id: 1, ...row }, update: row });
    return NextResponse.json(metadata(resume), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}

export async function DELETE() {
  try {
    await prisma.resume.delete({ where: { id: 1 } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, 'No resume uploaded yet.');
  }
}
