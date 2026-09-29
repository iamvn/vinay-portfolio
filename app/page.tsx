import type { Metadata } from 'next';
import { PortfolioHome } from '@/components/portfolio-home';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';
import { homeDescription, homeTitle, jsonLd, personJsonLd } from '@/lib/seo';

// Read the database on every request so API edits show up immediately.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { profile, skills } = await getPortfolioFromDatabase();
  const title = homeTitle(profile, skills);
  const description = homeDescription(profile, skills);
  return {
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: { type: 'profile', url: '/', title, description, siteName: profile.name },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function HomePage() {
  const data = resolvePortfolio(await getPortfolioFromDatabase());
  return (
    <>
      {/* Structured data for search engines. It renders nothing on the page. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(personJsonLd(data)) }} />
      <PortfolioHome data={data} />
    </>
  );
}
