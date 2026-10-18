import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PublicPost } from '@/lib/community/types';

/** Pieces of the public community board (server components). */

export const OUTCOME_TONE: Record<string, string> = {
  Offer: 'border-lime-300/40 bg-lime-300/10 text-lime-200',
  Rejected: 'border-red-400/40 bg-red-400/10 text-red-200',
  'In progress': 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200',
  Withdrew: 'border-slate-400/40 bg-slate-400/10 text-slate-200',
  'No response': 'border-slate-400/40 bg-slate-400/10 text-slate-300',
};

export const postedOn = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const monthLabel = (ym: string) => (ym ? new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

export function Chip({ children, tone = 'border-white/15 bg-white/5 text-slate-300' }: { children: ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>{children}</span>;
}

export function Facts({ post }: { post: PublicPost }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone="border-cyan-300/40 bg-cyan-300/10 text-cyan-100">{post.category}</Chip>
      {post.level && <Chip>{post.level}</Chip>}
      {post.outcome && <Chip tone={OUTCOME_TONE[post.outcome]}>{post.outcome}</Chip>}
      {post.difficulty && <Chip>Difficulty: {post.difficulty}</Chip>}
      {post.interviewedOn && <Chip>Interviewed {monthLabel(post.interviewedOn)}</Chip>}
    </div>
  );
}

/** "Posted by … · 3 Oct 2026 (updated 5 Oct)". The author links to their portfolio unless anonymous. */
export function Byline({ post }: { post: PublicPost }) {
  const updated = post.updatedAt.slice(0, 10) !== post.createdAt.slice(0, 10);
  return (
    <p className="text-xs text-slate-400">
      Posted by{' '}
      {post.authorUrl ? (
        <a href={post.authorUrl} target="_blank" rel="noopener noreferrer ugc" className="font-bold text-slate-100 hover:text-lime-200 hover:underline">{post.authorName}</a>
      ) : <b className="text-slate-100">{post.authorName}</b>}
      {post.authorHeadline && !post.anonymous && <span>, {post.authorHeadline}</span>}
      {' · '}<time dateTime={post.createdAt}>{postedOn(post.createdAt)}</time>
      {updated && <> · updated <time dateTime={post.updatedAt}>{postedOn(post.updatedAt)}</time></>}
    </p>
  );
}

export function TagLinks({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Link key={tag} href={`/community?tag=${encodeURIComponent(tag)}`} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-bold text-slate-300 hover:bg-lime-300/15 hover:text-lime-200">#{tag}</Link>
      ))}
    </div>
  );
}

export function PostCard({ post }: { post: PublicPost }) {
  return (
    <li>
      <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-lime-300/40 sm:p-5">
        <h2 className="text-lg font-black leading-snug text-white">
          <Link href={`/community/${post.id}`} className="hover:text-lime-200">{post.title}</Link>
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          <b className="text-slate-100">{post.company}</b> · {post.role}{post.location ? <span className="text-slate-400"> · {post.location}</span> : null}
        </p>
        <div className="mt-3"><Facts post={post} /></div>
        {post.summary && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{post.summary}</p>}
        <div className="mt-3"><TagLinks tags={post.tags} /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
          <Byline post={post} />
          <span className="text-xs text-slate-400">
            {post.rounds.length > 0 && `${post.rounds.length} round${post.rounds.length === 1 ? '' : 's'} · `}
            {post.questions.length} question{post.questions.length === 1 ? '' : 's'}
            {post.resources.length > 0 && ` · ${post.resources.length} resource${post.resources.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </article>
    </li>
  );
}

export function BoardHeader({ children, active = 'interviews' }: { children?: ReactNode; active?: 'interviews' | 'resources' }) {
  return (
    <header className="border-b border-white/10 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/community" className="text-[11px] font-black uppercase tracking-[.3em] text-lime-300">Community</Link>
        {children}
      </div>
      <BoardTabs active={active} />
    </header>
  );
}

/** Interview experiences | Free resources. */
export function BoardTabs({ active }: { active: 'interviews' | 'resources' }) {
  const tabs = [
    { id: 'interviews', href: '/community', label: 'Interview experiences' },
    { id: 'resources', href: '/community/resources', label: 'Free resources' },
  ] as const;
  return (
    <nav aria-label="Community sections" className="mt-3 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-slate-950/70 p-1 sm:inline-grid sm:w-auto">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={active === t.id ? 'page' : undefined}
          className={`grid min-h-11 place-items-center rounded-xl px-4 text-center text-sm font-black ${active === t.id ? 'bg-lime-300 text-black' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
