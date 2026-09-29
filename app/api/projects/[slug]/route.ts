import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { isUploadedProjectImage, toProject } from '@/lib/portfolio-repository';
import { projectPatchSchema } from '@/lib/schemas';

type Context = { params: Promise<{ slug: string }> };
const NOT_FOUND = 'Project not found.';

export async function GET(_: Request, { params }: Context) {
  const { slug } = await params;
  try {
    const project = await prisma.project.findUnique({ where: { slug } });
    return project ? NextResponse.json(toProject(project)) : jsonError(NOT_FOUND, 404);
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

    const { stack, ...fields } = data;
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
    return NextResponse.json(toProject(project));
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
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleDbError(error, NOT_FOUND);
  }
}
