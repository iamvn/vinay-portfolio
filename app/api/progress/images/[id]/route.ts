import { handleDbError, jsonError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { getImage } from '@/lib/progress/store';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** One of the signed-in user's own vision-board pictures. */
export async function GET(request: Request, { params }: Context) {
  const { user, error } = await requireTab(request, 'progress');
  if (error) return error;
  try {
    const image = await getImage(user.id, (await params).id);
    if (!image) return jsonError('Not found.', 404);
    return new Response(new Uint8Array(image.bytes), {
      headers: { 'Content-Type': image.type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (err) {
    return handleDbError(err);
  }
}
