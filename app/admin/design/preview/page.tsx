import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/server';
import { canUseTab } from '@/lib/auth/permissions';
import { scopeFromParams } from '@/lib/design/scope';
import { editorStart } from '@/lib/design/editor-data';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';
import { assistantEnabled } from '@/lib/assistant';
import { DesignedPage } from '@/components/design/designed-page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Design preview', robots: { index: false, follow: false } };

/** The draft design as visitors would see it, before publishing. Admins only. */
export default async function DesignPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  // ?audit=1: the publish checklist's hidden check (no banner, no assistant, blocks tagged with their ids).
  const audit = query.audit === '1';
  // ?page=project[&project=<slug>][&sample=<slug>]: a project page design, shown with a project.
  const params = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])));
  const { scope } = await scopeFromParams(params);
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin/design/preview');
  if (!canUseTab(user, 'design')) redirect('/admin');
  const [start, portfolio, assistant] = await Promise.all([editorStart(scope ?? 'home', params.get('sample')), getPortfolioFromDatabase(), assistantEnabled()]);
  const { data } = start;
  const project = start.project ?? undefined;
  if (audit) return <DesignedPage data={data} portfolio={resolvePortfolio(portfolio)} assistant={false} audit project={project} />;
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-yellow-300 px-3 py-1.5 text-center text-xs font-bold text-black">
        Draft preview: not live yet. <a href="/admin/design" className="underline">Back to editor</a>
      </div>
      <div className="pt-7"><DesignedPage data={data} portfolio={resolvePortfolio(portfolio)} assistant={assistant} project={project} /></div>
    </>
  );
}
