import { NextResponse } from 'next/server';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { userFromRequest } from '@/lib/auth/session';
import { getGuide, liveAnnouncements } from '@/lib/guide/store';
import { freshSite } from '@/lib/sites/require-feature';
import { missingFor } from '@/lib/support/access';
import { openCount } from '@/lib/support/store';

export const dynamic = 'force-dynamic';

/**
 * For any signed-in user on any site: the Guide's text, the announcements showing now, which tabs and
 * features they can't use (so they can ask for them), and for the platform owner how many requests are open.
 */
export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return jsonError('Not logged in.', 401);
  try {
    const site = await freshSite();
    const isOwner = site.isMain && user.role === 'admin';
    const [guide, announcements, supportOpen] = await Promise.all([getGuide(), liveAnnouncements(), isOwner ? openCount() : Promise.resolve(0)]);
    return NextResponse.json({
      guide: { intro: guide.intro, tabs: guide.tabs },
      announcements: announcements.map(({ by: _by, ...a }) => a), // eslint-disable-line @typescript-eslint/no-unused-vars
      missing: missingFor(user, site, isOwner),
      supportOpen,
    });
  } catch (err) {
    return handleDbError(err);
  }
}
