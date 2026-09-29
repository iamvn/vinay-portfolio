import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { nextOrder, toExperience } from '@/lib/portfolio-repository';
import { experienceSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await prisma.experience.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json(items.map(toExperience));
  } catch (error) {
    return handleDbError(error);
  }
}

/** Adds an experience entry at the end of the timeline (use /api/experience/reorder to move it). */
export async function POST(request: Request) {
  const { data, error } = await parseBody(request, experienceSchema);
  if (error) return error;
  try {
    const item = await prisma.experience.create({
      data: { ...data, bullets: JSON.stringify(data.bullets), order: await nextOrder('experience') },
    });
    return NextResponse.json(toExperience(item), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
