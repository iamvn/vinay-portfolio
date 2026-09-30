import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { providerCreateSchema, publicProvider, temperatureToColumn } from '@/lib/ai/admin';
import { encryptSecret, keyHint } from '@/lib/ai/crypto';
import { PROVIDER_PRESETS } from '@/lib/ai/providers';

export const dynamic = 'force-dynamic';

/** Providers in fallback order, plus presets for the "Add provider" form. Admins only. */
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const rows = await prisma.aiProvider.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] });
    return NextResponse.json({
      providers: rows.map(publicProvider),
      presets: PROVIDER_PRESETS,
      // True when no provider is set up here but ANTHROPIC_API_KEY exists in the environment.
      environmentFallback: rows.length === 0 && Boolean(process.env.ANTHROPIC_API_KEY),
    });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Adds a provider at the end of the fallback order. Admins only. */
export async function POST(request: Request) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, providerCreateSchema);
  if (error) return error;
  try {
    const last = await prisma.aiProvider.findFirst({ orderBy: { order: 'desc' } });
    const { apiKey, temperature, ...fields } = data;
    const row = await prisma.aiProvider.create({
      data: { ...fields, keyCipher: encryptSecret(apiKey), keyHint: keyHint(apiKey), temperature: temperatureToColumn(temperature), order: (last?.order ?? -1) + 1, createdAt: new Date().toISOString() },
    });
    return NextResponse.json(publicProvider(row), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
