import type React from 'react';
import Link from 'next/link';
import type { PortfolioData } from '@/lib/portfolio';

type Project = PortfolioData['projects'][number];
type Labels = PortfolioData['copy']['projects'];

function FaceButton({ label }: { label: string }) {
  return <span aria-hidden="true" className="xbox-face-button xbox-face-button--a xbox-face-button--compact">{label}</span>;
}

/** Where the card's main button goes: the project page, or straight to the external link. */
export function projectHref(project: Project) {
  return project.type === 'link' ? project.externalUrl : `/projects/${project.slug}`;
}

export function ProjectCard({ project, labels }: { project: Project; labels: Labels }) {
  const initials = project.title.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const primaryLabel = project.type === 'article' ? labels.readArticle : project.type === 'link' ? labels.openLink : labels.enter;
  const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

  const cover = (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 to-black text-4xl font-black text-lime-300/20">
      {project.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={project.image} alt={`${project.title} preview`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        : initials}
      {project.featured && (
        <span className="absolute left-2 top-2 rounded-full border border-yellow-300/40 bg-black/70 px-2 py-0.5 text-[9px] font-black tracking-wider text-yellow-200">{labels.featured}</span>
      )}
    </div>
  );

  return (
    <article className="project-card group flex flex-col rounded-2xl border border-white/10 bg-[#071018] p-4 transition hover:-translate-y-1 hover:border-lime-300/40">
      {project.type === 'link'
        ? <a href={project.externalUrl} {...external} aria-label={project.title}>{cover}</a>
        : <Link href={projectHref(project)} aria-label={project.title}>{cover}</Link>}
      <h3 className="mt-4 font-black">{project.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{project.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {project.stack.map((tag) => <span key={tag} className="project-tag rounded-full bg-lime-300/5 px-2 py-1 text-[10px] text-lime-200">{tag}</span>)}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 lg:pt-5">
        {project.type === 'link'
          ? <a href={project.externalUrl} {...external} className="inline-flex min-h-11 items-center gap-2 text-xs font-black text-lime-300 lg:min-h-0">{primaryLabel} <FaceButton label="A" /></a>
          : <Link href={projectHref(project)} className="inline-flex min-h-11 items-center gap-2 text-xs font-black text-lime-300 lg:min-h-0">{primaryLabel} <FaceButton label="A" /></Link>}
        {project.liveUrl && <a href={project.liveUrl} {...external} className="inline-flex min-h-11 items-center text-xs font-black text-cyan-300 hover:text-white lg:min-h-0">{labels.live}</a>}
        {project.repoUrl && <a href={project.repoUrl} {...external} className="inline-flex min-h-11 items-center text-xs font-black text-slate-400 hover:text-white lg:min-h-0">{labels.github}</a>}
      </div>
    </article>
  );
}
