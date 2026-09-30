import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError, parseId } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { testProvider } from '@/lib/assistant';
import { decryptSecret } from '@/lib/ai/crypto';
import type { ProviderKind } from '@/lib/ai/providers';

type Context = { params: Promise<{ id: string }> };

/** Sends a tiny test prompt with the saved settings and key. Admins only. → { ok, answer?, ms?, error? } */
export async function POST(request: Request, { params }: Context) {
  const { error: denied } = await requireTab(request, 'ai');
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return jsonError('id must be a positive integer.', 400);
  const row = await prisma.aiProvider.findUnique({ where: { id } });
  if (!row) return jsonError('Provider not found.', 404);
  const apiKey = row.keyCipher ? decryptSecret(row.keyCipher) : null;
  if (!apiKey) return NextResponse.json({ ok: false, error: 'The saved API key can’t be read (missing, or AUTH_SECRET changed). Enter the key again.' });
  const temperature = row.temperature === '' ? undefined : Number(row.temperature);
  try {
    const result = await testProvider({ name: row.name, kind: row.kind as ProviderKind, baseUrl: row.baseUrl, model: row.model, apiKey, temperature });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Test failed.' });
  }
}
