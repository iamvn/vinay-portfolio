import { NextResponse } from 'next/server';
import { getPortfolioFromDatabase, replacePortfolio } from '@/lib/portfolio-repository';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { portfolioSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/** The backup format: content only (section switches aren't part of it, and the import is strict). */
const content = async () => {
  const { hidden: _hidden, ...data } = await getPortfolioFromDatabase({ includeDrafts: true }); // eslint-disable-line @typescript-eslint/no-unused-vars
  return data;
};

/** Full portfolio payload (same shape as data/portfolio.json). */
export async function GET() {
  try {
    return NextResponse.json(await content(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleDbError(error);
  }
}

/** Replaces EVERYTHING (profile, copy, skills, experience, projects) with the body. */
export async function PUT(request: Request) {
  const { data, error } = await parseBody(request, portfolioSchema);
  if (error) return error;
  const slugs = data.projects.map((project) => project.slug);
  if (new Set(slugs).size !== slugs.length) return NextResponse.json({ error: 'Project slugs must be unique.' }, { status: 400 });
  const groups = data.skills.map((skill) => skill.group);
  if (new Set(groups).size !== groups.length) return NextResponse.json({ error: 'Skill group names must be unique.' }, { status: 400 });
  try {
    await replacePortfolio(data);
    return NextResponse.json(await content());
  } catch (err) {
    return handleDbError(err);
  }
}
