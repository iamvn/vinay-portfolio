import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, parseBody } from '@/lib/api-utils';
import { toProject } from '@/lib/portfolio-repository';
import { projectSchema } from '@/lib/schemas';
import { projectPdfs, setProjectPdf, withPdf, withoutPdf } from '@/lib/project-pdf';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [projects, pdfs] = await Promise.all([prisma.project.findMany({ orderBy: { id: 'asc' } }), projectPdfs()]);
    return NextResponse.json(projects.map((row) => withPdf(toProject(row), pdfs)));
  } catch (error) {
    return handleDbError(error);
  }
}

/** Create a project. Required: slug, title, description, stack[]. Everything else is optional (see README). */
export async function POST(request: Request) {
  const { data, error } = await parseBody(request, projectSchema);
  if (error) return error;
  try {
    const project = await prisma.project.create({ data: { ...withoutPdf(data), stack: JSON.stringify(data.stack) } });
    if (data.pdf) await setProjectPdf(project.slug, data.pdf);
    return NextResponse.json({ ...toProject(project), pdf: data.pdf }, { status: 201 });
  } catch (err) {
    return handleDbError(err);
  }
}
