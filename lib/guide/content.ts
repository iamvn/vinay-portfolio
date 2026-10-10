import { z } from 'zod';

/**
 * The admin Guide ("Know this app"): what each tab is for and what it can do. These are the defaults;
 * the platform owner can rewrite any of them (Sites → Admin guide), which applies to every site.
 * Also the shape of announcements broadcast to every site's admins.
 */

export const GUIDE_TABS = [
  'profile', 'experience', 'skills', 'projects', 'copy', 'design', 'resume', 'builder', 'applications', 'community',
  'insights', 'ai', 'backup', 'users', 'sites', 'activity',
] as const;
export type GuideTab = (typeof GUIDE_TABS)[number];
export type GuideEntry = { summary: string; features: string[] };
export type Guide = { intro: string; tabs: Record<GuideTab, GuideEntry> };

export const DEFAULT_GUIDE: Guide = {
  intro: 'I can explain every part of your admin. Pick a tab, or type what you’re looking for.',
  tabs: {
    profile: {
      summary: 'Who you are: the details your site, resume and AI tools all start from.',
      features: ['Name, role, location, summary and photo', 'Hiring snapshot: target roles, work mode, availability, notice period', 'Contact links (email, LinkedIn, GitHub…)', '“Ask my resume” extra facts for the assistant'],
    },
    experience: {
      summary: 'Your work history, shown on your site and used by the resume builder and job matching.',
      features: ['Add, edit, reorder and delete roles', 'Bullet points with your real results', 'Click a role’s title to fold or unfold it'],
    },
    skills: {
      summary: 'Your skills in groups, used on your site, in resumes and to check which job requirements you can prove.',
      features: ['Groups like Frontend, Backend, Cloud', 'One skill per line', 'Feeds the requirement → evidence map'],
    },
    projects: {
      summary: 'Your portfolio projects and case studies.',
      features: ['Case studies, articles, links and PDF portfolios', 'Cover images, live and code links', 'Show or hide a project (drafts)', 'Reorder with the arrows'],
    },
    copy: {
      summary: 'Every piece of text on your site that isn’t part of your profile: headings, buttons, labels.',
      features: ['Rename sections and buttons', 'Placeholders like {name} fill in your details'],
    },
    design: {
      summary: 'A no-code designer for your homepage and project pages.',
      features: ['Drag and drop blocks, sections and templates', 'Design every project page once, or one by one', 'PDF portfolio viewer', 'Publish checklist reviews your page before it goes live', 'Version history and guided tours'],
    },
    resume: {
      summary: 'The resume file visitors can download from your site.',
      features: ['Upload a PDF resume', 'Download counts appear in Insights'],
    },
    builder: {
      summary: 'Build ATS-friendly resumes from your own profile, one per job.',
      features: ['Four ATS-safe templates with a live preview', 'ATS score (0–100) with fixes', 'Tailor with AI, with a truth guard', 'Download PDF, LaTeX or Typst, or open in Overleaf'],
    },
    applications: {
      summary: 'Your job search in one place: every application from saved to offer.',
      features: ['Paste a job link or text to see what it asks for and what you can prove', 'Board: Saved → Applied → Interviewing → Offer', 'Saves the exact resume version you sent', 'Cover letter, recruiter message and LinkedIn note', 'Interview prep questions', 'Prep notes and a Question bank for your own questions and links'],
    },
    community: {
      summary: 'Share interview experiences on the public community board, and read everyone else’s.',
      features: ['Post the rounds, questions asked and how you prepared', 'Start from one of your applications’ Prep notes', 'Post anonymously or keep drafts', 'Anyone can read the board at /community, with search and filters'],
    },
    insights: {
      summary: 'Who visits your site, where they come from, and what they do.',
      features: ['Visitors, visits, page views, time and bounce rate', 'Sources: LinkedIn, Google, job sites, AI assistants…', 'Countries, cities, pages and devices', 'Which sources lead to resume downloads and messages', 'Tagged share links, form messages and assistant questions'],
    },
    ai: {
      summary: 'Connect the AI providers that power the assistant and the career tools.',
      features: ['Anthropic, OpenAI, Gemini, Groq, OpenRouter, Mistral, DeepSeek or any OpenAI-compatible service', 'Automatic fallback to the next provider', 'Keys are encrypted', 'Daily and per-visitor limits'],
    },
    backup: {
      summary: 'Download everything as one file, or restore from one.',
      features: ['Download a backup (JSON)', 'Restore or add projects from JSON'],
    },
    users: {
      summary: 'Your account, and (for admins) who else can use this admin.',
      features: ['Change your password', 'Add users as admins or editors', 'Choose which tabs each editor can use', 'Read-only accounts', 'API tokens for scripts'],
    },
    sites: {
      summary: 'Create and manage the portfolio sites hosted on this platform.',
      features: ['Create a site for someone (a copy of yours)', 'Custom domains, pause or delete', 'Security: who can add users or sites', 'Choose which admin tabs each site has', 'Edit this Guide and send announcements (platform owner)'],
    },
    activity: {
      summary: 'What happens across your sites, for the platform owner.',
      features: ['Sign-ins, users and sites changed', 'Community posts shared, edited or hidden', 'Moderate the community board', 'Free up space by clearing old entries'],
    },
  },
};

