import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { requireAnyTab } from '@/lib/auth/roles';
import { SECTION_KEYS } from '@/lib/sections';
import { hiddenSections, setHiddenSections } from '@/lib/sections-store';

export const dynamic = 'force-dynamic';

// Anyone who edits the homepage's content or look may switch its sections on and off.
const TABS = ['copy', 'projects', 'experience', 'skills', 'design', 'profile'] as const;
const schema = z.object({ hidden: z.array(z.enum(SECTION_KEYS as [string, ...string[]])).max(SECTION_KEYS.length) }).strict();

export async function GET(request: Request) {
  const { error } = await requireAnyTab(request, [...TABS]);
  if (error) return error;
  try {
    return NextResponse.json({ hidden: await hiddenSections() });
  } catch (err) {
    return handleDbError(err);
  }
}

export async function PUT(request: Request) {
  const { error } = await requireAnyTab(request, [...TABS]);
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, schema);
  if (invalid) return invalid;
  try {
    return NextResponse.json({ hidden: await setHiddenSections(data.hidden as never) });
  } catch (err) {
    return handleDbError(err);
  }
}
