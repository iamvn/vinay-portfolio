import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { usableProviders } from '@/lib/assistant';
import { callProvider, ProviderError } from '@/lib/ai/providers';
import { cleanImported, importedSchema } from '@/lib/import/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RULES = `You turn the plain text of a resume into structured data for a portfolio site.
Copy facts only from <resume>. Never invent jobs, dates, numbers, skills or employers; leave a field empty when the resume doesn't say.
Keep the person's own wording for bullet points (fix only obvious line-break artefacts). Newest job first.
Answer with JSON only, in exactly this shape:
{"profile":{"name":"","role":"current title or headline","location":"","summary":"2-4 sentences from the resume's summary, if it has one","yearsExperience":"e.g. 6+ (only if the resume states it or the job dates show it)","targetRoles":"","assistantNotes":"education, certifications and languages, one per line"},
"experience":[{"role":"","company":"","period":"e.g. Jan 2021 – Present","current":false,"bullets":["…"]}],
"skills":[{"group":"e.g. Frontend","items":["React","TypeScript"]}]}`;

/** Profile → Import from a resume PDF: the text (pulled from the PDF in the browser) → profile, experience, skills. */
export async function POST(request: Request) {
  const { error } = await requireTab(request, 'profile');
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, z.object({ text: z.string().trim().min(80, 'The PDF has almost no text. Is it a scanned image?').max(60_000) }).strict());
  if (invalid) return invalid;
  const providers = await usableProviders();
  if (!providers.length) return jsonError('Reading a resume PDF needs the AI assistant: add a provider in Admin → AI assistant. Or import your LinkedIn data export instead (no AI needed).', 503);
  let last = 'The AI providers are unavailable right now. Try again in a minute.';
  for (const provider of providers) {
    try {
      const answer = await callProvider(provider, { rules: RULES, context: '', messages: [{ role: 'user', content: `<resume>\n${data.text}\n</resume>` }], maxTokens: 4000, timeoutMs: 55_000 });
      const start = answer.indexOf('{'), end = answer.lastIndexOf('}');
      if (start < 0 || end <= start) { last = 'The AI answer was not in the expected format. Try again.'; continue; }
      const parsed = importedSchema.safeParse(JSON.parse(answer.slice(start, end + 1)));
      if (!parsed.success) { last = 'The AI answer was missing parts. Try again.'; continue; }
      return NextResponse.json({ ...cleanImported(parsed.data), provider: provider.name });
    } catch (err) {
      if (err instanceof ProviderError && (err.status === 429 || err.status === 529)) last = 'The AI provider is busy. Try again in a minute.';
      console.error(`Profile import: provider "${provider.name}" failed:`, err instanceof Error ? err.message : err);
    }
  }
  return jsonError(last, 502);
}
