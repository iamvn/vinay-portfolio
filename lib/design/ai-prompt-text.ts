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
      ? `# Starting point\n\nThis is ${FROM_TEXT[parts.currentFrom]} as JSON (settings equal to their defaults are left out). Keep its sections and any text I wrote, but restyle it fully to match what I want: new palette, typography and layouts where the request calls for it. Give every block a unique id.\n\n${parts.current}`
      : '# Starting point\n\nDesign a completely new page. Don’t reuse a generic portfolio layout: everything should come from the concept in your brief.',
  ];
}

export const ANSWER_NOW = '# Your answer\n\nReply now with the complete page JSON only: one object with "root" and "content", nothing before or after it.';

/** The whole prompt for pasting into any AI chat. */
export function buildPrompt(parts: PromptParts, request: string, fromCurrent: boolean) {
  const [what, start] = requestText(parts, request, fromCurrent);
  return [what, parts.guide, start, ANSWER_NOW].join('\n\n');
}
