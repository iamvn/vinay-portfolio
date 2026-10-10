import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { announcementSchema } from '@/lib/guide/content';
import { addAnnouncement, listAnnouncements } from '@/lib/guide/store';
import { actorLabel } from '@/lib/sites/activity';
import { requirePlatformAdmin } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';

/** Every announcement (showing or not), for the platform owner. */
export async function GET(request: Request) {
  const { site, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!site.isMain) return jsonError('Only the platform owner can send announcements.', 403);
  try { return NextResponse.json(await listAnnouncements()); } catch (err) { return handleDbError(err); }
}

/** Broadcasts a message to every site's admins. */
export async function POST(request: Request) {
  const { user, site, error: denied } = await requirePlatformAdmin(request);
  if (denied) return denied;
  if (!site.isMain) return jsonError('Only the platform owner can send announcements.', 403);
  const { data, error } = await parseBody(request, announcementSchema);
  if (error) return error;
  try { return NextResponse.json(await addAnnouncement(data, actorLabel(user)), { status: 201 }); } catch (err) { return handleDbError(err); }
}
