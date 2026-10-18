import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlatformBadge } from '@/components/platform-badge';
import { LinkCardView } from '@/components/linkcard/card';
import { CardView, ShareCard } from '@/components/linkcard/public-parts';
import { cardProfile, getCard } from '@/lib/linkcard/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [card, profile] = await Promise.all([getCard().catch(() => null), cardProfile().catch(() => null)]);
  if (!card?.enabled || !profile) return { title: 'Not found', robots: { index: false } };
  const title = `${profile.name}${card.headline ? ` · ${card.headline}` : ''}`;
  const description = card.bio || card.headline || `${profile.name}'s links`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/details' },
    openGraph: { type: 'profile', url: '/details', title, description, siteName: profile.name },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** The link card: one page with a photo, a short bio and every link, to share on social media (Admin → Link card). */
export default async function DetailsPage() {
  const [card, profile] = await Promise.all([getCard().catch(() => null), cardProfile().catch(() => null)]);
  if (!card?.enabled || !profile) notFound();
  return (
    <main className="lc-page">
      <CardView />
      <LinkCardView card={card} profile={profile}
        href={(id, url) => (/^https?:/i.test(url) ? `/details/go/${id}` : url)}
        top={<ShareCard title={profile.name} />}
        footer={<PlatformBadge source="link-card" />} />
    </main>
  );
}
