import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/** Assistant settings, editable in Admin → AI assistant. Stored as JSON in the Setting table. */
export const assistantSettingsSchema = z.object({
  enabled: z.boolean(),
  dailyLimit: z.number().int().min(1).max(10_000),     // questions per day, all visitors together
  visitorLimit: z.number().int().min(1).max(100),      // questions per visitor per 10 minutes
  maxTokens: z.number().int().min(100).max(4000),      // longest answer (raise it for reasoning models)
}).strict();

export type AssistantSettings = z.infer<typeof assistantSettingsSchema>;

export const DEFAULT_SETTINGS: AssistantSettings = {
  enabled: true,
  dailyLimit: Math.max(1, Number(process.env.ASK_DAILY_LIMIT) || 100),
  visitorLimit: 8,
  maxTokens: 450,
};

export async function getAssistantSettings(): Promise<AssistantSettings> {
  const row = await prisma.setting.findUnique({ where: { key: 'assistant' } }).catch(() => null);
  if (!row) return DEFAULT_SETTINGS;
  const parsed = assistantSettingsSchema.partial().safeParse(JSON.parse(row.value));
  return { ...DEFAULT_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}

export async function saveAssistantSettings(patch: Partial<AssistantSettings>) {
  const next = { ...(await getAssistantSettings()), ...patch };
  await prisma.setting.upsert({ where: { key: 'assistant' }, create: { key: 'assistant', value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
  return next;
}
