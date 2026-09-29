import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { cleanLinks, toProfile } from '@/lib/portfolio-repository';
import { profilePatchSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: 1 } });
    return profile ? NextResponse.json(toProfile(profile)) : jsonError('Profile not found. Run npm run db:setup.', 404);
  } catch (error) {
    return handleDbError(error);
  }
}

/** Partial update. socialLinks is merged: send only the links you want to change, null removes one. */
export async function PATCH(request: Request) {
  const { data, error } = await parseBody(request, profilePatchSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return jsonError('Send at least one profile field.', 400);
  try {
    const current = await prisma.profile.findUnique({ where: { id: 1 } });
    if (!current) return jsonError('Profile not found. Run npm run db:setup.', 404);
    const { socialLinks, ...fields } = data;
    const links = socialLinks ? cleanLinks({ ...JSON.parse(current.socialLinks), ...socialLinks }) : undefined;
    const profile = await prisma.profile.update({
      where: { id: 1 },
      data: { ...fields, ...(links ? { socialLinks: JSON.stringify(links) } : {}) },
    });
    return NextResponse.json(toProfile(profile));
  } catch (err) {
    return handleDbError(err);
  }
}
