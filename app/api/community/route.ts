import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { postingSite } from '@/lib/community/author';
import { CommunityError, createPost, listForSite } from '@/lib/community/store';
import { postSchema } from '@/lib/community/types';
import { actorLabel, logActivity } from '@/lib/sites/activity';

export const dynamic = 'force-dynamic';

/** This site's community posts (any status), plus the defaults for a new post's author line. */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'community');
  if (error) return error;
  try {
    const { site, name, role } = await postingSite();
    return NextResponse.json({ posts: await listForSite(site.slug), author: { name, headline: role } });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Shares an interview experience on the community board. */
export async function POST(request: Request) {
  const { user, error: denied } = await requireTab(request, 'community');
  if (denied) return denied;
  const { data, error } = await parseBody(request, postSchema);
  if (error) return error;
  try {
    const { site, name, url } = await postingSite();
    const post = await createPost({ slug: site.slug, name }, actorLabel(user), url, data);
    await logActivity({ ...site, name }, actorLabel(user), 'community.posted', { id: post.id, title: post.title, status: post.status }, { includeMain: true });
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    if (err instanceof CommunityError) return jsonError(err.message, err.status);
    return handleDbError(err);
  }
}
