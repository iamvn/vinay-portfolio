import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { clientIp, rateLimited } from '@/lib/rate-limit';
import { listSubmissions, saveSubmission } from '@/lib/forms';

export const dynamic = 'force-dynamic';

const schema = z.object({
  form: z.string().trim().min(1).max(80),
  fields: z.record(z.string().trim().min(1).max(80), z.string().max(5000)).refine((value) => Object.keys(value).length <= 30, 'too many fields'),
  page: z.string().max(300).optional().default(''),
  website: z.string().max(200).optional().default(''), // spam trap: must stay empty
}).strict();

/** Public: a visitor sends a form built in Admin → Design. Rate limited; bots that fill the hidden field are ignored. */
export async function POST(request: Request) {
  if (rateLimited(`form:${clientIp(request)}`, 8, 10 * 60_000)) return jsonError('Too many messages. Please try again in a few minutes.', 429);
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  if (data.website) return NextResponse.json({ ok: true }); // pretend it worked
  const fields = Object.fromEntries(Object.entries(data.fields).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  if (!Object.keys(fields).length) return jsonError('Please fill in the form first.', 400);
  const email = Object.entries(fields).find(([k]) => /e-?mail/i.test(k))?.[1];
  if (email && !z.email().safeParse(email).success) return jsonError('Please enter a valid email address.', 400);
  try {
    await saveSubmission({ form: data.form, fields, page: data.page });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}

/** Admin → Insights: the latest messages. */
export async function GET(request: Request) {
  const { error } = await requireTab(request, 'insights');
  if (error) return error;
  try {
    return NextResponse.json(await listSubmissions(100));
  } catch (err) {
    return handleDbError(err);
  }
}
