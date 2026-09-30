import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody, parseId } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { providerPatchSchema, publicProvider, temperatureToColumn } from '@/lib/ai/admin';
import { encryptSecret, keyHint } from '@/lib/ai/crypto';

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = 'Provider not found.';

/** Updates a provider. Send apiKey only to replace the stored key. Admins only. */
export async function PATCH(request: Request, { params }: Context) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const { data, error } = await parseBody(request, providerPatchSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Nothing to update.', 400);
  try {
    const current = await prisma.aiProvider.findUnique({ where: { id } });
    if (!current) return jsonError(NOT_FOUND, 404);
    const { apiKey, temperature, ...fields } = data;
    if ((fields.kind ?? current.kind) !== 'anthropic' && !(fields.baseUrl ?? current.baseUrl)) {
      return jsonError('Validation failed.', 400, [{ path: 'baseUrl', message: 'is required for this provider type' }]);
    }
    const row = await prisma.aiProvider.update({
      where: { id },
      data: {
        ...fields,
        ...(apiKey ? { keyCipher: encryptSecret(apiKey), keyHint: keyHint(apiKey) } : {}),
        ...(temperature !== undefined ? { temperature: temperatureToColumn(temperature) } : {}),
      },
    });
    return NextResponse.json(publicProvider(row));
  } catch (err) {
    return handleDbError(err, NOT_FOUND);
  }
}

/** Removes a provider and its stored key. Admins only. */
export async function DELETE(request: Request, { params }: Context) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  try {
    await prisma.aiProvider.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}
