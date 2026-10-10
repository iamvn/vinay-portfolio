import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { projectsWithOwnDesign } from '@/lib/design/store';

export const dynamic = 'force-dynamic';

/** Projects and which design their page uses (Admin → Design → Project pages). */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'design');
  if (error) return error;
  try {
    const [projects, own] = await Promise.all([
      prisma.project.findMany({ orderBy: { id: 'asc' }, select: { slug: true, title: true, type: true, published: true } }),
      projectsWithOwnDesign(),
    ]);
    const bySlug = new Map(own.map((o) => [o.slug, o.live]));
    return NextResponse.json(projects.filter((p) => p.type !== 'link').map((p) => ({
      slug: p.slug, title: p.title, published: p.published,
      // 'live': its own design is live · 'draft': has its own draft, still uses the shared one · null: shared
      own: bySlug.has(p.slug) ? (bySlug.get(p.slug) ? 'live' : 'draft') : null,
    })));
  } catch (err) {
    return handleDbError(err);
  }
}
