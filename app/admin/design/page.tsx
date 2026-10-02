import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/server';
import { canUseTab, isReadOnly } from '@/lib/auth/permissions';
import { getDraft, getPublished } from '@/lib/design/store';
import { DEFAULT_TEMPLATE_ID, templateById } from '@/lib/design/templates';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';
import { DesignEditor } from '@/components/design/editor';
import { migrateDesign } from '@/components/design/style-panel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Design editor', robots: { index: false, follow: false } };

/** Full-screen visual editor (Puck) for the homepage design. Needs the Design tab; read-only users can only look. */
export default async function DesignEditorPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin/design');
  if (!canUseTab(user, 'design')) redirect('/admin');
  const [draft, published, portfolio] = await Promise.all([getDraft(), getPublished(), getPortfolioFromDatabase()]);
  return (
    <DesignEditor
      // Older designs kept block styles in one "appearance" object: moved into the Design groups here.
      initialData={migrateDesign(draft?.data ?? templateById(DEFAULT_TEMPLATE_ID)!.data)}
      savedAt={draft?.savedAt ?? null}
      isLive={Boolean(published)}
      portfolio={resolvePortfolio(portfolio)}
      readOnly={isReadOnly(user)}
    />
  );
}
