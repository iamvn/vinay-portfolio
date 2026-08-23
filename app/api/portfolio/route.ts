import { NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/portfolio';

export async function GET() {
  const data = await getPortfolio();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400' }
  });
}
