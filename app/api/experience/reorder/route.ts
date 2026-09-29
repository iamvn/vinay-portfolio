import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { reorder, toExperience } from '@/lib/portfolio-repository';
import { reorderSchema } from '@/lib/schemas';

/** Body: { "ids": [3, 1, 2, ...] } — every experience id, in the new display order. */
export async function PUT(request: Request) {
  const { data, error } = await parseBody(request, reorderSchema);
  if (error) return error;
  try {
    const problem = await reorder('experience', data.ids);
    if (problem) return jsonError(problem, 400);
    const items = await prisma.experience.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json(items.map(toExperience));
  } catch (err) {
    return handleDbError(err);
  }
}
