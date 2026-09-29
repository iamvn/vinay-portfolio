import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { nextOrder, toSkillGroup } from '@/lib/portfolio-repository';
import { skillGroupSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const groups = await prisma.skillGroup.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json(groups.map(toSkillGroup));
  } catch (error) {
    return handleDbError(error);
  }
}

/** Adds a skill group at the end. */
export async function POST(request: Request) {
  const { data, error } = await parseBody(request, skillGroupSchema);
  if (error) return error;
  try {
    const group = await prisma.skillGroup.create({
      data: { name: data.group, items: JSON.stringify(data.items), order: await nextOrder('skillGroup') },
    });
    return NextResponse.json(toSkillGroup(group), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
