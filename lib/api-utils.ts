import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';

export const jsonError = (error: string, status: number, details?: unknown) =>
  NextResponse.json(details === undefined ? { error } : { error, details }, { status });

type ParseResult<T> = { data: T; error?: never } | { data?: never; error: NextResponse };

/** Reads the JSON body and validates it with a zod schema; returns a ready 400 response on failure. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<ParseResult<z.output<S>>> {
  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) return { error: jsonError('Request body must be valid JSON.', 400) };
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({ path: issue.path.join('.') || '(body)', message: issue.message }));
    return { error: jsonError('Validation failed.', 400, details) };
  }
  return { data: result.data };
}

/** Parses a numeric id from a route param. */
export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Maps known Prisma errors to HTTP responses; anything else is a 500. */
export function handleDbError(error: unknown, notFound = 'Not found.') {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      type Meta = { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } };
      const meta = error.meta as Meta | undefined;
      const fields = meta?.driverAdapterError?.cause?.constraint?.fields ?? meta?.target ?? 'value';
      // "name" is stored for skill groups but exposed as "group" in the API.
      const label = (Array.isArray(fields) ? fields.join(', ') : fields).replace(/^name$/, 'group');
      return jsonError(`A record with this ${label} already exists.`, 409);
    }
    if (error.code === 'P2025') return jsonError(notFound, 404);
  }
  if (error instanceof Error && error.message === 'NOT_SEEDED') return jsonError('Portfolio database has not been seeded. Run npm run db:setup.', 503);
  console.error(error);
  return jsonError('Internal server error.', 500);
}
