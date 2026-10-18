import { NextResponse } from 'next/server';
import { recordEvent } from '@/lib/events';
import { getCard } from '@/lib/linkcard/store';
import { resolveUrl } from '@/lib/linkcard/types';
import { clientIp, rateLimited } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * A link on the card: counts the click (Admin → Link card), then sends the visitor on. Only goes to links
 * saved on the card, so it can't be used to redirect anywhere else.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCard().catch(() => null);
  const link = card?.enabled ? card.links.find((l) => l.id === id && l.enabled) : undefined;
  if (!link) return NextResponse.redirect(new URL('/details', request.url), 302);
  const bot = /bot|crawl|spider|preview|facebookexternalhit|slack|whatsapp|telegram|discord/i.test(request.headers.get('user-agent') ?? '');
  const own = /portfolio_session=/.test(request.headers.get('cookie') ?? '');
  if (!bot && !own && !rateLimited(`lc:${clientIp(request)}`, 30, 60_000)) await recordEvent('linkcard_click', link.id);
  const url = resolveUrl(link.url);
  return NextResponse.redirect(/^https?:/i.test(url) ? url : new URL(url, request.url), 302);
}
