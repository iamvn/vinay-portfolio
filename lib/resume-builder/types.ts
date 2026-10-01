import { z } from 'zod';

/**
 * Resume builder (Admin → Resume builder): the content of one resume. Filled from the portfolio when a
 * resume is created, then edited per resume (e.g. one tailored copy per job application).
 */
const str = (max: number) => z.string().max(max).default('');
const lines = (count: number, max: number) => z.array(z.string().max(max)).max(count).default([]);

export const SECTION_IDS = ['summary', 'experience', 'projects', 'skills', 'education', 'extras'] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export const SECTION_LABELS: Record<SectionId, string> = {
  summary: 'Summary', experience: 'Experience', projects: 'Projects', skills: 'Skills', education: 'Education', extras: 'Certifications & more',
};

export const TEMPLATE_IDS = ['classic', 'modern', 'compact', 'minimal'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  { id: 'classic', name: 'Classic', description: 'The well-known LaTeX look: serif font, small-caps headings with a rule. Safe for every ATS.' },
  { id: 'modern', name: 'Modern', description: 'Clean sans-serif (Inter) with a subtle accent colour on headings. Single column.' },
  { id: 'compact', name: 'Compact', description: 'Tighter spacing and smaller text, to fit a lot of experience on one page.' },
  { id: 'minimal', name: 'Minimal', description: 'Plain and airy: no rules or colour, just strong typography.' },
];

export const linkSchema = z.object({ label: str(60), url: str(300) });

export const resumeDataSchema = z.object({
  basics: z.object({
    name: str(120),
    headline: str(200),
    email: str(200),
    phone: str(60),
    location: str(120),
    links: z.array(linkSchema).max(6).default([]),
    summary: str(3000),
  }).default({ name: '', headline: '', email: '', phone: '', location: '', links: [], summary: '' }),
  experience: z.array(z.object({
    role: str(150), company: str(150), location: str(120), period: str(80),
    bullets: lines(30, 1500), hidden: z.boolean().default(false),
  })).max(40).default([]),
  projects: z.array(z.object({
    name: str(150), tech: str(300), link: str(300),
    bullets: lines(20, 1500), hidden: z.boolean().default(false),
  })).max(40).default([]),
  skills: z.array(z.object({ group: str(80), items: str(1500) })).max(40).default([]),
  education: z.array(z.object({
    school: str(150), degree: str(200), location: str(120), period: str(80), details: str(1000),
  })).max(8).default([]),
  extras: z.array(z.object({ title: str(80), items: lines(30, 600) })).max(6).default([]),
  layout: z.object({
    order: z.array(z.enum(SECTION_IDS)).default([...SECTION_IDS]),
    hidden: z.array(z.enum(SECTION_IDS)).default([]),
    paper: z.enum(['a4', 'us-letter']).default('a4'),
  }).default({ order: [...SECTION_IDS], hidden: [], paper: 'a4' }),
});
export type ResumeData = z.output<typeof resumeDataSchema>;

/** One saved resume. `code` is null while the resume is generated from the form; set once the code is edited. */
export type ResumeDocument = {
  id: number;
  name: string;
  template: TemplateId;
  data: ResumeData;
  code: string | null;
  jobDescription: string;
  createdAt: string;
  updatedAt: string;
};

/** The sections in display order, without hidden ones. Sections missing from `order` are appended. */
export function visibleSections(data: ResumeData): SectionId[] {
  const order = [...data.layout.order, ...SECTION_IDS.filter((id) => !data.layout.order.includes(id))];
  return order.filter((id) => !data.layout.hidden.includes(id));
}
