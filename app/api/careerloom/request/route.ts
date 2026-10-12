import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { clientIp, rateLimited } from '@/lib/rate-limit';
import { logActivity } from '@/lib/sites/activity';
import { currentSite } from '@/lib/sites/context';
import { SupportLimitError, createLead } from '@/lib/support/store';
import { leadSchema } from '@/lib/support/types';

export const dynamic = 'force-dynamic';

/**
 * "Request access" on the Careerloom company page: a visitor asks for a site of their own. Public (no login);
 * it lands in the platform owner's Support inbox as a "New customer". Only on the main site.
 */
export async function POST(request: Request) {
  const site = await currentSite();
  if (!site.isMain) return jsonError('Not found.', 404);
  const ip = clientIp(request);
  if (rateLimited(`lead:${ip}`, 5, 60 * 60 * 1000)) return jsonError('Too many requests. Please try again later.', 429);
  const { data, error } = await parseBody(request, leadSchema);
  if (error) return error;
  // Bots fill in the hidden field: answer as if it worked, store nothing.
  if (data.website) return NextResponse.json({ ok: true }, { status: 201 });
  const sender = createHash('sha256').update(`${process.env.AUTH_SECRET || 'careerloom'}|lead|${ip}`).digest('base64url').slice(0, 22);
  try {
    await createLead(data, sender);
    await logActivity(site, data.name, 'support.requested', { subject: data.plan === 'team' ? 'New customer: team' : 'New customer', kind: 'New customer' }, { includeMain: true }).catch(() => {});
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof SupportLimitError) return jsonError(err.message, 429);
    return handleDbError(err);
  }
}
