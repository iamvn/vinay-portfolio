import type React from 'react';

/**
 * Renders plain-text article content with a tiny, safe subset of Markdown:
 *   "## Heading"   → section heading      "- item" → bullet list
 *   blank line     → new paragraph         anything else → paragraph text
 * No HTML is interpreted, so pasted content can't inject markup.
 */
export function ArticleBody({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length} className="text-[15px] leading-7 text-slate-300 sm:text-base sm:leading-8">{paragraph.join(' ')}</p>);
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="space-y-2 text-[15px] leading-7 text-slate-300 sm:text-base">
          {bullets.map((item, index) => <li key={index} className="flex gap-3"><span className="shrink-0 text-lime-300" aria-hidden="true">▸</span><span className="min-w-0 break-words">{item}</span></li>)}
        </ul>,
      );
    }
    paragraph = [];
    bullets = [];
  };

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('## ')) {
      flush();
      blocks.push(<h2 key={blocks.length} className="text-balance pt-4 text-lg font-black uppercase tracking-tight text-white sm:text-xl">{line.slice(3)}</h2>);
      continue;
    }
    if (line.startsWith('- ')) {
      if (paragraph.length) flush();
      bullets.push(line.slice(2));
      continue;
    }
    if (bullets.length) flush();
    paragraph.push(line);
  }
  flush();

  return <div className="space-y-5">{blocks}</div>;
}
