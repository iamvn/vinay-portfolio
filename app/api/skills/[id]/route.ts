import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { toSkillGroup } from '@/lib/portfolio-repository';
import { skillGroupPatchSchema } from '@/lib/schemas';

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = 'Skill group not found.';

export async function GET(_: Request, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    const group = await prisma.skillGroup.findUnique({ where: { id } });
    return group ? NextResponse.json(toSkillGroup(group)) : jsonError(NOT_FOUND, 404);
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}

/** Update the group name and/or replace its items list. */
export async function PATCH(request: Request, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, skillGroupPatchSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Send group and/or items.', 400);
  try {
    const group = await prisma.skillGroup.update({
      where: { id },
      data: { ...(data.group ? { name: data.group } : {}), ...(data.items ? { items: JSON.stringify(data.items) } : {}) },
    });
    return NextResponse.json(toSkillGroup(group));
  } catch (err) {
    return handleDbError(err, NOT_FOUND);
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    await prisma.skillGroup.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}
