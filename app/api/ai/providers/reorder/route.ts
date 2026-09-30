import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { publicProvider } from '@/lib/ai/admin';
import { reorderSchema } from '@/lib/schemas';

/** Body { ids: [...] }: every provider id in the new fallback order (first = tried first). Admins only. */
export async function PUT(request: Request) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, reorderSchema);
  if (error) return error;
  try {
    const existing = await prisma.aiProvider.findMany({ select: { id: true } });
    const ids = new Set(existing.map((row) => row.id));
    if (data.ids.length !== ids.size || new Set(data.ids).size !== data.ids.length || !data.ids.every((id) => ids.has(id))) {
      return jsonError('ids must list every provider exactly once.', 400);
    }
    await prisma.$transaction(data.ids.map((id, order) => prisma.aiProvider.update({ where: { id }, data: { order } })));
    const rows = await prisma.aiProvider.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] });
    return NextResponse.json(rows.map(publicProvider));
  } catch (err) {
    return handleDbError(err);
  }
}
