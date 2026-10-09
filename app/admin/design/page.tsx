import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/server';
import { canUseTab, isReadOnly } from '@/lib/auth/permissions';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';
import { scopeFromParams, scopeQuery } from '@/lib/design/scope';
import { editorStart } from '@/lib/design/editor-data';
import { DesignEditor } from '@/components/design/editor';
import { migrateDesign } from '@/components/design/style-panel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Design editor', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Full-screen visual editor (Puck) for the homepage design, or for project pages:
 *   /admin/design?page=project                  the design every project page uses
 *   /admin/design?page=project&project=<slug>   one project's own design
 * Needs the Design tab; read-only users can only look.
 */
export default async function DesignEditorPage({ searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin/design');
  if (!canUseTab(user, 'design')) redirect('/admin');
  const params = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])));
  const { scope } = await scopeFromParams(params);
  if (!scope) redirect('/admin/design');
  const [start, portfolio] = await Promise.all([editorStart(scope, params.get('sample')), getPortfolioFromDatabase()]);
  return (
    <DesignEditor
      // Older designs kept block styles in one "appearance" object: moved into the Design groups here.
      initialData={migrateDesign(start.data)}
      savedAt={start.savedAt}
      isLive={start.isLive}
      portfolio={resolvePortfolio(portfolio)}
      readOnly={isReadOnly(user)}
      page={{ scope, query: scopeQuery(scope), project: start.project, choices: start.choices }}
    />
  );
}
