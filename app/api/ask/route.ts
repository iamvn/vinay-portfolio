import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api-utils';
import { AssistantError, askAssistant, assistantEnabled } from '@/lib/assistant';
import { getAssistantSettings } from '@/lib/ai/settings';
import { recordEvent, startOfTodayUtc } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { clientIp, rateLimited } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_QUESTION = 500;

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2000),
  })).min(1).max(20),
}).strict();

async function usedToday() {
  return prisma.event.count({ where: { type: 'ask', createdAt: { gte: startOfTodayUtc() } } });
}

/** Public: whether the assistant is available, and how many questions are left today. */
export async function GET() {
  if (!(await assistantEnabled())) return NextResponse.json({ enabled: false });
  const limit = (await getAssistantSettings()).dailyLimit;
  const used = await usedToday().catch(() => 0);
  return NextResponse.json({ enabled: true, dailyLimit: limit, remainingToday: Math.max(0, limit - used) });
}

/** Public: body { messages: [{ role, content }, …] } (the last one is the visitor's question) → { answer }. */
export async function POST(request: Request) {
  if (!(await assistantEnabled())) return jsonError('The assistant is not available.', 503);
  const settings = await getAssistantSettings();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Please send a question.', 400);
  // Keep the last few turns only: enough for follow-up questions, small enough to stay cheap.
  const messages = parsed.data.messages.slice(-8);
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const question = messages.at(-1);
  if (!question || question.role !== 'user') return jsonError('Please send a question.', 400);
  if (question.content.length > MAX_QUESTION) return jsonError(`Please keep questions under ${MAX_QUESTION} characters.`, 400);

  const ip = clientIp(request);
  if (rateLimited(`ask:${ip}`, settings.visitorLimit, 10 * 60_000)) return jsonError('You’ve asked a lot of questions in a short time. Please try again in a few minutes.', 429);
  if ((await usedToday()) >= settings.dailyLimit) return jsonError('The assistant has reached today’s question limit. Please use the contact options instead.', 429);

  await recordEvent('ask', question.content.slice(0, 300));
  try {
    const { answer } = await askAssistant(messages);
    return NextResponse.json({ answer });
  } catch (error) {
    const status = error instanceof AssistantError ? error.status : 502;
    return jsonError(error instanceof Error ? error.message : 'The assistant is unavailable right now.', status);
  }
}
