import type { PortfolioData } from './portfolio';
import { copySchema, type PortfolioData as ParsedPortfolio } from './schemas';
import { prisma } from './prisma';

const parse = <T>(value: string): T => JSON.parse(value) as T;

type SocialLinks = Record<string, string | null | undefined>;

// ---------- Row → API shape ----------
type ProjectRow = Awaited<ReturnType<typeof prisma.project.findFirstOrThrow>>;

export const toProject = (row: ProjectRow) =>
  ({ ...row, type: row.type as PortfolioData['projects'][number]['type'], stack: parse<string[]>(row.stack) });

/** Stored site copy with defaults filled in for keys added in later versions. */
export function parseCopy(content: string): PortfolioData['copy'] {
  const raw = parse<unknown>(content);
  const result = copySchema.safeParse(raw);
  return result.success ? result.data : (raw as PortfolioData['copy']);
}

export const toSkillGroup = (row: { id: number; name: string; items: string; order: number }) =>
  ({ id: row.id, group: row.name, items: parse<string[]>(row.items), order: row.order });

export const toExperience = (row: { id: number; role: string; company: string; period: string; current: boolean; bullets: string; order: number }) =>
  ({ ...row, bullets: parse<string[]>(row.bullets) });

export function toProfile(row: NonNullable<Awaited<ReturnType<typeof prisma.profile.findUnique>>>) {
  return {
    name: row.name,
    role: row.role,
    location: row.location,
    available: row.available,
    summary: row.summary,
    yearsExperience: row.yearsExperience,
    profileImage: row.profileImage,
    productsShipped: row.productsShipped,
    performanceMetric: row.performanceMetric,
    lighthouse: row.lighthouse,
    usersImpacted: row.usersImpacted,
    socialLinks: parse<SocialLinks>(row.socialLinks),
  };
}

/** Drops null/empty links so the stored JSON only has real URLs. */
export const cleanLinks = (links: SocialLinks) =>
  Object.fromEntries(Object.entries(links).filter(([, value]) => typeof value === 'string' && value.length > 0));

// ---------- Reads ----------
export async function getPortfolioFromDatabase(): Promise<PortfolioData> {
  const [profile, copy, skills, experience, projects] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.siteCopy.findUnique({ where: { id: 1 } }),
    prisma.skillGroup.findMany({ orderBy: { order: 'asc' } }),
    prisma.experience.findMany({ orderBy: { order: 'asc' } }),
    prisma.project.findMany({ orderBy: { id: 'asc' } }),
  ]);

  if (!profile || !copy) throw new Error('NOT_SEEDED');
  return {
    profile: toProfile(profile) as PortfolioData['profile'],
    copy: parseCopy(copy.content),
    skills: skills.map(({ name, items }) => ({ group: name, items: parse<string[]>(items) })),
    experience: experience.map((item) => ({ role: item.role, company: item.company, period: item.period, current: item.current, bullets: parse<string[]>(item.bullets) })),
    projects: projects.map((row) => {
      const { id: _id, ...project } = toProject(row); // eslint-disable-line @typescript-eslint/no-unused-vars
      return project;
    }),
  };
}

// ---------- Full replace (seed + PUT /api/portfolio) ----------
export async function replacePortfolio(data: ParsedPortfolio) {
  await prisma.$transaction([
    prisma.project.deleteMany(),
    prisma.experience.deleteMany(),
    prisma.skillGroup.deleteMany(),
    prisma.siteCopy.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.profile.create({ data: { id: 1, ...data.profile, socialLinks: JSON.stringify(cleanLinks(data.profile.socialLinks)) } }),
    prisma.siteCopy.create({ data: { id: 1, content: JSON.stringify(data.copy) } }),
    prisma.skillGroup.createMany({ data: data.skills.map((skill, order) => ({ name: skill.group, items: JSON.stringify(skill.items), order })) }),
    prisma.experience.createMany({ data: data.experience.map((item, order) => ({ ...item, bullets: JSON.stringify(item.bullets), order })) }),
    prisma.project.createMany({ data: data.projects.map((project) => ({ ...project, stack: JSON.stringify(project.stack) })) }),
    // Keep uploaded images for projects that still exist (matched by slug), drop the rest.
    prisma.projectImage.deleteMany({ where: { slug: { notIn: data.projects.map((project) => project.slug) } } }),
  ]);
}

// ---------- Ordering helpers ----------
export async function nextOrder(model: 'skillGroup' | 'experience') {
  const last = model === 'skillGroup'
    ? await prisma.skillGroup.findFirst({ orderBy: { order: 'desc' } })
    : await prisma.experience.findFirst({ orderBy: { order: 'desc' } });
  return (last?.order ?? -1) + 1;
}

/**
 * Applies a new order. `ids` must contain every existing id exactly once.
 * Two passes (negative temp values first) avoid clashing with the unique "order" column.
 */
export async function reorder(model: 'skillGroup' | 'experience', ids: number[]): Promise<string | null> {
  const existing = model === 'skillGroup'
    ? await prisma.skillGroup.findMany({ select: { id: true } })
    : await prisma.experience.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((row) => row.id));
  if (ids.length !== existingIds.size || new Set(ids).size !== ids.length || !ids.every((id) => existingIds.has(id))) {
    return `ids must list every existing id exactly once: [${[...existingIds].join(', ')}]`;
  }
  const update = (id: number, order: number) => model === 'skillGroup'
    ? prisma.skillGroup.update({ where: { id }, data: { order } })
    : prisma.experience.update({ where: { id }, data: { order } });
  await prisma.$transaction([
    ...ids.map((id, index) => update(id, -(index + 1))),
    ...ids.map((id, index) => update(id, index)),
  ]);
  return null;
}

/** URL of a project's uploaded image; the version changes on every upload so browsers refetch it. */
export const projectImageUrl = (slug: string, uploadedAt: string) => `/api/projects/${slug}/image?v=${Date.parse(uploadedAt)}`;
export const isUploadedProjectImage = (slug: string, image: string) => image.startsWith(`/api/projects/${slug}/image`);
