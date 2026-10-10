'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from './icons';

type Message = { role: 'user' | 'assistant'; content: string; error?: boolean };

const MAX_LENGTH = 500;

/** The classic site's colors, or (designed pages) the design's own theme colors and glass. */
const LOOKS = {
  classic: {
    launcher: 'border border-lime-300/50 bg-[#071018]/95 font-black uppercase tracking-wide text-lime-200 shadow-2xl shadow-black/40 backdrop-blur hover:border-lime-300',
    launcherIcon: '',
    dialog: 'border border-white/10 bg-[#071018] text-slate-100',
    line: 'border-white/10', title: 'font-black uppercase tracking-wide text-lime-300', faint: 'text-slate-500', soft: 'text-slate-400',
    close: 'border border-white/10 text-slate-300', chip: 'border border-white/10 text-slate-200 hover:border-lime-300/50',
    me: 'bg-lime-300 text-black', bot: 'border border-white/10 bg-black/30 text-slate-200', error: 'border border-red-400/40 bg-red-950/40 text-red-200',
    input: 'border border-white/10 bg-black/40 text-slate-100 placeholder:text-slate-600 focus:border-lime-300/60', send: 'bg-lime-300 text-black', link: 'text-lime-300',
  },
  themed: {
    launcher: 'd-glass d-glass-light font-semibold text-[var(--d-text)] hover:brightness-105',
    launcherIcon: 'text-[var(--d-accent-2)]',
    dialog: 'border border-[var(--d-line)] bg-[var(--d-surface)] text-[var(--d-text)]',
    line: 'border-[var(--d-line)]', title: 'font-bold text-[var(--d-text)]', faint: 'text-[var(--d-muted)]', soft: 'text-[var(--d-muted)]',
    close: 'border border-[var(--d-line)] text-[var(--d-muted)] hover:text-[var(--d-text)]',
    chip: 'border border-[var(--d-line)] bg-[var(--d-surface-2)] text-[var(--d-text)] hover:border-[var(--d-accent-2)]',
    me: 'bg-[var(--d-accent-2)] text-white', bot: 'border border-[var(--d-line)] bg-[var(--d-surface-2)] text-[var(--d-text)]', error: 'border border-red-300 bg-red-50 text-red-700',
    input: 'border border-[var(--d-line)] bg-[var(--d-surface-2)] text-[var(--d-text)] placeholder:text-[var(--d-muted)] focus:border-[var(--d-accent-2)]',
    send: 'bg-[var(--d-accent)] text-[var(--d-accent-text)]', link: 'text-[var(--d-accent-2)]',
  },
};

/** "Ask my resume": a small chat that answers questions from the portfolio's own content. */
export function AskAssistant({ name, email, linkedin, look = 'classic' }: {
  name: string; email?: string | null; linkedin?: string | null;
  /** classic: the original site's colors; light/dark: a designed page's own theme, as glass. */
  look?: 'classic' | 'light' | 'dark';
}) {
  const themed = look !== 'classic';
  const t = themed ? { ...LOOKS.themed, launcher: LOOKS.themed.launcher.replace('d-glass-light', look === 'dark' ? 'd-glass-dark' : 'd-glass-light') } : LOOKS.classic;
  const firstName = name.split(' ')[0] || name;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    `What has ${firstName} built with React and Next.js?`,
    `Tell me about ${firstName}'s AI work.`,
    `What roles is ${firstName} looking for?`,
    `What is ${firstName}'s current role?`,
  ];

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function ask(question: string) {
    const text = question.trim().slice(0, MAX_LENGTH);
    if (!text || busy) return;
    const history = [...messages.filter((message) => !message.error), { role: 'user' as const, content: text }];
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.answer) throw new Error(data?.error ?? 'The assistant is unavailable right now.');
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'Something went wrong.', error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input);
  }

  const address = email?.replace(/^mailto:/i, '');

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask my resume"
          className={`ask-launcher fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-40 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[11px] transition sm:min-h-12 sm:gap-2 sm:px-4 sm:text-xs lg:bottom-6 lg:right-6 ${themed ? 'text-[13px]! sm:text-sm!' : ''} ${t.launcher}`}
        >
          <span className={t.launcherIcon}><Icon name="sparkle" size={16} /></span><span className="sm:hidden">Ask AI</span><span className="hidden sm:inline">Ask my resume</span>
        </button>
      )}

      {open && (
        <div role="dialog" aria-modal="false" aria-label="Ask my resume" className={`fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col rounded-t-3xl shadow-2xl ${t.dialog} sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(600px,calc(100dvh-2rem))] sm:w-[400px] sm:rounded-3xl`}>
          <div className={`flex items-start justify-between gap-3 border-b p-4 ${t.line}`}>
            <div className="min-w-0">
              <p className={`flex items-center gap-2 text-sm ${t.title}`}><span className={t.launcherIcon}><Icon name="sparkle" size={16} /></span> Ask my resume</p>
              <p className={`mt-1 text-[11px] leading-4 ${t.faint}`}>AI answers from {firstName}&apos;s portfolio. It can make mistakes; please confirm details with {firstName}.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${t.close}`}>
              <Icon name="close" size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className={`text-sm ${t.soft}`}>Hi! Ask me anything about {firstName}&apos;s experience, skills or projects. Try:</p>
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => ask(suggestion)} className={`block min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm transition ${t.chip}`}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                  message.role === 'user' ? t.me : message.error ? t.error : t.bot
                }`}>
                  {message.content}
                </p>
              </div>
            ))}
            {busy && <p className={`text-sm ${t.faint}`}>Thinking…</p>}
          </div>

          <form onSubmit={submit} className={`border-t p-3 ${t.line} pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(input); } }}
                rows={1}
                placeholder={`Ask about ${firstName}…`}
                aria-label="Your question"
                className={`max-h-32 min-h-11 flex-1 resize-none rounded-xl px-3 py-2.5 text-base outline-none sm:text-sm ${t.input}`}
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40 ${t.send}`}>
                <Icon name="send" size={18} />
              </button>
            </div>
            {(address || linkedin) && (
              <p className={`mt-2 text-center text-[11px] ${t.faint}`}>
                Prefer a person?{' '}
                {address && <a href={`mailto:${address}`} className={`underline-offset-2 hover:underline ${t.link}`}>Email {firstName}</a>}
                {address && linkedin && ' · '}
                {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer" className={`underline-offset-2 hover:underline ${t.link}`}>LinkedIn</a>}
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}
