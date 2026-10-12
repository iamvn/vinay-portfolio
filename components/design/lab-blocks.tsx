'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A terminal window that types its title and lines out when it scrolls into view, with a blinking cursor.
 * Click it to run the typing again. The full text is always in the page (readable without JavaScript and by
 * screen readers); the not-yet-typed part is just transparent, so nothing jumps while it types.
 */
export function TypingTerminal({ title, lines, speed = 28, editing = false }: { title: string; lines: string[]; speed?: number; editing?: boolean }) {
  const all = [title, ...lines];
  const total = all.reduce((n, l) => n + l.length, 0);
  const [shown, setShown] = useState(total);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  const run = useCallback(() => {
    if (editing || prefersReducedMotion()) { setShown(total); return; }
    if (timer.current) window.clearInterval(timer.current);
    setShown(0);
    const step = Math.max(8, Math.min(120, speed));
    timer.current = window.setInterval(() => {
      setShown((n) => {
        if (n >= total) { if (timer.current) window.clearInterval(timer.current); return total; }
        return n + 1;
      });
    }, step);
  }, [editing, speed, total]);

  useEffect(() => {
    const el = ref.current;
    if (!el || editing) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); if (timer.current) window.clearInterval(timer.current); };
  }, [run, editing]);

  // Split the typed count over the title and the lines.
  let left = shown;
  const parts = all.map((text) => {
    const n = Math.max(0, Math.min(text.length, left));
    left -= text.length;
    return { typed: text.slice(0, n), rest: text.slice(n), active: n > 0 && n < text.length };
  });
  const done = shown >= total;
  const cursorAt = done ? all.length - 1 : parts.findIndex((p) => p.rest.length > 0);

  return (
    <div ref={ref} className="d-term" role="group" aria-label={title}>
      <div className="d-term-bar" aria-hidden="true"><i /><i /><i /></div>
      <button type="button" className="d-term-body" onClick={run} title="Click to run again" aria-label={`${title} ${lines.join('. ')}. Click to replay.`}>
        <span className="d-term-title" aria-hidden="true">
          {parts[0].typed}<span className="d-term-rest">{parts[0].rest}</span>{cursorAt === 0 && <span className="d-term-cursor" />}
        </span>
        <span className="d-term-lines" aria-hidden="true">
          {parts.slice(1).map((p, i) => (
            <span key={i} className="d-term-line">
              <span className="d-term-prompt">&gt;</span> {p.typed}<span className="d-term-rest">{p.rest}</span>{cursorAt === i + 1 && <span className="d-term-cursor" />}
            </span>
          ))}
        </span>
      </button>
    </div>
  );
}

/** Quotes that change every few seconds (paused on hover/focus), with dots and a "next" button. */
export function QuoteRotator({ quotes, interval = 8 }: { quotes: { quote: string; author: string }[]; interval?: number }) {
  const list = quotes.filter((q) => q.quote.trim());
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || list.length < 2 || prefersReducedMotion()) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % list.length), Math.max(4, interval) * 1000);
    return () => window.clearTimeout(t);
  }, [i, paused, list.length, interval]);
  if (!list.length) return null;
  const q = list[i % list.length];
  return (
    <figure className="d-quotes" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <blockquote key={i} className="d-quotes-text" aria-live="polite">“{q.quote}”</blockquote>
      {q.author && <figcaption className="d-quotes-by">– {q.author}</figcaption>}
      {list.length > 1 && (
        <div className="d-quotes-nav">
          <span className="d-quotes-dots" aria-hidden="true">{list.map((_, k) => <i key={k} className={k === i % list.length ? 'on' : ''} />)}</span>
          <button type="button" onClick={() => setI((n) => (n + 1) % list.length)} aria-label="Next quote">Next →</button>
        </div>
      )}
    </figure>
  );
}
