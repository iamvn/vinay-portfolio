import Link from 'next/link';
import { ArticleBody } from '@/components/article-body';
import type { ProjectView } from '@/lib/design/project-view';
import { safePdfUrl } from './pdf-block';
import { PdfViewer } from './pdf-viewer';

/**
 * The built-in project page (what /projects/<slug> shows until a project page design is published), and the
 * "Classic project page" block that puts it inside a design.
 */
const SECTIONS = [
  { key: 'objective', label: 'Objective', color: 'text-lime-300' },
  { key: 'approach', label: 'Engineering focus', color: 'text-cyan-300' },
  { key: 'architecture', label: 'Architecture', color: 'text-purple-300', mono: true },
  { key: 'result', label: 'Result', color: 'text-yellow-300' },
] as const;

export function ClassicProjectPage({ project }: { project: ProjectView }) {
  const isArticle = project.type === 'article';
  const sections = SECTIONS.filter(({ key }) => project[key]);
  const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
  const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black sm:min-h-11 sm:py-2 sm:text-xs';
  const pdf = safePdfUrl(project.pdf);
  const { previous, next, contact } = project;

  return (
    <>
      {/* Sticky bar: always one tap back to the projects, on every screen size. */}
      <header className="site-header sticky top-0 z-30 border-b border-white/10 bg-[#030609]/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-3 px-4 md:px-10">
          <Link href="/#projects" className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-lime-300 hover:text-white">
            <span aria-hidden="true">←</span> <span>Projects</span>
          </Link>
          <Link href="/" className="truncate text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white">{project.ownerName}</Link>
        </div>
      </header>

      <main className="game-grid min-h-screen px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-4 md:px-10 md:pt-8">
        <div className="mx-auto max-w-5xl">
          <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl sm:rounded-3xl">
            {project.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.image} alt={`${project.title} cover`} className="aspect-video w-full border-b border-white/10 object-cover sm:aspect-[21/9]" />
            )}
            <div className="p-4 sm:p-6 md:p-10">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300 sm:text-xs sm:tracking-[.3em]">
                <span>{project.type === 'link' ? 'Case study' : project.typeLabel}</span>
                {project.type !== 'pdf' && (
                  <>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="text-slate-400">{project.minutes} min read</span>
                  </>
                )}
              </p>
              <h1 className="mt-3 text-balance break-words text-[1.7rem] font-black leading-[1.15] tracking-tight sm:text-4xl md:text-5xl md:uppercase lg:text-6xl">{project.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">{project.description}</p>
              {project.stack.length > 0 && (
                <ul aria-label="Technologies" className="mt-6 flex flex-wrap gap-2 sm:mt-8">
                  {project.stack.map((tag) => <li key={tag} className="rounded-full border border-lime-300/20 bg-lime-300/5 px-3 py-1 text-xs text-lime-200">{tag}</li>)}
                </ul>
              )}
              {(project.liveUrl || project.repoUrl || project.externalUrl) && (
                <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                  {project.liveUrl && <a href={project.liveUrl} {...external} className={`${button} bg-lime-300 text-black`}>{project.labels.live}</a>}
                  {project.repoUrl && <a href={project.repoUrl} {...external} className={`${button} border border-white/20 hover:border-cyan-300`}>{project.labels.github}</a>}
                  {project.externalUrl && <a href={project.externalUrl} {...external} className={`${button} border border-white/20 hover:border-cyan-300`}>{project.labels.openLink}</a>}
                </div>
              )}

              {pdf && (
                <div className="mt-8 sm:mt-10">
                  <PdfViewer url={pdf} title={project.title} mode="spread" thumbnails download={false} />
                </div>
              )}

              {isArticle && project.content && (
                <div className="mt-8 max-w-3xl border-t border-white/10 pt-6 sm:mt-10 sm:pt-8"><ArticleBody content={project.content} /></div>
              )}

              {!isArticle && sections.length > 0 && (
                // grid-cols-1 + min-w-0: a wide diagram scrolls inside its own box instead of stretching the page.
                <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2">
                  {sections.map(({ key, label, color, ...rest }) => (
                    <section key={key} className={`min-w-0 rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:p-5 ${'mono' in rest ? 'md:col-span-2' : ''}`}>
                      <h2 className={`text-xs font-black uppercase tracking-[.2em] ${color}`}>{label}</h2>
                      {'mono' in rest ? (
                        <>
                          <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-5 text-slate-300 sm:mt-4 sm:p-4 sm:text-xs sm:leading-6" tabIndex={0} aria-label={`${label} diagram`}>{project[key]}</pre>
                          <p className="mt-2 text-[11px] text-slate-500 md:hidden">Swipe sideways to see the whole diagram.</p>
                        </>
                      ) : (
                        <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-300 sm:text-sm">{project[key]}</p>
                      )}
                    </section>
                  ))}
                </div>
              )}

              {!isArticle && project.content && (
                <div className="mt-8 max-w-3xl border-t border-white/10 pt-6 sm:mt-10 sm:pt-8">
                  <p className="font-mono text-xs uppercase tracking-[.3em] text-lime-300">Deep dive</p>
                  <div className="mt-4"><ArticleBody content={project.content} /></div>
                </div>
              )}
            </div>
          </article>

          {/* After reading: a way to get in touch, and somewhere to go next. */}
          {(contact.email || contact.linkedin) && (
            <aside className="mt-5 rounded-2xl border border-lime-300/20 bg-lime-300/[.04] p-5 sm:mt-6 sm:p-6">
              <h2 className="text-lg font-black sm:text-xl">Want to talk about this?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">I&apos;m happy to walk through the details, trade-offs and results.</p>
              <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
                {contact.email && <a href={contact.email} className={`${button} bg-lime-300 text-black`}>Email me</a>}
                {contact.linkedin && <a href={contact.linkedin} {...external} className={`${button} border border-white/20 hover:border-cyan-300`}>LinkedIn ↗</a>}
              </div>
            </aside>
          )}

          {(previous || next) && (
            <nav aria-label="More projects" className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
              {previous && (
                <Link href={`/projects/${previous.slug}`} className="group min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-4 hover:border-lime-300/40 sm:p-5">
                  <span className="font-mono text-[11px] uppercase tracking-[.2em] text-slate-500">← Previous</span>
                  <span className="mt-1 block truncate font-bold text-white group-hover:text-lime-200">{previous.title}</span>
                </Link>
              )}
              {next && (
                <Link href={`/projects/${next.slug}`} className="group min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-right hover:border-lime-300/40 sm:col-start-2 sm:p-5">
                  <span className="font-mono text-[11px] uppercase tracking-[.2em] text-slate-500">Next →</span>
                  <span className="mt-1 block truncate font-bold text-white group-hover:text-lime-200">{next.title}</span>
                </Link>
              )}
            </nav>
          )}

          <p className="mt-6 text-center">
            <Link href="/#projects" className="inline-flex min-h-11 items-center text-sm font-bold text-lime-300 hover:text-white">← All projects</Link>
          </p>
        </div>
      </main>
    </>
  );
}
