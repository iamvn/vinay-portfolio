import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { aiReady, DesignAiError, generateDesign, nameFrom } from '@/lib/design/ai-generate';
import { createCustomTemplate, LimitError } from '@/lib/design/custom-templates';
import type { DesignScope } from '@/lib/design/store';
import { featureOff } from '@/lib/sites/require-feature';
import { requireTab } from '@/lib/auth/roles';
import { compactDesign, kindOf, promptGuide } from '@/lib/design/ai-template';
import { getDraft, getPublished } from '@/lib/design/store';
import { templatesFor } from '@/lib/design/templates';
import { scopeFromRequest } from '@/lib/design/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The parts of the "Create a template with AI" prompt that come from the site: the rules and the block
 * catalog for this kind of page, and the current design (draft, else live, else the built-in starting
 * design) as compact JSON. The admin page adds the person's request. No AI is called.
 */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'design');
  if (error) return error;
  const off = await featureOff('aiTemplates');
  if (off) return off;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  try {
    const [parts, ai] = await Promise.all([promptParts(scope), aiReady()]);
    return NextResponse.json({ ...parts, ai });
  } catch (err) {
    return handleDbError(err);
  }
}

async function promptParts(scope: DesignScope) {
  const kind = kindOf(scope);
  const [draft, published] = await Promise.all([getDraft(scope), getPublished(scope)]);
  const builtIn = templatesFor(scope)[0];
  const [data, from] = draft ? [draft.data, 'draft' as const] : published ? [published.data, 'live' as const] : [builtIn.data, 'built-in' as const];
  return { kind, guide: promptGuide(kind), current: JSON.stringify(compactDesign(data)), currentFrom: from };
}

const generateSchema = z.object({
  request: z.string().trim().min(5, 'Describe the design you want.').max(3000),
  fromCurrent: z.boolean().default(false),
  name: z.string().trim().max(60).default(''),
}).strict();

/**
 * Automatic mode: asks this site's AI provider for the design and saves it as one of the site's
 * templates straight away. Body { request, fromCurrent?, name? }.
 */
export async function POST(request: Request) {
  const { user, error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  const off = await featureOff('aiTemplates');
  if (off) return off;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  const { data, error } = await parseBody(request, generateSchema);
  if (error) return error;
  try {
    const parts = await promptParts(scope);
    const result = await generateDesign(parts, data.request, data.fromCurrent, parts.kind);
    const template = await createCustomTemplate({
      name: data.name || nameFrom(data.request), description: (result.brief || data.request).slice(0, 300), kind: parts.kind,
      data: result.data, blocks: result.blocks, by: user.email,
    });
    return NextResponse.json({ template, blocks: result.blocks, fixes: result.fixes, brief: result.brief, provider: result.provider }, { status: 201 });
  } catch (err) {
    if (err instanceof DesignAiError || err instanceof LimitError) return jsonError(err.message, err instanceof DesignAiError ? err.status : 400);
    return handleDbError(err);
  }
}
