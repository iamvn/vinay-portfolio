import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/server';
import { canUseTab } from '@/lib/auth/permissions';
import { getDraft } from '@/lib/design/store';
import { DEFAULT_TEMPLATE_ID, templateById } from '@/lib/design/templates';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';
import { assistantEnabled } from '@/lib/assistant';
import { DesignedPage } from '@/components/design/designed-page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Design preview', robots: { index: false, follow: false } };

/** The draft design as visitors would see it, before publishing. Admins only. */
export default async function DesignPreviewPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin/design/preview');
  if (!canUseTab(user, 'design')) redirect('/admin');
  const [draft, portfolio, assistant] = await Promise.all([getDraft(), getPortfolioFromDatabase(), assistantEnabled()]);
  const data = draft?.data ?? templateById(DEFAULT_TEMPLATE_ID)!.data;
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-yellow-300 px-3 py-1.5 text-center text-xs font-bold text-black">
        Draft preview: not live yet. <a href="/admin/design" className="underline">Back to editor</a>
      </div>
      <div className="pt-7"><DesignedPage data={data} portfolio={resolvePortfolio(portfolio)} assistant={assistant} /></div>
    </>
  );
}
