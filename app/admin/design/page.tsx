import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/server';
import { isAdmin } from '@/lib/auth/roles';
import { getDraft, getPublished } from '@/lib/design/store';
import { DEFAULT_TEMPLATE_ID, templateById } from '@/lib/design/templates';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';
import { DesignEditor } from '@/components/design/editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Design editor', robots: { index: false, follow: false } };

/** Full-screen visual editor (Puck) for the homepage design. Admins only. */
export default async function DesignEditorPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin/design');
  if (!isAdmin(user)) redirect('/admin');
  const [draft, published, portfolio] = await Promise.all([getDraft(), getPublished(), getPortfolioFromDatabase()]);
  return (
    <DesignEditor
      initialData={draft?.data ?? templateById(DEFAULT_TEMPLATE_ID)!.data}
      savedAt={draft?.savedAt ?? null}
      isLive={Boolean(published)}
      portfolio={resolvePortfolio(portfolio)}
    />
  );
}
