import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { addImage } from '@/lib/progress/store';

export const dynamic = 'force-dynamic';

/** Adds a vision-board picture (already resized in the browser). Returns its id. */
export async function POST(request: Request) {
  const { user, error } = await requireTab(request, 'progress');
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, z.object({ dataUrl: z.string().max(1_000_000) }));
  if (invalid) return invalid;
  try {
    return NextResponse.json({ id: await addImage(user.id, data.dataUrl) }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /picture/i.test(err.message)) return jsonError(err.message, 400);
    return handleDbError(err);
  }
}
