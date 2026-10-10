import { clientIp, rateLimited } from '@/lib/rate-limit';
import { recordDuration, recordView } from '@/lib/traffic';

/**
 * Public: the site's pages report views here for Admin → Insights (components/visit-tracker.tsx).
 *   { t: "view", id, path, referrer, load, utm: { source, medium, campaign } }  a page was shown
 *   { t: "leave", id, ms }                                                    time it was on screen
 * Always 204, so it never tells anyone anything and never breaks a page.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (value: unknown, max = 300) => (typeof value === 'string' ? value.slice(0, max) : '');
  if (body && !rateLimited(`collect:${clientIp(request)}`, 120, 60_000)) {
    if (body.t === 'view') {
      const utm = (body.utm && typeof body.utm === 'object' ? body.utm : {}) as Record<string, unknown>;
      await recordView(request, {
        id: text(body.id, 64), path: text(body.path), referrer: text(body.referrer, 1000), load: body.load === true,
        utmSource: text(utm.source, 80), utmMedium: text(utm.medium, 80), utmCampaign: text(utm.campaign, 80),
      });
    } else if (body.t === 'leave') {
      await recordDuration(text(body.id, 64), Number(body.ms));
    }
  }
  return new Response(null, { status: 204 });
}
