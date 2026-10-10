import { z } from 'zod';

/**
 * Community: interview experiences shared by the people on every site of the platform (Admin → Community),
 * readable by anyone at /community. Shapes and limits shared by the browser and the server.
 */

export const CATEGORIES = [
  'Frontend', 'Backend', 'Full-stack', 'Mobile', 'DevOps / Cloud', 'Data / ML / AI', 'QA / Testing', 'Security',
  'Product', 'UI / UX design', 'Interior design', 'Architecture', 'Other',
] as const;
export const LEVELS = ['Intern', 'Entry level', 'Mid level', 'Senior', 'Lead / Staff', 'Manager', 'Other'] as const;
export const OUTCOMES = ['Offer', 'Rejected', 'In progress', 'Withdrew', 'No response'] as const;
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
/** Suggestions for the tag field (any tag can be typed). */
export const TAG_SUGGESTIONS = [
  'React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Java', 'Spring', 'Python', 'Go', 'SQL', 'MongoDB', 'Redis',
  'System design', 'DSA', 'AWS', 'Docker', 'Kubernetes', 'GraphQL', 'CSS', 'Testing', 'Behavioural', 'AutoCAD', 'SketchUp', 'Revit', 'Figma',
] as const;

const webLink = z.url('must be a full link (https://…)').max(2000).refine((url) => /^https?:\/\//i.test(url), 'must start with http:// or https://');
const blankable = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal('')]).default('');

export const postSchema = z.object({
  title: z.string().trim().min(5, 'Give it a short title, e.g. “Senior Frontend Engineer at Acme: 4 rounds”.').max(140),
  company: z.string().trim().min(1, 'Which company was it?').max(100),
  role: z.string().trim().min(1, 'Which role did you interview for?').max(120),
  location: z.string().trim().max(100).default(''),
  category: z.enum(CATEGORIES),
  level: blankable(LEVELS),
  outcome: blankable(OUTCOMES),
  difficulty: blankable(DIFFICULTIES),
  /** Month of the interview, "YYYY-MM". */
  interviewedOn: z.union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), z.literal('')]).default(''),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  summary: z.string().trim().max(5000).default(''),
  rounds: z.array(z.object({ name: z.string().trim().min(1).max(80), details: z.string().trim().max(2000).default('') }).strict()).max(12).default([]),
  questions: z.array(z.object({
    question: z.string().trim().min(1).max(1000),
    round: z.string().trim().max(80).default(''),
    answer: z.string().trim().max(4000).default(''),
  }).strict()).max(60).default([]),
  preparation: z.string().trim().max(5000).default(''),
  resources: z.array(z.object({ label: z.string().trim().max(120).default(''), url: webLink }).strict()).max(20).default([]),
  /** Shown as the author (unless anonymous). */
  authorName: z.string().trim().max(80).default(''),
  authorHeadline: z.string().trim().max(120).default(''),
  anonymous: z.boolean().default(false),
  /** false = draft, only the site's own people see it. */
  published: z.boolean().default(true),
}).strict();

export type PostInput = z.output<typeof postSchema>;
/** published: on the board · draft: the author unpublished it · hidden: taken down by the platform owner. */
export type PostStatus = 'published' | 'draft' | 'hidden';

export type Post = PostInput & {
  id: string;
  site: string;
  siteName: string;
  /** The author's portfolio address (not shown when anonymous). */
  authorUrl: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
};

/** What the public board shows: no internal fields, and nothing that identifies an anonymous author. */
export type PublicPost = Omit<Post, 'site' | 'siteName' | 'published' | 'status'> & { siteName: string };

export const toPublic = (post: Post): PublicPost => {
  const { site: _site, published: _published, status: _status, ...rest } = post; // eslint-disable-line @typescript-eslint/no-unused-vars
  return post.anonymous
    ? { ...rest, authorName: 'Anonymous', authorUrl: '', siteName: '' }
    : { ...rest, authorName: post.authorName || post.siteName || 'A member' };
};

export const normalizeTag = (tag: string) => tag.trim().replace(/\s+/g, ' ').slice(0, 30);