export const guideEntrySchema = z.object({
  summary: z.string().trim().min(1).max(400),
  features: z.array(z.string().trim().min(1).max(160)).max(12),
}).strict();

/** The stored overrides: only what the platform owner changed. null resets a tab to its default. */
export const guideUpdateSchema = z.object({
  intro: z.string().trim().max(300).optional(),
  tabs: z.partialRecord(z.enum(GUIDE_TABS), guideEntrySchema.nullable()).optional(),
}).strict();

export function mergeGuide(stored: { intro?: string; tabs?: Partial<Record<GuideTab, GuideEntry>> } | null): Guide & { changed: GuideTab[] } {
  const tabs = { ...DEFAULT_GUIDE.tabs };
  const changed: GuideTab[] = [];
  for (const tab of GUIDE_TABS) {
    const entry = stored?.tabs?.[tab];
    const parsed = entry ? guideEntrySchema.safeParse(entry) : null;
    if (parsed?.success) { tabs[tab] = parsed.data; changed.push(tab); }
  }
  return { intro: stored?.intro?.trim() || DEFAULT_GUIDE.intro, tabs, changed };
}

// ---------- announcements ----------

export const ANNOUNCEMENT_KINDS = ['new', 'info', 'important'] as const;
export const ANNOUNCEMENT_LABELS: Record<(typeof ANNOUNCEMENT_KINDS)[number], string> = { new: 'New', info: 'Note', important: 'Important' };

export const announcementSchema = z.object({
  kind: z.enum(ANNOUNCEMENT_KINDS).default('new'),
  message: z.string().trim().min(3, 'Write a short message.').max(400),
  /** A web link, or a path on the site such as /community or /admin#applications. */
  link: z.union([z.string().trim().max(500).regex(/^(https?:\/\/[^\s]+\.[^\s]+|\/[^\s]*)$/, 'must be a web link (https://…) or a path like /community'), z.literal('')]).default(''),
  linkLabel: z.string().trim().max(40).default(''),
  /** Last day it shows ("YYYY-MM-DD"); '' = until you turn it off. */
  until: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).default(''),
  active: z.boolean().default(true),
}).strict();

/** Changes to an existing announcement: only the fields sent (no defaults filled in). */
export const announcementPatchSchema = z.object({
  kind: z.enum(ANNOUNCEMENT_KINDS),
  message: z.string().trim().min(3).max(400),
  link: z.union([z.string().trim().max(500).regex(/^(https?:\/\/[^\s]+\.[^\s]+|\/[^\s]*)$/, 'must be a web link (https://…) or a path like /community'), z.literal('')]),
  linkLabel: z.string().trim().max(40),
  until: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]),
  active: z.boolean(),
}).partial().strict();

export type Announcement = z.output<typeof announcementSchema> & { id: string; createdAt: string; by: string };

/** Showing now: turned on and not past its last day. */
export const isLive = (a: Announcement, today = new Date().toISOString().slice(0, 10)) => a.active && (!a.until || a.until >= today);
