import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth/roles';
import { assistantSettingsSchema, getAssistantSettings, saveAssistantSettings } from '@/lib/ai/settings';

export const dynamic = 'force-dynamic';

/** Assistant settings. Admins only. */
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  return NextResponse.json(await getAssistantSettings());
}

/** Partial update: { enabled?, dailyLimit?, visitorLimit?, maxTokens? }. Admins only. */
export async function PATCH(request: Request) {
  const { error: denied } = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, assistantSettingsSchema.partial().strict());
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Nothing to update.', 400);
  try {
    return NextResponse.json(await saveAssistantSettings(data));
  } catch (err) {
    return handleDbError(err);
  }
}
