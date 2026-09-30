import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError } from '@/lib/api-utils';
import { EVENT_TYPES, daysAgo } from '@/lib/events';

export const dynamic = 'force-dynamic';

/** Counts for Admin → Insights (last 7 days, last 30 days, all time) plus recent assistant questions. */
export async function GET() {
  try {
    const since7 = daysAgo(7);
    const since30 = daysAgo(30);
    const counts = await Promise.all(
      EVENT_TYPES.map(async (type) => {
        const [last7, last30, total] = await Promise.all([
          prisma.event.count({ where: { type, createdAt: { gte: since7 } } }),
          prisma.event.count({ where: { type, createdAt: { gte: since30 } } }),
          prisma.event.count({ where: { type } }),
        ]);
        return [type, { last7, last30, total }] as const;
      }),
    );
    const questions = await prisma.event.findMany({
      where: { type: 'ask' },
      orderBy: { id: 'desc' },
      take: 25,
      select: { detail: true, createdAt: true },
    });
    return NextResponse.json({ counts: Object.fromEntries(counts), questions });
  } catch (error) {
    return handleDbError(error);
  }
}
