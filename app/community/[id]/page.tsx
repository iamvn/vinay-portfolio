import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoardHeader, Byline, Facts, TagLinks } from '@/components/community/parts';
import { getPublic } from '@/lib/community/store';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublic((await params).id).catch(() => null);
  if (!post) return { title: 'Not found | Community', robots: { index: false } };
  const description = (post.summary || `${post.role} interview at ${post.company}: ${post.questions.length} questions, ${post.rounds.length} rounds.`).slice(0, 160);
  return {
    title: `${post.title} | Interview experience`,
    description,
    alternates: { canonical: `${SITE_URL}/community/${post.id}` },
    openGraph: { title: post.title, description, type: 'article', publishedTime: post.createdAt, modifiedTime: post.updatedAt },
  };
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-[11px] font-black uppercase tracking-[.25em] text-lime-300">{title}</h2>
    {children}
  </section>
);

/** One shared interview experience. */
export default async function CommunityPostPage({ params }: Props) {
  const post = await getPublic((await params).id).catch(() => null);
  if (!post) notFound();
  const rounds = [...new Set(post.questions.map((q) => q.round).filter(Boolean))];
  return (
    <main className="community-shell mx-auto min-h-screen max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <BoardHeader><Link href="/community" className="text-xs font-bold text-slate-400 hover:text-white">← All experiences</Link></BoardHeader>

      <article className="space-y-8 py-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-black leading-tight text-white sm:text-4xl">{post.title}</h1>
          <p className="text-base text-slate-300"><b className="text-white">{post.company}</b> · {post.role}{post.location ? ` · ${post.location}` : ''}</p>
          <Facts post={post} />
          <Byline post={post} />
        </header>

        {post.summary && <Section title="The experience"><p className="whitespace-pre-wrap text-base leading-7 text-slate-200">{post.summary}</p></Section>}

        {post.rounds.length > 0 && (
          <Section title={`The process · ${post.rounds.length} round${post.rounds.length === 1 ? '' : 's'}`}>
            <ol className="space-y-3">
              {post.rounds.map((round, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/70 p-4">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lime-300 text-xs font-black text-black">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{round.name}</p>
                    {round.details && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{round.details}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {post.questions.length > 0 && (
          <Section title={`Questions asked · ${post.questions.length}`}>
            <ul className="space-y-2">
              {post.questions.map((q, i) => (
                <li key={i}>
                  <details className="group rounded-xl border border-white/10 bg-slate-950/70">
                    <summary className="flex cursor-pointer list-none items-start gap-2 p-4 [&::-webkit-details-marker]:hidden">
                      <span aria-hidden="true" className="mt-0.5 text-xs text-slate-500 transition group-open:rotate-90">▸</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-6 text-white">{q.question}</span>
                        {q.round && rounds.length > 1 && <span className="mt-1 block text-xs text-cyan-200">{q.round}</span>}
                      </span>
                    </summary>
                    <div className="border-t border-white/5 px-4 pb-4 pt-3 sm:pl-9">
                      {q.answer ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{q.answer}</p> : <p className="text-sm text-slate-500">No answer or tip shared for this one.</p>}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(post.preparation || post.resources.length > 0) && (
          <Section title="How they prepared">
            {post.preparation && <p className="whitespace-pre-wrap text-base leading-7 text-slate-200">{post.preparation}</p>}
            {post.resources.length > 0 && (
              <ul className="space-y-1.5">
                {post.resources.map((r, i) => (
                  <li key={i}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-words font-bold text-cyan-200 hover:underline">{r.label || r.url} ↗</a>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <TagLinks tags={post.tags} />
      </article>

      <p className="border-t border-white/10 pt-6 text-xs leading-6 text-slate-500">
        A personal account shared by a member of this platform. <Link href="/community" className="font-bold text-lime-300 hover:underline">Read more experiences</Link>
      </p>
    </main>
  );
}
