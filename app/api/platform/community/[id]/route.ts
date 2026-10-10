import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { removePost, setHidden } from '@/lib/community/store';
import { actorLabel, logActivity } from '@/lib/sites/activity';
import { requirePlatformAdmin } from '@/lib/sites/platform';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** Hides a post from the board (or shows it again). Body: { hidden: boolean }. */
export async function PATCH(request: Request, { params }: Context) {
  const { user, site: manager, error: denied } = await requirePlatformAdmin(request);
  if (denied) return denied;
  if (!manager.isMain) return jsonError('Only the platform owner can moderate the community.', 403);
  const { data, error } = await parseBody(request, z.object({ hidden: z.boolean() }).strict());
  if (error) return error;
  try {
    const post = await setHidden((await params).id, data.hidden);
    if (!post) return jsonError('Post not found.', 404);
    await logActivity(manager, actorLabel(user), data.hidden ? 'community.hidden' : 'community.shown', { id: post.id, title: post.title, from: post.siteName }, { includeMain: true });
    return NextResponse.json(post);
  } catch (err) {
    return handleDbError(err);
  }
}

/** Removes a post for good. */
export async function DELETE(request: Request, { params }: Context) {
  const { user, site: manager, error } = await requirePlatformAdmin(request);
  if (error) return error;
  if (!manager.isMain) return jsonError('Only the platform owner can moderate the community.', 403);
  try {
    const post = await removePost((await params).id);
    if (!post) return jsonError('Post not found.', 404);
    await logActivity(manager, actorLabel(user), 'community.removed', { id: post.id, title: post.title, from: post.siteName }, { includeMain: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
