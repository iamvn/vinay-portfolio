import { NextResponse } from 'next/server';
import { handleDbError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { listApplications, toSummary } from '@/lib/career/applications';
import { followUpDue, toFollowUp } from '@/lib/career/followups';

export const dynamic = 'force-dynamic';

/** Applications that need a follow-up now (Applications tab and the header bell). */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'applications');
  if (error) return error;
  try {
    const now = new Date();
    const due = (await listApplications()).map(toSummary).filter((a) => followUpDue(a, now)).map((a) => toFollowUp(a, now));
    return NextResponse.json(due.sort((a, b) => b.days - a.days), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return handleDbError(err);
  }
}
