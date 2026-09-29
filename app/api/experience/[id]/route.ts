import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { toExperience } from '@/lib/portfolio-repository';
import { experiencePatchSchema } from '@/lib/schemas';

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = 'Experience entry not found.';

export async function GET(_: Request, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    const item = await prisma.experience.findUnique({ where: { id } });
    return item ? NextResponse.json(toExperience(item)) : jsonError(NOT_FOUND, 404);
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}

/** Partial update: role, company, period, current, bullets (bullets replaces the whole list). */
export async function PATCH(request: Request, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, experiencePatchSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Send at least one of: role, company, period, current, bullets.', 400);
  try {
    const { bullets, ...fields } = data;
    const item = await prisma.experience.update({
      where: { id },
      data: { ...fields, ...(bullets ? { bullets: JSON.stringify(bullets) } : {}) },
    });
    return NextResponse.json(toExperience(item));
  } catch (err) {
    return handleDbError(err, NOT_FOUND);
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    await prisma.experience.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}
