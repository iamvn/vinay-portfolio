import { NextResponse } from 'next/server';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { cardProfile, cardStats, getCard, saveCard } from '@/lib/linkcard/store';
import { linkCardSchema } from '@/lib/linkcard/types';
import { currentSiteUrl } from '@/lib/sites/url';

export const dynamic = 'force-dynamic';

/** Admin → Link card: the card, what it shows from the profile, its address and the last 30 days of views and clicks. */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'links');
  if (error) return error;
  try {
    const [card, profile, stats, site] = await Promise.all([getCard(), cardProfile(), cardStats(), currentSiteUrl().catch(() => '')]);
    return NextResponse.json({ card, profile, stats, url: `${site}/details` });
  } catch (err) {
    return handleDbError(err);
  }
}

export async function PUT(request: Request) {
  const { error } = await requireTab(request, 'links');
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, linkCardSchema);
  if (invalid) return invalid;
  try {
    return NextResponse.json(await saveCard(data));
  } catch (err) {
    return handleDbError(err);
  }
}
