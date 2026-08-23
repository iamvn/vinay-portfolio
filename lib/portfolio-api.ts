import { headers } from 'next/headers';
import type { PortfolioData } from './portfolio';

/** Fetch portfolio data through the app's public API from a Server Component. */
export async function getPortfolioFromApi(): Promise<PortfolioData> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';

  if (!host) throw new Error('Unable to determine the portfolio API host.');

  const response = await fetch(`${protocol}://${host}/api/portfolio`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) throw new Error(`Portfolio API request failed: ${response.status}`);
  return response.json() as Promise<PortfolioData>;
}
