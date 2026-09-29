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
    if (paragraph.length) blocks.push(<p key={blocks.length} className="text-base leading-8 text-slate-300">{paragraph.join(' ')}</p>);
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="space-y-2 text-base leading-7 text-slate-300">
          {bullets.map((item, index) => <li key={index} className="flex gap-3"><span className="text-lime-300">▸</span><span>{item}</span></li>)}
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
      blocks.push(<h2 key={blocks.length} className="pt-4 text-xl font-black uppercase tracking-tight text-white">{line.slice(3)}</h2>);
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
