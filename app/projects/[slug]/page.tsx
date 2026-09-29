import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArticleBody } from '@/components/article-body';
import { prisma } from '@/lib/prisma';
import { parseCopy, toProject } from '@/lib/portfolio-repository';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [project, profile] = await Promise.all([
    prisma.project.findUnique({ where: { slug } }),
    prisma.profile.findUnique({ where: { id: 1 } }),
  ]);
  if (!project) return { title: 'Project not found' };
  return {
    title: `${project.title} — ${profile?.name ?? 'Portfolio'}`,
    description: project.description,
    openGraph: project.image ? { images: [project.image] } : undefined,
  };
}

const SECTIONS = [
  { key: 'objective', label: 'OBJECTIVE', color: 'text-lime-300' },
  { key: 'approach', label: 'ENGINEERING FOCUS', color: 'text-cyan-300' },
  { key: 'architecture', label: 'ARCHITECTURE', color: 'text-purple-300', mono: true },
  { key: 'result', label: 'RESULT', color: 'text-yellow-300' },
] as const;

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [row, copyRow] = await Promise.all([
    prisma.project.findUnique({ where: { slug } }),
    prisma.siteCopy.findUnique({ where: { id: 1 } }),
  ]);
  if (!row) notFound();
  const project = toProject(row);
  // "link" projects have no page of their own: send visitors straight to the link.
  if (project.type === 'link' && project.externalUrl) redirect(project.externalUrl);

  const labels = copyRow ? parseCopy(copyRow.content).projects : null;
  const isArticle = project.type === 'article';
  const sections = SECTIONS.filter(({ key }) => project[key]);
  const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

  return <main className="game-grid min-h-screen px-4 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-10 md:py-8">
    <div className="mx-auto max-w-5xl">
      <Link href="/#projects" className="inline-flex min-h-11 items-center text-sm font-bold text-lime-300 hover:text-white">← BACK TO PROJECTS</Link>
      <article className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl">
        {project.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.image} alt={`${project.title} cover`} className="aspect-[21/9] w-full border-b border-white/10 object-cover" />
        )}
        <div className="p-5 sm:p-6 md:p-10">
          <p className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{isArticle ? 'Field Report / Article' : 'Mission / Project Case Study'}</p>
          <h1 className="mt-3 break-words text-3xl font-black uppercase tracking-tight sm:text-4xl md:text-6xl">{project.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{project.description}</p>
          <div className="mt-8 flex flex-wrap gap-2">{project.stack.map((tag) => <span key={tag} className="rounded-full border border-lime-300/20 bg-lime-300/5 px-3 py-1 text-xs text-lime-200">{tag}</span>)}</div>
          {(project.liveUrl || project.repoUrl || project.externalUrl) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {project.liveUrl && <a href={project.liveUrl} {...external} className="inline-flex min-h-11 items-center rounded-xl bg-lime-300 px-4 py-2 text-xs font-black text-black lg:min-h-0">{labels?.live ?? 'LIVE ↗'}</a>}
              {project.repoUrl && <a href={project.repoUrl} {...external} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-2 text-xs font-black hover:border-cyan-300 lg:min-h-0">{labels?.github ?? 'GITHUB ↗'}</a>}
              {project.externalUrl && <a href={project.externalUrl} {...external} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-2 text-xs font-black hover:border-cyan-300 lg:min-h-0">{labels?.openLink ?? 'OPEN LINK ↗'}</a>}
            </div>
          )}

          {isArticle && project.content && (
            <div className="mt-10 max-w-3xl border-t border-white/10 pt-8"><ArticleBody content={project.content} /></div>
          )}

          {!isArticle && sections.length > 0 && (
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {sections.map(({ key, label, color, ...rest }) => (
                <section key={key} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <h2 className={`font-bold ${color}`}>{label}</h2>
                  {'mono' in rest
                    ? <pre className="mt-4 overflow-x-auto whitespace-pre rounded-xl bg-black/40 p-4 font-mono text-xs leading-6 text-slate-300">{project[key]}</pre>
                    : <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-300">{project[key]}</p>}
                </section>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  </main>;
}
