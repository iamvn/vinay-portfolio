/**
 * The "Create a template with AI" prompt around the site's guide (lib/design/ai-template.ts promptGuide):
 * the person's request first, the current design last. Shared by the Design tab (manual: copy & paste)
 * and the server (automatic: sent to the site's own AI provider). No imports: safe in the browser.
 */

export type PromptParts = { kind: 'home' | 'project'; guide: string; current: string; currentFrom: 'draft' | 'live' | 'built-in' };

export const FROM_TEXT = { draft: 'your current draft', live: 'your live design', 'built-in': 'the built-in design' } as const;

/** The request and the starting point: everything except the guide. */
export function requestText(parts: Omit<PromptParts, 'guide'>, request: string, fromCurrent: boolean) {
  const what = request.trim() || '(Describe the design you want here.)';
  return [
    `# Design a ${parts.kind === 'home' ? 'homepage' : 'project page'} for my portfolio site\n\n## What I want\n\n${what}`,
    fromCurrent
      ? `# Starting point\n\nThis is ${FROM_TEXT[parts.currentFrom]} as JSON (settings equal to their defaults are left out). Rework it to match what I want: keep, move, restyle, remove or add blocks as needed, and give every block a unique id.\n\n${parts.current}`
      : '# Starting point\n\nStart from an empty page.',
  ];
}

export const ANSWER_NOW = '# Your answer\n\nReply now with the complete page JSON only: one object with "root" and "content", nothing before or after it.';

/** The whole prompt for pasting into any AI chat. */
export function buildPrompt(parts: PromptParts, request: string, fromCurrent: boolean) {
  const [what, start] = requestText(parts, request, fromCurrent);
  return [what, parts.guide, start, ANSWER_NOW].join('\n\n');
}
