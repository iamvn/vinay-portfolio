import { z } from 'zod';

/**
 * Community → Free resources: links anyone can share (videos, articles, repos, courses), grouped by topic,
 * free and open to read. Shapes and rules shared by the browser and the server.
 */

export const TOPICS = [
  'DSA & coding', 'System design', 'Frontend', 'Backend', 'Full-stack', 'Mobile', 'AI & ML', 'Data', 'DevOps & cloud',
  'Testing & QA', 'Security', 'UI / UX design', 'Interview prep', 'Career & resume', 'Other',
] as const;
export type Topic = (typeof TOPICS)[number];

export const KINDS = ['YouTube', 'GitHub', 'Medium', 'Course', 'Article'] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_STYLE: Record<Kind, { color: string; label: string }> = {
  YouTube: { color: '#ff4d4d', label: 'Video' },
  GitHub: { color: '#c4b5fd', label: 'Repo' },
  Medium: { color: '#e2e8f0', label: 'Medium' },
  Course: { color: '#fbbf24', label: 'Course' },
  Article: { color: '#67e8f9', label: 'Article' },
};

const COURSE_HOSTS = /(^|\.)(coursera\.org|udemy\.com|edx\.org|freecodecamp\.org|khanacademy\.org|nptel\.ac\.in|swayam\.gov\.in|codecademy\.com|frontendmasters\.com|egghead\.io|scrimba\.com|theodinproject\.com|cs50\.harvard\.edu|ocw\.mit\.edu)$/;
/** Link shorteners hide where a link goes, so they aren't accepted. */
const SHORTENERS = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|buff\.ly|cutt\.ly|rb\.gy|shorturl\.at|tiny\.cc|rebrand\.ly|lnkd\.in)$/;

export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

export function kindOf(url: string): Kind {
  const host = hostOf(url);
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'YouTube';
  if (/(^|\.)github\.com$/.test(host) || host.endsWith('.github.io')) return 'GitHub';
  if (/(^|\.)medium\.com$/.test(host)) return 'Medium';
  if (COURSE_HOSTS.test(host)) return 'Course';
  return 'Article';
}

/** The same link written two ways ("www.", a trailing slash, tracking tags) counts as one. */
export function normalizeUrl(url: string) {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|si$|feature$|ref$|source$)/i.test(key)) u.searchParams.delete(key);
    const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
    let path = u.pathname.replace(/\/+$/, '');
    if (host === 'youtu.be') return `youtube.com/watch?v=${path.slice(1)}`;
    if (host === 'youtube.com' && path.startsWith('/shorts/')) return `youtube.com/watch?v=${path.slice(8)}`;
    if (host === 'github.com') path = path.toLowerCase();
    const query = u.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ''}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

const link = z.string().trim().max(1000).pipe(z.url('Paste the full link, starting with https://'))
  .refine((url) => /^https:\/\//i.test(url), 'Use a secure link (https://…).')
  .refine((url) => { try { const u = new URL(url); return !u.username && !u.password && !/^\d+\.\d+\.\d+\.\d+$|^\[|localhost$/.test(u.hostname) && u.hostname.includes('.'); } catch { return false; } }, 'That doesn’t look like a public web link.')
  .refine((url) => !SHORTENERS.test(hostOf(url)), 'Please paste the full link, not a shortened one.');

export const resourceSchema = z.object({
  url: link,
  title: z.string().trim().min(3, 'Give it a short title.').max(140),
  topic: z.enum(TOPICS, 'Pick a topic.'),
  note: z.string().trim().max(280, 'Keep the note under 280 characters.').default(''),
  name: z.string().trim().min(2, 'Add your name so people know who shared it.').max(60)
    .refine((name) => !/https?:|www\.|<|>/i.test(name), 'Just your name, please.'),
  /** Hidden field: people leave it empty, bots fill it in. */
  website: z.string().max(200).default(''),
}).strict();
export type ResourceInput = z.infer<typeof resourceSchema>;

export type Resource = {
  id: string; url: string; host: string; title: string; topic: Topic; kind: Kind; note: string;
  name: string;
  /** Set when a signed-in member shared it: their site's name and address. */
  verified: { site: string; url: string } | null;
  createdAt: string;
};

/** The line at the bottom of the page: a new one every few seconds. */
export const SHARE_LINES = [
  'The link that helped you might be the one someone else is looking for.',
  'Nobody gets anywhere alone. Share the resource that got you unstuck.',
  'Knowledge grows when it’s shared. Add yours, and help the next person move forward.',
  'Somewhere, someone is preparing for the interview you already passed. Leave them a map.',
  'Free, open and built by everyone: every link here was someone’s “this finally made sense”.',
  'Learn it, use it, pass it on.',
  'The best way to say thanks for a great resource is to share it.',
  'Every expert was once searching for the right tutorial. Be the one who points the way.',
];
