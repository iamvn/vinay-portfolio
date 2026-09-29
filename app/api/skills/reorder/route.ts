import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { reorder, toSkillGroup } from '@/lib/portfolio-repository';
import { reorderSchema } from '@/lib/schemas';

/** Body: { "ids": [3, 1, 2, ...] } — every skill group id, in the new display order. */
export async function PUT(request: Request) {
  const { data, error } = await parseBody(request, reorderSchema);
  if (error) return error;
  try {
    const problem = await reorder('skillGroup', data.ids);
    if (problem) return jsonError(problem, 400);
    const groups = await prisma.skillGroup.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json(groups.map(toSkillGroup));
  } catch (err) {
    return handleDbError(err);
  }
}
