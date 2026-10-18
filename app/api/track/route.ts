import { CLIENT_EVENT_TYPES, recordEvent, type EventType } from '@/lib/events';
import { clientIp, rateLimited } from '@/lib/rate-limit';
import { recordGoal, signedIn } from '@/lib/traffic';

/** Public: the site reports contact clicks and link card views here (Admin → Insights). Body: { type }. Always 204. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;
  const type = body?.type as EventType;
  if (CLIENT_EVENT_TYPES.includes(type) && !rateLimited(`track:${clientIp(request)}`, 20, 60_000)) {
    // Link card views: your own visits while signed in aren't counted.
    if (type === 'linkcard_view') { if (!signedIn(request)) await recordEvent(type); }
    else if (type !== 'linkcard_click') await Promise.all([recordEvent(type), recordGoal(request, type)]);
  }
  return new Response(null, { status: 204 });
}
