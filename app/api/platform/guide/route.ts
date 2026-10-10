import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { guideUpdateSchema } from '@/lib/guide/content';
import { getGuide, updateGuide } from '@/lib/guide/store';
import { requirePlatformAdmin } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';

async function owner(request: Request) {
  const { site, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!site.isMain) return jsonError('Only the platform owner can edit the Guide.', 403);
  return null;
}

/** The Guide as every admin sees it, plus which tabs have custom text. */
export async function GET(request: Request) {
  const denied = await owner(request);
  if (denied) return denied;
  try { return NextResponse.json(await getGuide()); } catch (err) { return handleDbError(err); }
}

/** Changes the Guide for every site. Body: { intro?, tabs?: { applications: { summary, features } | null } }. */
export async function PUT(request: Request) {
  const denied = await owner(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, guideUpdateSchema);
  if (error) return error;
  try { return NextResponse.json(await updateGuide(data)); } catch (err) { return handleDbError(err); }
}
