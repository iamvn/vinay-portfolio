import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { importDesign, kindOf, parseAiJson } from '@/lib/design/ai-template';
import { LimitError, createCustomTemplate, listCustomTemplates } from '@/lib/design/custom-templates';
import { scopeFromRequest } from '@/lib/design/scope';
import { featureOff } from '@/lib/sites/require-feature';

export const dynamic = 'force-dynamic';

/** This site's own templates for the page in the query string (?page=project for project pages). */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'design');
  if (error) return error;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  try {
    return NextResponse.json(await listCustomTemplates(kindOf(scope)));
  } catch (err) {
    return handleDbError(err);
  }
}

const schema = z.object({
  /** The AI's answer as pasted (or the uploaded .json file's text). */
  json: z.string().min(2, 'Paste the AI’s answer first.').max(1_000_000, 'That’s too long (over 1 MB).'),
  name: z.string().trim().max(60).default(''),
  description: z.string().trim().max(200).default(''),
  /** Only check it: nothing is saved. */
  check: z.boolean().default(false),
}).strict();

/**
 * Turns the AI's JSON into a template of this site (after cleaning it up and checking it like any design).
 * With { check: true } only reports what it found. Admins and editors with the Design tab.
 */
export async function POST(request: Request) {
  const { user, error: denied } = await requireTab(request, 'design');
  if (denied) return denied;
  // Making templates needs the feature; templates already made stay usable (and deletable) if it's turned off.
  const off = await featureOff('aiTemplates');
  if (off) return off;
  const { scope, error: badScope } = await scopeFromRequest(request);
  if (badScope) return badScope;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  const parsed = parseAiJson(data.json);
  if (parsed.problem) return jsonError(parsed.problem, 400);
  const kind = kindOf(scope);
  const result = importDesign(parsed.value, kind);
  if (result.problem !== undefined) return jsonError(result.problem, 400);
  if (data.check) return NextResponse.json({ ok: true, blocks: result.blocks, fixes: result.fixes });
  if (!data.name) return jsonError('Give the template a name.', 400);
  try {
    const template = await createCustomTemplate({ name: data.name, description: data.description, kind, data: result.data, blocks: result.blocks, by: user.email });
    return NextResponse.json({ template, blocks: result.blocks, fixes: result.fixes }, { status: 201 });
  } catch (err) {
    if (err instanceof LimitError) return jsonError(err.message, 400);
    return handleDbError(err);
  }
}
