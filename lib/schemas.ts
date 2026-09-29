import { z } from 'zod';

const text = z.string().trim().min(1, 'must not be empty');
const textList = z.array(text);
const optionalLink = z.string().trim().min(1).nullable().optional();

// ---------- Profile ----------
export const socialLinksSchema = z.object({
  github: optionalLink,
  linkedin: optionalLink,
  instagram: optionalLink,
  email: optionalLink,
}).strict();

export const profileSchema = z.object({
  name: text,
  role: text,
  location: text,
  available: z.boolean(),
  summary: text,
  yearsExperience: text,
  profileImage: z.string().trim(), // empty = show initials instead of a photo
  productsShipped: text,
  performanceMetric: text,
  lighthouse: text,
  usersImpacted: text,
  socialLinks: socialLinksSchema,
}).strict();

/** PATCH /api/profile: every field optional; socialLinks is merged key by key (null removes a link). */
export const profilePatchSchema = profileSchema.partial().strict();

// ---------- Site copy ----------
export const copySchema = z.object({
  header: z.array(z.string()).length(4, 'header must have exactly 4 entries'),
  hero: z.object({
    greeting: text,
    technologies: textList,
    primaryAction: text,
    secondaryAction: text,
    availability: text,
    terminalLines: textList,
  }).strict(),
  statsLabels: z.array(text).length(5, 'statsLabels must have exactly 5 entries'),
  skills: z.object({ eyebrow: text, title: text, description: text }).strict(),
  projects: z.object({
    eyebrow: text,
    title: text,
    enter: text,
    github: text,
    readArticle: text.default('READ ARTICLE'),
    openLink: text.default('OPEN LINK ↗'),
    live: text.default('LIVE ↗'),
    featured: text.default('★ FEATURED'),
  }).strict(),
  experience: z.object({ eyebrow: text, title: text, description: text, current: text }).strict(),
  contact: z.object({ eyebrow: text, title: text, description: text, action: text }).strict(),
  footer: text,
}).strict();

// ---------- Skills ----------
export const skillGroupSchema = z.object({ group: text, items: textList }).strict();
export const skillGroupPatchSchema = skillGroupSchema.partial().strict();

// ---------- Experience ----------
export const experienceSchema = z.object({
  role: text,
  company: text,
  period: text,
  current: z.boolean().optional().default(false),
  bullets: textList,
}).strict();
export const experiencePatchSchema = z.object({
  role: text,
  company: text,
  period: text,
  current: z.boolean(),
  bullets: textList,
}).partial().strict();

// ---------- Projects ----------
export const PROJECT_TYPES = ['case-study', 'article', 'link'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase words separated by hyphens, e.g. "my-project"');
const optionalUrl = z.string().trim().refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'must be empty or a full URL starting with https://');
const optionalText = z.string().trim();

/** Every project field; all but slug/title/description/stack are optional and default to empty. */
const projectFields = {
  slug,
  title: text,
  description: text,
  stack: textList,
  featured: z.boolean(),
  type: z.enum(PROJECT_TYPES),
  image: optionalText,        // uploaded image URL or a /public path; empty = initials placeholder
  liveUrl: optionalUrl,       // "Live ↗" link
  repoUrl: optionalUrl,       // "GitHub ↗" link
  externalUrl: optionalUrl,   // where a "link" project goes when clicked (required for type "link")
  objective: optionalText,    // case-study sections (each hidden when empty)
  approach: optionalText,
  architecture: optionalText,
  result: optionalText,
  content: optionalText,      // article body: blank line = new paragraph, "## " heading, "- " bullet
};

const requireLinkUrl = (project: { type?: ProjectType; externalUrl?: string }, ctx: z.RefinementCtx) => {
  if (project.type === 'link' && !project.externalUrl) {
    ctx.addIssue({ code: 'custom', path: ['externalUrl'], message: 'is required when type is "link"' });
  }
};

export const projectSchema = z.object({
  ...projectFields,
  featured: projectFields.featured.optional().default(false),
  type: projectFields.type.optional().default('case-study'),
  image: optionalText.optional().default(''),
  liveUrl: optionalUrl.optional().default(''),
  repoUrl: optionalUrl.optional().default(''),
  externalUrl: optionalUrl.optional().default(''),
  objective: optionalText.optional().default(''),
  approach: optionalText.optional().default(''),
  architecture: optionalText.optional().default(''),
  result: optionalText.optional().default(''),
  content: optionalText.optional().default(''),
}).strict().superRefine(requireLinkUrl);

/** PATCH: any subset. The "link needs externalUrl" rule is checked in the route after merging. */
export const projectPatchSchema = z.object(projectFields).partial().strict();

// ---------- Reorder ----------
export const reorderSchema = z.object({ ids: z.array(z.number().int().positive()).min(1) }).strict();

// ---------- Whole portfolio (PUT /api/portfolio) ----------
export const portfolioSchema = z.object({
  profile: profileSchema,
  copy: copySchema,
  skills: z.array(skillGroupSchema),
  experience: z.array(experienceSchema),
  projects: z.array(projectSchema),
}).strict();

export type PortfolioInput = z.input<typeof portfolioSchema>;
/** Portfolio with all defaults filled in — what the site renders. */
export type PortfolioData = z.output<typeof portfolioSchema>;
