import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPortfolioFromApi } from '@/lib/portfolio-api';

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portfolio = await getPortfolioFromApi();
  const project = portfolio.projects.find((item) => item.slug === slug);
  if (!project) notFound();

  return <main className="game-grid min-h-screen px-4 py-8 md:px-10">
    <div className="mx-auto max-w-5xl">
      <Link href="/#projects" className="text-sm font-bold text-lime-300 hover:text-white">← BACK TO PROJECTS</Link>
      <section className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl md:p-10">
        <p className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">Mission / Project Case Study</p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-tight md:text-6xl">{project.title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{project.description}</p>
        <div className="mt-8 flex flex-wrap gap-2">{project.stack.map((tag) => <span key={tag} className="rounded-full border border-lime-300/20 bg-lime-300/5 px-3 py-1 text-xs text-lime-200">{tag}</span>)}</div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="font-bold text-lime-300">OBJECTIVE</h2><p className="mt-3 text-sm leading-7 text-slate-300">Build a production-ready product experience with a clear user journey, maintainable architecture and measurable performance.</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="font-bold text-cyan-300">ENGINEERING FOCUS</h2><p className="mt-3 text-sm leading-7 text-slate-300">Rendering strategy, state management, API boundaries, caching, accessibility and resilient UI behavior.</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="font-bold text-purple-300">ARCHITECTURE</h2><pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-xs leading-6 text-slate-300">{`User\n  ↓\nNext.js UI\n  ↓\nBFF / API\n  ↓\nServices\n  ↓\nData + AI`}</pre></article>
          <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="font-bold text-yellow-300">RESULT</h2><p className="mt-3 text-sm leading-7 text-slate-300">The production version should report verified metrics here—performance, adoption, reliability and other measurable outcomes—rather than marketing claims.</p></article>
        </div>
      </section>
    </div>
  </main>;
}
