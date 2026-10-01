import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { compileTypst } from '@/lib/resume-builder/compile';
import { getResume } from '@/lib/resume-builder/store';
import { fileSlug, sourceFor } from '@/lib/resume-builder/server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** Makes this resume the site's "Download resume" file (replaces the file in Admin → Resume). */
export async function POST(request: Request, { params }: Context) {
  const { error } = await requireTab(request, 'builder');
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    const resume = await getResume(id);
    if (!resume) return jsonError('Resume not found.', 404);
    const result = compileTypst(sourceFor(resume), { pdf: true });
    if (!result.ok) return jsonError(`The resume code has an error: ${result.errors[0]?.message ?? 'unknown'}`, 422);
    const pdf = result.pdf!;
    const row = {
      fileName: `${fileSlug(resume.data.basics.name || 'Resume')}-Resume.pdf`,
      mimeType: 'application/pdf',
      size: pdf.length,
      data: new Uint8Array(pdf),
      uploadedAt: new Date().toISOString(),
    };
    await prisma.resume.upsert({ where: { id: 1 }, create: { id: 1, ...row }, update: row });
    return NextResponse.json({ fileName: row.fileName, size: row.size, pages: result.pages, url: '/api/resume' });
  } catch (err) {
    return handleDbError(err);
  }
}
