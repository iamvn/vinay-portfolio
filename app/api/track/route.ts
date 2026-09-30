import { CLIENT_EVENT_TYPES, recordEvent, type EventType } from '@/lib/events';
import { clientIp, rateLimited } from '@/lib/rate-limit';

/** Public: the site reports contact clicks here (Admin → Insights). Body: { type }. Always 204. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;
  const type = body?.type as EventType;
  if (CLIENT_EVENT_TYPES.includes(type) && !rateLimited(`track:${clientIp(request)}`, 20, 60_000)) {
    await recordEvent(type);
  }
  return new Response(null, { status: 204 });
}
