import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { MAX_SOURCE_LENGTH, compileTypst } from '@/lib/resume-builder/compile';

export const dynamic = 'force-dynamic';

const schema = z.object({ source: z.string().max(MAX_SOURCE_LENGTH) }).strict();

/**
 * Live preview: compiles Typst code and returns the pages as one SVG.
 * Compile errors come back as 200 with ok: false (they're expected while typing).
 */
export async function POST(request: Request) {
  const { error: denied } = await requireTab(request, 'builder');
  if (denied) return denied;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  const started = Date.now();
  const result = compileTypst(data.source, { svg: true });
  return NextResponse.json({ ...result, ms: Date.now() - started });
}
