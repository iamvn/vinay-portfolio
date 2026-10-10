import { NextResponse } from 'next/server';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { userFromRequest } from '@/lib/auth/session';
import { getGuide, liveAnnouncements } from '@/lib/guide/store';

export const dynamic = 'force-dynamic';

/** For any signed-in user on any site: the Guide's text and the announcements showing now. */
export async function GET(request: Request) {
  if (!(await userFromRequest(request))) return jsonError('Not logged in.', 401);
  try {
    const [guide, announcements] = await Promise.all([getGuide(), liveAnnouncements()]);
    return NextResponse.json({ guide: { intro: guide.intro, tabs: guide.tabs }, announcements: announcements.map(({ by: _by, ...a }) => a) }); // eslint-disable-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return handleDbError(err);
  }
}
