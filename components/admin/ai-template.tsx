'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, inputClass, type Notify } from './ui';
import { FROM_TEXT, buildPrompt, type PromptParts } from '@/lib/design/ai-prompt-text';

/**
 * Admin → Design → "Create a template with AI". The person describes the design (a theme that makes their
 * portfolio their own), and either:
 *   - Automatic: the site's own AI provider (Admin → AI assistant) designs it and it's saved as a template;
 *   - Manual: we build the complete prompt (request + rules + every block and setting + the current design),
 *     they paste it into any AI chat, then paste or upload the JSON answer.
 * Automatic is only offered when an AI provider is set up.
 */

type Parts = PromptParts & { ai: { ready: boolean; provider: string | null } };
type Check = { ok: true; blocks: number; fixes: string[]; brief?: string };
export type SavedTemplate = { id: string; name: string };
type Made = { template: SavedTemplate; blocks: number; fixes: string[]; brief?: string; provider: string };

/** Ideas that fill the request box: themes that make a portfolio unmistakably someone's own. */
const IDEAS: Record<'home' | 'project', { label: string; text: string }[]> = {
  home: [
    { label: '🎬 Streaming app', text: 'Build me a Netflix-style portfolio: near-black background, bold red accent, a big cinematic banner hero with my name like a show title, my projects as a row of wide poster cards that zoom on hover, my experience as an "episodes" list, skills as genre tags, and a "Continue watching" style contact strip at the end.' },
    { label: '🏏 Cricket scoreboard', text: 'A cricket-themed portfolio: deep green background with cream text like an old stadium scoreboard, my stats as big scoreboard numbers, projects as "innings" cards, my experience as a match timeline, skills as player tags, and a "Next match? Let’s talk" contact section.' },
    { label: '🕹️ Retro arcade', text: 'A retro 8-bit arcade portfolio: black screen, neon green and pink, monospace headings in capitals, "PRESS START" style buttons, projects as level-select cards, experience as a high-score table, skills as power-ups.' },
    { label: '📰 Newspaper', text: 'A vintage newspaper front page: warm paper background, black serif headlines, my name as the masthead, my summary as the lead story, projects as article columns in a 3-column grid, experience as "past editions", and a classifieds-style contact box.' },
    { label: '🚀 Space mission', text: 'A space mission control portfolio: midnight navy with star-like dots, cyan and amber accents, my role as the mission name, stats as telemetry readouts, projects as mission cards, experience as a launch timeline, and a "Request contact" console at the end.' },
  ],
  project: [
    { label: '🎬 Movie page', text: 'Make each project page feel like a movie title page on a streaming app: dark background, red accent, the cover image as a huge banner, the title and summary over a dark overlay, tags as genre chips, links as "Watch / Code" buttons, the story below, and next project as "Up next".' },
    { label: '🏏 Match report', text: 'A cricket match report: green and cream, the project title as the headline result, the summary as the match summary, cover image as the "highlights" photo, tags as the playing XI, the story as the full report, and next/previous as other fixtures.' },
    { label: '📰 Magazine feature', text: 'A magazine feature article: paper background, big serif title, summary as the standfirst in italics, full-width cover photo, story in a narrow readable column, links as small caps buttons, next/previous at the bottom.' },
  ],
};

async function copyText(text: string, fallback: HTMLTextAreaElement | null) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallback) return false;
    fallback.focus();
    fallback.select();
    return document.execCommand('copy');
  }
}

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
    <h4 className="flex items-center gap-2 text-sm font-black text-white">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lime-300 text-xs text-black">{n}</span>{title}
    </h4>
    {children}
  </div>
);

