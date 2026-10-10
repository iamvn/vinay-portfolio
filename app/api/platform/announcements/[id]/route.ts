import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { announcementPatchSchema } from '@/lib/guide/content';
import { removeAnnouncement, updateAnnouncement } from '@/lib/guide/store';
import { requirePlatformAdmin } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function owner(request: Request) {
  const { site, error } = await requirePlatformAdmin(request);
  if (error) return error;
  return site.isMain ? null : jsonError('Only the platform owner can send announcements.', 403);
}

/** Turns an announcement on or off, or edits it. */
export async function PATCH(request: Request, { params }: Context) {
  const denied = await owner(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, announcementPatchSchema);
  if (error) return error;
  try {
    const item = await updateAnnouncement((await params).id, data);
    return item ? NextResponse.json(item) : jsonError('Announcement not found.', 404);
  } catch (err) { return handleDbError(err); }
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = await owner(request);
  if (denied) return denied;
  try {
    return (await removeAnnouncement((await params).id)) ? new Response(null, { status: 204 }) : jsonError('Announcement not found.', 404);
  } catch (err) { return handleDbError(err); }
}
