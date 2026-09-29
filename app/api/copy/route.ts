import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError } from '@/lib/api-utils';
import { copySchema } from '@/lib/schemas';
import { parseCopy } from '@/lib/portfolio-repository';

export const dynamic = 'force-dynamic';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);

/** Deep-merges objects; arrays and plain values are replaced. */
function deepMerge(target: Json, patch: Json): Json {
  const result: Json = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = isObject(value) && isObject(target[key]) ? deepMerge(target[key] as Json, value) : value;
  }
  return result;
}

export async function GET() {
  try {
    const copy = await prisma.siteCopy.findUnique({ where: { id: 1 } });
    return copy ? NextResponse.json(parseCopy(copy.content)) : jsonError('Site copy not found. Run npm run db:setup.', 404);
  } catch (error) {
    return handleDbError(error);
  }
}

/** Partial, nested update, e.g. { "hero": { "greeting": "Hi, I'm" } }. Arrays are replaced whole. */
export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  if (!isObject(body) || Object.keys(body).length === 0) return jsonError('Request body must be a non-empty JSON object.', 400);
  try {
    const current = await prisma.siteCopy.findUnique({ where: { id: 1 } });
    if (!current) return jsonError('Site copy not found. Run npm run db:setup.', 404);
    const result = copySchema.safeParse(deepMerge(parseCopy(current.content) as Json, body));
    if (!result.success) {
      return jsonError('Validation failed.', 400, result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })));
    }
    await prisma.siteCopy.update({ where: { id: 1 }, data: { content: JSON.stringify(result.data) } });
    return NextResponse.json(result.data);
  } catch (error) {
    return handleDbError(error);
  }
}
