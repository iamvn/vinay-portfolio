import { prisma } from './prisma';

/**
 * A project's PDF (Project.pdf), read and written with plain SQL so it works whether or not the Prisma client
 * was regenerated after the column was added (the column itself is added by lib/db-migrate.ts).
 */
export async function projectPdfs(): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<{ slug: string; pdf: string | null }[]>`SELECT slug, pdf FROM Project`.catch(() => []);
  return new Map(rows.map((row) => [row.slug, row.pdf ?? '']));
}

export async function projectPdf(slug: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ pdf: string | null }[]>`SELECT pdf FROM Project WHERE slug = ${slug}`.catch(() => []);
  return rows[0]?.pdf ?? '';
}

export async function setProjectPdf(slug: string, pdf: string) {
  await prisma.$executeRaw`UPDATE Project SET pdf = ${pdf} WHERE slug = ${slug}`;
}

/** Adds `pdf` to projects read through Prisma. */
export function withPdf<T extends { slug: string }>(project: T, pdfs: Map<string, string>): T & { pdf: string } {
  return { ...project, pdf: pdfs.get(project.slug) ?? (project as { pdf?: string }).pdf ?? '' };
}

/** Prisma data without `pdf` (an older generated client doesn't know the column; it's written separately). */
export function withoutPdf<T extends object>(data: T): Omit<T, 'pdf'> {
  const { pdf: _pdf, ...rest } = data as T & { pdf?: unknown }; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}
