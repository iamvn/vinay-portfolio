import { handleDbError, jsonError, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { compileTypst } from '@/lib/resume-builder/compile';
import { toLatex } from '@/lib/resume-builder/latex';
import { getResume } from '@/lib/resume-builder/store';
import { fileSlug, sourceFor } from '@/lib/resume-builder/server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/**
 * Downloads a saved resume. ?format=pdf (default) | tex (LaTeX, for Overleaf) | typ (Typst code).
 * The LaTeX file is generated from the form content, so code edits made in Typst aren't in it.
 */
export async function GET(request: Request, { params }: Context) {
  const { error } = await requireTab(request, 'builder');
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const format = new URL(request.url).searchParams.get('format') ?? 'pdf';
  try {
    const resume = await getResume(id);
    if (!resume) return jsonError('Resume not found.', 404);
    const base = fileSlug(`${resume.data.basics.name || 'Resume'} ${resume.name}`);
    const attachment = (body: BodyInit, type: string, extension: string) => new Response(body, {
      headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${base}.${extension}"`, 'Cache-Control': 'no-store' },
    });
    if (format === 'tex') return attachment(toLatex(resume.data, resume.template), 'application/x-tex; charset=utf-8', 'tex');
    if (format === 'typ') return attachment(sourceFor(resume), 'text/plain; charset=utf-8', 'typ');
    const result = compileTypst(sourceFor(resume), { pdf: true });
    if (!result.ok) return jsonError(`The resume code has an error: ${result.errors[0]?.message ?? 'unknown'}`, 422);
    return attachment(new Uint8Array(result.pdf!), 'application/pdf', 'pdf');
  } catch (err) {
    return handleDbError(err);
  }
}
