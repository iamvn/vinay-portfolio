import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { postingSite } from '@/lib/community/author';
import { deletePost, updatePost } from '@/lib/community/store';
import { postSchema } from '@/lib/community/types';
import { actorLabel, logActivity, loggedRecently } from '@/lib/sites/activity';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** Edits one of this site's posts (also publish / unpublish). */
export async function PUT(request: Request, { params }: Context) {
  const { user, error: denied } = await requireTab(request, 'community');
  if (denied) return denied;
  const { data, error } = await parseBody(request, postSchema);
  if (error) return error;
  try {
    const { id } = await params;
    const { site, name, url } = await postingSite();
    const post = await updatePost(site.slug, id, data, url);
    if (!post) return jsonError('Post not found.', 404);
    // Several saves in a row are one entry in the log.
    if (!(await loggedRecently('community.updated', post.id))) {
      await logActivity({ ...site, name }, actorLabel(user), 'community.updated', { id: post.id, title: post.title, status: post.status }, { includeMain: true });
    }
    return NextResponse.json(post);
  } catch (err) {
    return handleDbError(err);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const { user, error } = await requireTab(request, 'community');
  if (error) return error;
  try {
    const { id } = await params;
    const { site, name } = await postingSite();
    const post = await deletePost(site.slug, id);
    if (!post) return jsonError('Post not found.', 404);
    await logActivity({ ...site, name }, actorLabel(user), 'community.deleted', { id: post.id, title: post.title }, { includeMain: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleDbError(err);
  }
}
