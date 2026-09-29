import type { Metadata } from 'next';
import { PortfolioHome } from '@/components/portfolio-home';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';

// Read the database on every request so API edits show up immediately.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getPortfolioFromDatabase();
  return { title: `${profile.name} — ${profile.role}`, description: profile.summary };
}

export default async function HomePage() {
  const data = resolvePortfolio(await getPortfolioFromDatabase());
  return <PortfolioHome data={data} />;
}
