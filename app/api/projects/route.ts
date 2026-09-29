import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { toProject } from '@/lib/portfolio-repository';
import { projectSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(projects.map(toProject));
  } catch (error) {
    return handleDbError(error);
  }
}

/** Create a project. Required: slug, title, description, stack[]. Everything else is optional (see README). */
export async function POST(request: Request) {
  const { data, error } = await parseBody(request, projectSchema);
  if (error) return error;
  try {
    const project = await prisma.project.create({ data: { ...data, stack: JSON.stringify(data.stack) } });
    return NextResponse.json(toProject(project), { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
