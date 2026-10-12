import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { getBoard, saveBoard } from '@/lib/progress/store';
import { boardSchema } from '@/lib/progress/types';

export const dynamic = 'force-dynamic';

/** The signed-in user's own Progress tracker (goal, focus areas, board, vision board). Private to them. */
export async function GET(request: Request) {
  const { user, error } = await requireTab(request, 'progress');
  if (error) return error;
  try {
    return NextResponse.json(await getBoard(user.id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Saves the whole board (the tab auto-saves a moment after each change). */
export async function PUT(request: Request) {
  const { user, error } = await requireTab(request, 'progress');
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, boardSchema);
  if (invalid) return invalid;
  try {
    return NextResponse.json(await saveBoard(user.id, data));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Your plan')) return jsonError(err.message, 413);
    return handleDbError(err);
  }
}
