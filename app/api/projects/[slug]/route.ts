import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { isUploadedProjectImage, toProject } from '@/lib/portfolio-repository';
import { projectPatchSchema } from '@/lib/schemas';
import { projectPdf, setProjectPdf } from '@/lib/project-pdf';
import { projectScope, removeScope, renameScope } from '@/lib/design/store';

type Context = { params: Promise<{ slug: string }> };
const NOT_FOUND = 'Project not found.';

export async function GET(_: Request, { params }: Context) {
  const { slug } = await params;
  try {
    const project = await prisma.project.findUnique({ where: { slug } });
    return project ? NextResponse.json({ ...toProject(project), pdf: await projectPdf(slug) }) : jsonError(NOT_FOUND, 404);
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}

/** Partial update of any project field. Lists (stack) replace the whole list. */
export async function PATCH(request: Request, { params }: Context) {
  const { slug } = await params;
  const { data, error } = await parseBody(request, projectPatchSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Send at least one project field.', 400);
  try {
    const current = await prisma.project.findUnique({ where: { slug } });
    if (!current) return jsonError(NOT_FOUND, 404);

    // A "link" project needs somewhere to link to (checked on the combined old + new values).
    if ((data.type ?? current.type) === 'link' && !(data.externalUrl ?? current.externalUrl)) {
      return jsonError('Validation failed.', 400, [{ path: 'externalUrl', message: 'is required when type is "link"' }]);
    }
    const currentPdf = await projectPdf(slug);
    if ((data.type ?? current.type) === 'pdf' && !(data.pdf ?? currentPdf)) {
      return jsonError('Validation failed.', 400, [{ path: 'pdf', message: 'is required when type is "pdf": upload the PDF' }]);
    }

    const { stack, pdf, ...fields } = data;
    const renamed = data.slug && data.slug !== slug ? data.slug : null;
    // An uploaded image lives at /api/projects/<slug>/image, so its URL follows a slug rename.
    const image = fields.image ?? current.image;
    const movedImage = renamed && isUploadedProjectImage(slug, image) ? image.replace(`/api/projects/${slug}/`, `/api/projects/${renamed}/`) : undefined;

    const [project] = await prisma.$transaction([
      prisma.project.update({
        where: { slug },
        data: { ...fields, ...(stack ? { stack: JSON.stringify(stack) } : {}), ...(movedImage ? { image: movedImage } : {}) },
      }),
      ...(renamed ? [prisma.projectImage.updateMany({ where: { slug }, data: { slug: renamed } })] : []),
    ]);
    if (pdf !== undefined) await setProjectPdf(project.slug, pdf);
    // The project's own page design follows a slug rename.
    if (renamed) await renameScope(projectScope(slug), projectScope(renamed));
    return NextResponse.json({ ...toProject(project), pdf: pdf ?? currentPdf });
  } catch (err) {
    return handleDbError(err, NOT_FOUND);
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const { slug } = await params;
  try {
    await prisma.$transaction([
      prisma.project.delete({ where: { slug } }),
      prisma.projectImage.deleteMany({ where: { slug } }),
    ]);
    await removeScope(projectScope(slug)); // its own page design, if any
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}