export function AiTemplateCard({ query, notify, hasDraft, onSaved, onUse }: {
  /** '' for the homepage, '?page=project' for project pages. */
  query: string;
  notify: Notify;
  hasDraft: boolean;
  onSaved: () => void;
  onUse: (template: SavedTemplate) => void;
}) {
  const [parts, setParts] = useState<{ query: string; parts: Parts } | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual' | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const [failed, setFailed] = useState('');
  const [request, setRequest] = useState('');
  const [fromCurrent, setFromCurrent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [answer, setAnswer] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [check, setCheck] = useState<{ answer: string; result: Check | { problem: string } } | null>(null);
  const [saved, setSaved] = useState<SavedTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<Parts>('GET', `/api/design/ai${query}`, undefined, { fresh: true })
      .then((p) => setParts({ query, parts: p }))
      .catch((error) => notify(describeError(error), 'error'));
  }, [notify, query]);
  const current = parts?.query === query ? parts.parts : null;
  const ready = Boolean(current?.ai.ready);
  // Automatic when this site has an AI provider (unless the person picked manual).
  const auto = ready && mode !== 'manual';
  const prompt = useMemo(() => (current ? buildPrompt(current, request, fromCurrent) : ''), [current, request, fromCurrent]);
  const checked = check?.answer === answer ? check.result : null;

  async function copy() {
    if (!request.trim()) { notify('Describe the design you want first (step 1).', 'error'); return; }
    if (await copyText(prompt, promptRef.current)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else notify('Couldn’t copy. Select the prompt text and copy it yourself.', 'error');
  }

  async function generate() {
    setBusy(true);
    setFailed('');
    setMade(null);
    try {
      const result = await api<Made>('POST', `/api/design/ai${query}`, { request: request.trim(), fromCurrent, name: name.trim() });
      setMade(result);
      notify(`“${result.template.name}” is ready in your templates.`);
      onSaved();
    } catch (error) {
      setFailed(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) { notify('That file is over 1 MB.', 'error'); return; }
    setAnswer(await file.text());
    setSaved(null);
  }

  async function submit(onlyCheck: boolean) {
    setBusy(true);
    try {
      const result = await api<Check & { template?: SavedTemplate }>('POST', `/api/design/templates${query}`, {
        json: answer, check: onlyCheck, name: name.trim(), description: description.trim(), request: request.trim(),
      });
      setCheck({ answer, result: { ok: true, blocks: result.blocks, fixes: result.fixes, brief: result.brief } });
      if (!onlyCheck && result.template) {
        setSaved(result.template);
        notify(`“${result.template.name}” saved. It’s in your templates now.`);
        onSaved();
      }
    } catch (error) {
      setCheck({ answer, result: { problem: describeError(error) } });
      if (!onlyCheck) notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Create a template with AI" id="design-ai-template" defaultOpen={false}>
      <p className="mb-4 text-sm leading-6 text-slate-300">
        Describe the look you want (a theme that makes your portfolio unmistakably yours) and AI turns it into one of your templates.
        Your name, projects and experience still come from the other tabs; the template only sets the design.
      </p>
      {!current ? <Loading /> : (
        <div className="grid gap-3">
          <div role="radiogroup" aria-label="How to create it" className="grid gap-2 sm:grid-cols-2">
            {([
              ['auto', 'Automatic', ready ? `Uses your AI provider (${current.ai.provider}). One click, no copying.` : 'Set up a provider in the AI assistant tab to use this.'],
              ['manual', 'Manual', 'Copy a prompt into any AI chat (ChatGPT, Claude, Gemini…) and paste the answer back.'],
            ] as const).map(([value, label, hint]) => {
              const on = value === 'auto' ? auto : !auto;
              const disabled = value === 'auto' && !ready;
              return (
                <button key={value} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => setMode(value)}
                  className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-lime-300/70 bg-lime-300/10' : 'border-white/10 bg-black/20 hover:border-white/25'}`}>
                  <span className="flex items-center gap-2 text-sm font-black text-white">
                    <span aria-hidden="true" className={`grid size-4 place-items-center rounded-full border ${on ? 'border-lime-300' : 'border-slate-500'}`}>{on && <span className="size-2 rounded-full bg-lime-300" />}</span>
                    {label}{value === 'auto' && !ready && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">Needs AI setup</span>}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{hint}</span>
                </button>
              );
            })}
          </div>

          <Step n={1} title="Describe the design">
            <div className="flex flex-wrap gap-2" aria-label="Ideas">
              <span className="self-center text-[11px] font-bold uppercase tracking-wider text-slate-500">Try</span>
              {IDEAS[current.kind].map((idea) => (
                <button key={idea.label} type="button" onClick={() => setRequest(idea.text)}
                  className="min-h-9 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:border-lime-300/50">{idea.label}</button>
              ))}
            </div>
            <Field label="How should it look?" hint="A theme, mood, colors, fonts, which sections and how they look. Only the design: your content comes from the other tabs.">
              <textarea className={inputClass} rows={4} maxLength={3000} value={request} placeholder={IDEAS[current.kind][0].text.replace(/^Build me/, 'e.g. Build me')} onChange={(e) => setRequest(e.target.value)} />
            </Field>
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
              <legend className="sr-only">Starting point</legend>
              <label className="flex items-center gap-2"><input type="radio" name="ai-start" checked={!fromCurrent} onChange={() => setFromCurrent(false)} className="accent-lime-300" />A completely new design (best for a theme)</label>
              <label className="flex items-center gap-2"><input type="radio" name="ai-start" checked={fromCurrent} onChange={() => setFromCurrent(true)} className="accent-lime-300" />Restyle {FROM_TEXT[current.currentFrom]} (keeps its sections and text)</label>
            </fieldset>
          </Step>

          {auto ? (
            <Step n={2} title="Create it">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Field label="Template name (optional)" hint="Empty: named from your description."><input className={inputClass} value={name} maxLength={60} placeholder="e.g. Cricket scoreboard" onChange={(e) => setName(e.target.value)} /></Field>
                <Button tone="primary" onClick={generate} disabled={busy || request.trim().length < 5}>{busy ? 'Designing…' : '✨ Create template'}</Button>
              </div>
              {busy && (
                <p role="status" className="flex items-center gap-2 text-sm text-slate-300">
                  <span aria-hidden="true" className="size-2 animate-ping rounded-full bg-lime-300" />
                  {current.ai.provider} is designing your page. This can take up to a minute.
                </p>
              )}
              {failed && (
                <div role="alert" className="grid gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  <span>✗ {failed}</span>
                  <span className="flex flex-wrap gap-2">
                    <Button onClick={generate} disabled={busy}>Try again</Button>
                    <Button onClick={() => setMode('manual')}>Use manual mode</Button>
                  </span>
                </div>
              )}
              {made && (
                <div className="grid gap-2 rounded-lg border border-lime-300/30 bg-lime-300/10 px-3 py-3">
                  <p className="text-sm text-lime-100">✓ <b>“{made.template.name}”</b> is ready: {made.blocks} blocks, designed by {made.provider}. It’s in your templates below.</p>
                  {made.brief && <p className="text-xs italic leading-5 text-slate-300">“{made.brief}”</p>}
                  {made.fixes.length > 0 && (
                    <details className="text-xs text-slate-300">
                      <summary className="cursor-pointer text-lime-200">We fixed {made.fixes.length} small thing{made.fixes.length === 1 ? '' : 's'} in the AI’s answer</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{made.fixes.slice(0, 40).map((fix, i) => <li key={i}>{fix}</li>)}</ul>
                    </details>
                  )}
                  <span className="flex flex-wrap gap-2">
                    {hasDraft
                      ? <ConfirmButton onConfirm={() => onUse(made.template)} confirmLabel="Replaces draft: tap again" className="border-white/15! text-slate-200!">Start from it</ConfirmButton>
                      : <Button tone="primary" onClick={() => onUse(made.template)}>Start from it</Button>}
                    <Button onClick={generate} disabled={busy}>Make another version</Button>
                  </span>
                </div>
              )}
            </Step>
          ) : (<>
          <Step n={2} title="Copy the prompt into your AI chat">
            <textarea ref={promptRef} readOnly aria-label="Prompt for the AI" value={prompt} rows={7}
              className={`${inputClass} font-mono text-[11px]! leading-5 text-slate-300`} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap items-center gap-3">
              <Button tone="primary" onClick={copy} view>{copied ? '✓ Copied' : 'Copy prompt'}</Button>
              <span className="text-xs text-slate-500">
                {Math.round(prompt.length / 1024)} KB · includes your request, the rules, every block and setting{fromCurrent ? ` and ${FROM_TEXT[current.currentFrom]}` : ''}.
              </span>
            </div>
          </Step>

          <Step n={3} title="Paste the AI’s answer">
            <textarea className={`${inputClass} font-mono text-xs!`} rows={6} value={answer} spellCheck={false} aria-label="The AI’s JSON answer"
              placeholder='{ "root": { "props": { … } }, "content": [ … ] }' onChange={(e) => { setAnswer(e.target.value); setSaved(null); }} />
            <label className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              Or upload a .json file:
              <input type="file" accept=".json,.txt,application/json,text/plain" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }}
                className="text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-slate-100" />
            </label>
            {checked && ('problem' in checked ? (
              <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">✗ {checked.problem}</p>
            ) : (
              <div className="rounded-lg border border-lime-300/30 bg-lime-300/10 px-3 py-2 text-sm text-lime-100">
                ✓ Looks good: {checked.blocks} block{checked.blocks === 1 ? '' : 's'}.
                {checked.brief && <span className="mt-1 block text-xs italic text-slate-300">“{checked.brief}”</span>}
                {checked.fixes.length > 0 && (
                  <details className="mt-1 text-xs text-slate-300">
                    <summary className="cursor-pointer text-lime-200">We fixed {checked.fixes.length} small thing{checked.fixes.length === 1 ? '' : 's'} for you</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">{checked.fixes.slice(0, 40).map((fix, i) => <li key={i}>{fix}</li>)}</ul>
                  </details>
                )}
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Template name"><input className={inputClass} value={name} maxLength={60} placeholder="e.g. Streaming app" onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Description (optional)" hint="Empty: the AI’s design concept, or your request."><input className={inputClass} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => submit(true)} disabled={busy || answer.trim().length < 2}>Check it</Button>
              <Button tone="primary" onClick={() => submit(false)} disabled={busy || answer.trim().length < 2 || !name.trim()}>{busy ? 'Working…' : 'Save as template'}</Button>
            </div>
            {saved && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-sm text-slate-200">“{saved.name}” is in your templates below.</span>
                {hasDraft
                  ? <ConfirmButton onConfirm={() => onUse(saved)} confirmLabel="Replaces draft: tap again" className="border-white/15! text-slate-200!">Start from it</ConfirmButton>
                  : <Button tone="primary" onClick={() => onUse(saved)}>Start from it</Button>}
              </div>
            )}
          </Step>
          </>)}
        </div>
      )}
    </Card>
  );
}
