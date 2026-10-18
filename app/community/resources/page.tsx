import type { Metadata } from 'next';
import Link from 'next/link';
import { PlatformBadge } from '@/components/platform-badge';
import { BoardHeader, postedOn } from '@/components/community/parts';
import { RemoveResource, ShareLine, ShareResource, SignInToShare } from '@/components/community/resource-parts';
import { currentUser } from '@/lib/auth/server';
import { ownerId } from '@/lib/auth/roles';
import { postingSite } from '@/lib/community/author';
import { KIND_STYLE, KINDS, TOPICS, type Kind, type Resource, type Topic } from '@/lib/community/resource-types';
import { listResources } from '@/lib/community/resources';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Free resources | Community',
  description: 'Free learning resources shared by the community: YouTube videos, articles, GitHub repos and courses, by topic. Open to everyone.',
  alternates: { canonical: `${SITE_URL}/community/resources` },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? '';
const firstName = (name: string) => name.trim().split(/\s+/)[0];

function KindIcon({ kind }: { kind: Kind }) {
  const paths: Record<Kind, React.ReactNode> = {
    YouTube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.5 5 2.5-5 2.5Z" fill="currentColor" /></>,
    GitHub: <><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="8" r="2.2" /><path d="M6 8.2v7.6M18 10.2c0 4-6 3-10.5 6.3" /></>,
    Medium: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
    Course: <><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5Z" /><path d="M6.5 11v4.5c3 2.5 8 2.5 11 0V11M21.5 9v5" /></>,
    Article: <><path d="M6 3.5h8l4 4V20.5H6Z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></>,
  };
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5" style={{ color: KIND_STYLE[kind].color }} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
    </span>
  );
}

