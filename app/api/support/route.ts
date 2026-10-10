import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { userFromRequest } from '@/lib/auth/session';
import { freshSite } from '@/lib/sites/require-feature';
import { logActivity } from '@/lib/sites/activity';
import { missingFor } from '@/lib/support/access';
import { SupportLimitError, createRequest, listMine } from '@/lib/support/store';
import { KIND_LABELS, requestSchema, targetLabel } from '@/lib/support/types';

export const dynamic = 'force-dynamic';


/** For anyone signed in: what they've asked the platform owner, and what they could ask for. */
export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return jsonError('Not logged in.', 401);
  try {
    const here = await freshSite();
    const isOwner = here.isMain && user.role === 'admin';
    return NextResponse.json({ requests: isOwner ? [] : await listMine(here.slug, user.email), missing: missingFor(user, here, isOwner) });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Sends feedback, a question, or an access request to the platform owner. Read-only users may too. */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return jsonError('Not logged in.', 401);
  const { data, error } = await parseBody(request, requestSchema);
  if (error) return error;
  try {
    const here = await freshSite();
    if (here.isMain && user.role === 'admin') return jsonError('You are the platform owner: requests come to you.', 400);
    const created = await createRequest(here, { name: user.name, email: user.email }, data);
    await logActivity(here, user.name ? `${user.name} <${user.email}>` : user.email, 'support.requested',
      { subject: created.subject, kind: KIND_LABELS[created.kind] + (created.target ? `: ${targetLabel(created.target)}` : '') }, { includeMain: true });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof SupportLimitError) return jsonError(err.message, 429);
    return handleDbError(err);
  }
}
