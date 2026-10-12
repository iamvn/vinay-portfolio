import type { Metadata } from 'next';
import { PlatformBadge } from '@/components/platform-badge';
import Link from 'next/link';
import { BoardHeader, PostCard } from '@/components/community/parts';
import { listPublic } from '@/lib/community/store';
import { CATEGORIES, LEVELS, OUTCOMES } from '@/lib/community/types';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Interview experiences | Community',
  description: 'Real interview experiences: the rounds, the questions asked and how people prepared, shared by job seekers on this platform.',
  alternates: { canonical: `${SITE_URL}/community` },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? '';

/** The community board: everyone's shared interview experiences, newest first. Read-only; posting happens in each site's admin. */
export default async function CommunityPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = {
    q: one(params.q), tag: one(params.tag),
    category: (CATEGORIES as readonly string[]).includes(one(params.category)) ? one(params.category) : '',
    outcome: (OUTCOMES as readonly string[]).includes(one(params.outcome)) ? one(params.outcome) : '',
    level: (LEVELS as readonly string[]).includes(one(params.level)) ? one(params.level) : '',
    page: Math.max(0, (Number(one(params.page)) || 1) - 1),
  };
  const board = await listPublic(query).catch(() => null);
  const link = (changes: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: query.q, tag: query.tag, category: query.category, outcome: query.outcome, level: query.level, ...changes })) if (value) next.set(key, value);
    const text = next.toString();
    return text ? `/community?${text}` : '/community';
  };
  const filtered = Boolean(query.q || query.tag || query.category || query.outcome || query.level);
  const select = 'min-h-11 rounded-lg border border-white/15 bg-slate-950 px-3 text-sm text-slate-100 focus:border-lime-300/70 focus:outline-none';

  return (
    <main className="community-shell mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <BoardHeader><Link href="/" className="text-xs font-bold text-slate-400 hover:text-white">← Home</Link></BoardHeader>

      <section className="py-8">
        <h1 className="max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">Real interviews. Real questions. How people prepared.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Interview experiences shared by job seekers on this platform: the rounds, the questions they were asked, and the material they used to prepare.
          {board ? ` ${board.total.toLocaleString()} ${filtered ? 'matching ' : ''}experience${board.total === 1 ? '' : 's'}.` : ''}
        </p>
      </section>

      <form action="/community" method="get" className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center">
        <input type="search" name="q" defaultValue={query.q} placeholder="Search company, role, question, topic…" aria-label="Search experiences"
          className="min-h-11 min-w-0 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-slate-500 focus:border-lime-300/70 focus:outline-none" />
        <select name="category" defaultValue={query.category} aria-label="Field" className={select}>
          <option value="">Every field</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="level" defaultValue={query.level} aria-label="Level" className={select}>
          <option value="">Any level</option>{LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="outcome" defaultValue={query.outcome} aria-label="Outcome" className={select}>
          <option value="">Any outcome</option>{OUTCOMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {query.tag && <input type="hidden" name="tag" value={query.tag} />}
        <button type="submit" className="min-h-11 rounded-lg bg-lime-300 px-5 text-sm font-black uppercase tracking-wide text-black hover:bg-lime-200">Search</button>
      </form>

      {board && (board.categories.length > 0 || board.tags.length > 0) && (
        <nav aria-label="Browse by field and topic" className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {board.categories.map((c) => (
              <Link key={c.name} href={link({ category: query.category === c.name ? '' : c.name, page: '' })} aria-current={query.category === c.name ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${query.category === c.name ? 'border-lime-300 bg-lime-300 text-black' : 'border-white/15 text-slate-300 hover:border-lime-300/60 hover:text-white'}`}>
                {c.name} <span className="opacity-60">{c.count}</span>
              </Link>
            ))}
          </div>
          {board.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {board.tags.map((t) => (
                <Link key={t.name} href={link({ tag: query.tag.toLowerCase() === t.name.toLowerCase() ? '' : t.name, page: '' })}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${query.tag.toLowerCase() === t.name.toLowerCase() ? 'bg-cyan-300 text-black' : 'bg-white/5 text-slate-300 hover:bg-cyan-300/15 hover:text-cyan-100'}`}>
                  #{t.name} <span className="opacity-60">{t.count}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>
      )}

      {filtered && (
        <p className="mt-4 text-sm text-slate-400">
          {query.tag && <>Topic <b className="text-slate-200">#{query.tag}</b>. </>}
          <Link href="/community" className="font-bold text-lime-300 hover:underline">Clear filters</Link>
        </p>
      )}

      {!board ? (
        <p className="mt-8 rounded-2xl border border-white/10 p-6 text-sm text-slate-400">The board can’t be loaded right now. Please try again in a moment.</p>
      ) : board.posts.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
          {filtered ? 'No experiences match this search yet.' : 'No experiences shared yet. Members can share theirs from their admin → Community.'}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">{board.posts.map((post) => <PostCard key={post.id} post={post} />)}</ul>
      )}

      {board && board.pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
          {board.page > 0 ? <Link className="font-bold text-lime-300 hover:underline" href={link({ page: String(board.page) })}>← Newer</Link> : <span />}
          <span className="text-slate-400">Page {board.page + 1} of {board.pages}</span>
          {board.page + 1 < board.pages ? <Link className="font-bold text-lime-300 hover:underline" href={link({ page: String(board.page + 2) })}>Older →</Link> : <span />}
        </nav>
      )}

      <p className="mt-12 border-t border-white/10 pt-6 text-xs leading-6 text-slate-500">
        Shared by members of this platform and read-only here. Members post from their own admin → Community. Experiences are personal accounts; companies change their process over time.
      </p>
      <PlatformBadge source="community" />
    </main>
  );
}