function ResourceCard({ r, canRemove, byLink }: { r: Resource; canRemove: boolean; byLink: string }) {
  return (
    <li className="flex">
      <article className="flex w-full flex-col rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-lime-300/40">
        <div className="flex items-start gap-3">
          <KindIcon kind={r.kind} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black leading-snug text-white">
              <a href={r.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-words hover:text-lime-200">
                {r.title}<span className="sr-only"> (opens {r.host})</span><span aria-hidden="true" className="ml-1 text-slate-500">↗</span>
              </a>
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{r.host}</p>
          </div>
        </div>
        {r.note && <p className="mt-3 text-sm leading-6 text-slate-300">{r.note}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href={`/community/resources?topic=${encodeURIComponent(r.topic)}`} className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-100 hover:bg-cyan-300/20">{r.topic}</Link>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold" style={{ color: KIND_STYLE[r.kind].color }}>{KIND_STYLE[r.kind].label}</span>
        </div>
        <div className="min-h-3 flex-1" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
          <p className="min-w-0 text-xs text-slate-400">
            Shared by <Link href={byLink} className="font-bold text-slate-100 hover:text-lime-200 hover:underline">{r.name}</Link>
            {r.verified && (
              <> {r.verified.url
                ? <a href={r.verified.url} target="_blank" rel="noopener noreferrer" title={`Member: ${r.verified.site}`} className="font-bold text-lime-300 hover:underline">✓ member</a>
                : <span className="font-bold text-lime-300">✓ member</span>}</>
            )}
            {' · '}<time dateTime={r.createdAt}>{postedOn(r.createdAt)}</time>
          </p>
          {canRemove && <RemoveResource id={r.id} title={r.title} />}
        </div>
      </article>
    </li>
  );
}

/** Community → Free resources: links shared by signed-in members, by topic. Free for everyone to read. */
export default async function ResourcesPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = {
    q: one(params.q),
    topic: (TOPICS as readonly string[]).includes(one(params.topic)) ? (one(params.topic) as Topic) : undefined,
    kind: (KINDS as readonly string[]).includes(one(params.kind)) ? one(params.kind) : '',
    by: one(params.by).slice(0, 60),
    page: Math.max(0, (Number(one(params.page)) || 1) - 1),
  };
  const [library, user] = await Promise.all([listResources(query).catch(() => null), currentUser()]);
  const poster = user ? await postingSite().catch(() => null) : null;
  const canRemove = Boolean(user && poster?.site.isMain && user.id === (await ownerId().catch(() => null)));

  const link = (changes: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: query.q, topic: query.topic ?? '', kind: query.kind, by: query.by, ...changes })) if (value) next.set(key, value);
    const text = next.toString();
    return text ? `/community/resources?${text}` : '/community/resources';
  };
  const filtered = Boolean(query.q || query.topic || query.kind || query.by);
  const pill = (on: boolean) => `inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold ${on ? 'border-lime-300 bg-lime-300 text-black' : 'border-white/15 text-slate-300 hover:border-lime-300/60 hover:text-white'}`;
  const share = user && poster
    ? <ShareResource name={user.name?.trim() || poster.name || poster.site.name} defaultTopic={query.topic} member={poster.name || poster.site.name} />
    : <SignInToShare next="/community/resources" />;

  return (
    <main className="community-shell mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <BoardHeader active="resources"><Link href="/" className="text-xs font-bold text-slate-400 hover:text-white">← Home</Link></BoardHeader>

      <section className="py-8">
        <p className="text-[11px] font-black uppercase tracking-[.3em] text-cyan-300">Always free · open for everyone to read</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">
          {query.by ? <>{firstName(query.by)}’s favourite resources.</> : <>The resources that actually helped.</>}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          {query.by
            ? <>Links {query.by} found worth sharing. {library ? `${library.total} so far.` : ''}</>
            : <>YouTube videos, articles, GitHub repos and courses, shared by people who learned from them, sorted by topic.
              {library && library.all > 0 ? ` ${library.all.toLocaleString()} free resource${library.all === 1 ? '' : 's'} and counting.` : ''} Members of any site here can add theirs.</>}
        </p>
        <div className="mt-5">{share}</div>
      </section>

      <form action="/community/resources" method="get" className="flex gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-2">
        <input type="search" name="q" defaultValue={query.q} placeholder="Search: recursion, React, system design…" aria-label="Search resources"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-base text-white placeholder:text-slate-500 focus:border-lime-300/70 focus:outline-none sm:text-sm" />
        {query.topic && <input type="hidden" name="topic" value={query.topic} />}
        {query.kind && <input type="hidden" name="kind" value={query.kind} />}
        {query.by && <input type="hidden" name="by" value={query.by} />}
        <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-lime-300 px-4 text-sm font-black uppercase tracking-wide text-black hover:bg-lime-200">Search</button>
      </form>

      {library && library.all > 0 && (
        <nav aria-label="Browse by topic and type" className="mt-4 space-y-2">
          {/* One scrolling row on phones, wrapping on bigger screens. */}
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            <Link href={link({ topic: '', page: '' })} className={pill(!query.topic)}>All topics</Link>
            {library.topics.map((t) => (
              <Link key={t.name} href={link({ topic: query.topic === t.name ? '' : t.name, page: '' })} aria-current={query.topic === t.name ? 'page' : undefined} className={pill(query.topic === t.name)}>
                {t.name} <span className="opacity-60">{t.count}</span>
              </Link>
            ))}
          </div>
          {library.kinds.length > 1 && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {library.kinds.map((k) => (
                <Link key={k.name} href={link({ kind: query.kind === k.name ? '' : k.name, page: '' })} aria-current={query.kind === k.name ? 'page' : undefined}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${query.kind === k.name ? 'bg-white text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                  <i className="size-2 rounded-full" style={{ background: KIND_STYLE[k.name].color }} aria-hidden="true" />{k.name} <span className="opacity-60">{k.count}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>
      )}

      {filtered && (
        <p className="mt-4 text-sm text-slate-400">
          {library ? `${library.total} matching. ` : ''}<Link href="/community/resources" className="font-bold text-lime-300 hover:underline">Clear filters</Link>
        </p>
      )}

      {!library ? (
        <p className="mt-8 rounded-2xl border border-white/10 p-6 text-sm text-slate-400">The library can’t be loaded right now. Please try again in a moment.</p>
      ) : library.resources.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <p className="text-sm text-slate-300">{filtered ? 'Nothing here yet for this search.' : 'The library is empty. Be the first to share a link that helped you.'}</p>
          <div className="mt-4">{share}</div>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {library.resources.map((r) => <ResourceCard key={r.id} r={r} canRemove={canRemove} byLink={link({ by: r.name, page: '' })} />)}
        </ul>
      )}

      {library && library.pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
          {library.page > 0 ? <Link className="font-bold text-lime-300 hover:underline" href={link({ page: String(library.page) })}>← Newer</Link> : <span />}
          <span className="text-slate-400">Page {library.page + 1} of {library.pages}</span>
          {library.page + 1 < library.pages ? <Link className="font-bold text-lime-300 hover:underline" href={link({ page: String(library.page + 2) })}>Older →</Link> : <span />}
        </nav>
      )}

      {library && library.people.length > 1 && !query.by && (
        <section className="mt-10">
          <h2 className="text-xs font-black uppercase tracking-[.3em] text-slate-400">Favourites of</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {library.people.map((p) => (
              <Link key={p.name} href={link({ by: p.name, page: '' })} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3 text-sm font-bold text-slate-200 hover:border-lime-300/60">
                <span className="grid size-6 place-items-center rounded-full bg-lime-300 text-[11px] font-black text-black">{p.name.trim()[0]?.toUpperCase()}</span>
                {p.name} <span className="text-xs text-slate-500">{p.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 overflow-hidden rounded-3xl border border-lime-300/20 bg-gradient-to-br from-lime-300/10 via-slate-950 to-cyan-300/10 p-6 text-center sm:p-10">
        <div className="mx-auto max-w-2xl min-h-[5.5rem] sm:min-h-24"><ShareLine /></div>
        <p className="mt-3 text-sm text-slate-400">Everyone can improve, and everyone can help someone else move forward.</p>
        <div className="mt-5">{share}</div>
      </section>

      <p className="mt-8 text-xs leading-6 text-slate-500">
        Links are shared by the community and go to other websites. Every link is shared by a signed-in member of a site on this platform, under their own name.
      </p>
      <PlatformBadge source="community" />
    </main>
  );
}
