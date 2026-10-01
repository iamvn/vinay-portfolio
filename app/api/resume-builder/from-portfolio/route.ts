import { NextResponse } from 'next/server';
import { handleDbError } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { contentFromPortfolio } from '@/lib/resume-builder/server';

export const dynamic = 'force-dynamic';

/** Resume content built from the current portfolio (for "Reload from portfolio" in the editor). */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'builder');
  if (error) return error;
  try {
    return NextResponse.json(await contentFromPortfolio());
  } catch (err) {
    return handleDbError(err);
  }
}
