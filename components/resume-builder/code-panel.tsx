'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Button, ConfirmButton, useReadOnly } from '@/components/admin/ui';

export type Problem = { message: string; line: number | null; severity: 'error' | 'warning' };

/**
 * Overleaf-style code editor for the resume's Typst code: line numbers, Tab indents, and compile errors
 * that jump to their line. The first edit switches the resume to "custom code".
 */
export function CodePanel({ code, custom, problems, onChange, onRegenerate }: {
  code: string; custom: boolean; problems: Problem[]; onChange: (code: string) => void; onRegenerate: () => void;
}) {
  const readOnly = useReadOnly();
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = code.split('\n').length;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Tab' || event.shiftKey || readOnly) return;
    event.preventDefault();
    const el = event.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = `${code.slice(0, start)}  ${code.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
  }

  function goToLine(line: number) {
    const el = area.current;
    if (!el) return;
    const offset = code.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
    el.focus();
    el.setSelectionRange(offset, offset + (code.split('\n')[line - 1]?.length ?? 0));
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, (line - 4) * lineHeight);
  }

  const errors = problems.filter((problem) => problem.severity === 'error');

  return (
    <div className="flex h-full min-h-[60vh] flex-col gap-3">
      <div className={`rounded-xl border px-4 py-3 text-xs leading-5 ${custom ? 'border-yellow-300/30 bg-yellow-300/[.06] text-yellow-100' : 'border-white/10 bg-white/[.03] text-slate-300'}`}>
        {custom ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1"><b>Custom code.</b> The preview, PDF and ATS check use this code. Changes from the Content, ATS and AI tabs rewrite only the section they touch; the rest of your edits stay.</p>
            {!readOnly && <ConfirmButton onConfirm={onRegenerate} confirmLabel="Discard code edits?" className="border-white/20! text-slate-100!">↺ Regenerate from form</ConfirmButton>}
          </div>
        ) : (
          <p>This <a className="text-cyan-300 underline" href="https://typst.app/docs/tutorial/" target="_blank" rel="noreferrer">Typst</a> code is generated from the Content tab and template. Edit it for full control (fonts, spacing, layout); your first edit switches this resume to custom code.</p>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0b1118] font-mono text-[13px] leading-5">
        <div ref={gutter} aria-hidden="true" className="w-11 shrink-0 select-none overflow-hidden border-r border-white/5 py-3 pr-2 text-right text-slate-600">
          {Array.from({ length: lines }, (_, index) => {
            const hasError = errors.some((problem) => problem.line === index + 1);
            return <div key={index} className={hasError ? 'font-bold text-red-400' : ''}>{index + 1}</div>;
          })}
        </div>
        <textarea
          ref={area}
          aria-label="Resume code (Typst)"
          value={code}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          onKeyDown={onKeyDown}
          onScroll={(event) => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop; }}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-slate-100 outline-none"
        />
      </div>

      {problems.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-auto rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-xs">
          {problems.map((problem, index) => (
            <li key={index}>
              <button type="button" onClick={() => problem.line && goToLine(problem.line)} className={`text-left ${problem.severity === 'error' ? 'text-red-200' : 'text-yellow-200'} hover:underline`}>
                {problem.severity === 'error' ? '✖' : '⚠'} {problem.line ? `Line ${problem.line}: ` : ''}{problem.message}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && !custom && <Button onClick={() => area.current?.focus()} className="self-start">Start editing code</Button>}
    </div>
  );
}
