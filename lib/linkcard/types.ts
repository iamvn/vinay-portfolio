import { z } from 'zod';

/**
 * The link card: one shareable page at /details with a photo, a short bio and a list of links, made for
 * social media bios, QR codes and messages. Edited in Admin → Link card. Shared by the browser and the server.
 */

export const THEMES = {
  midnight: { label: 'Midnight', bg: 'radial-gradient(120% 70% at 50% 0%, #12304a 0%, #070b12 60%)', text: '#f8fafc', muted: '#94a3b8', button: 'rgba(255,255,255,.07)', buttonText: '#f8fafc', border: 'rgba(255,255,255,.14)', accent: '#bef264', accentText: '#0b1300' },
  aurora: { label: 'Aurora', bg: 'linear-gradient(160deg, #ffe1ec 0%, #ece4ff 50%, #dcebff 100%)', text: '#1d1d1f', muted: '#5b5b66', button: 'rgba(255,255,255,.72)', buttonText: '#1d1d1f', border: 'rgba(255,255,255,.95)', accent: '#7c3aed', accentText: '#ffffff' },
  ocean: { label: 'Ocean', bg: 'linear-gradient(170deg, #023047 0%, #035c73 55%, #0a8f8f 100%)', text: '#f0fdfa', muted: '#a5d8dd', button: 'rgba(255,255,255,.1)', buttonText: '#f0fdfa', border: 'rgba(255,255,255,.22)', accent: '#ffd166', accentText: '#1f1500' },
  paper: { label: 'Paper', bg: '#f6f1e7', text: '#2b2520', muted: '#6f655a', button: '#fffdf8', buttonText: '#2b2520', border: '#e2d8c6', accent: '#2b2520', accentText: '#f6f1e7' },
  forest: { label: 'Forest', bg: 'linear-gradient(170deg, #0f2a1d 0%, #16402b 60%, #1f5a3a 100%)', text: '#f1f8f2', muted: '#a7c8b0', button: 'rgba(255,255,255,.08)', buttonText: '#f1f8f2', border: 'rgba(255,255,255,.18)', accent: '#f4d35e', accentText: '#1d1600' },
  sunset: { label: 'Sunset', bg: 'linear-gradient(165deg, #ff7a2f 0%, #e8457c 50%, #6d5cf6 100%)', text: '#ffffff', muted: 'rgba(255,255,255,.82)', button: 'rgba(255,255,255,.16)', buttonText: '#ffffff', border: 'rgba(255,255,255,.35)', accent: '#ffffff', accentText: '#b0244f' },
  mono: { label: 'Mono', bg: '#ffffff', text: '#0a0a0a', muted: '#666666', button: '#ffffff', buttonText: '#0a0a0a', border: '#0a0a0a', accent: '#0a0a0a', accentText: '#ffffff' },
} as const;
export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const SHAPES = { rounded: 'Rounded', pill: 'Pill', square: 'Square' } as const;
export type Shape = keyof typeof SHAPES;

/** Suggestions in the editor's "Add a link" menu. `url` may hold a placeholder to fill in. */
export const PRESETS: { title: string; url: string; hint: string }[] = [
  { title: 'My portfolio', url: '{site}', hint: 'Your Kritipath site' },
  { title: 'Download my resume', url: '{site}/api/resume', hint: 'The resume uploaded in Admin → Resume' },
  { title: 'Book a call', url: 'https://', hint: 'Calendly, Cal.com, Google Calendar…' },
  { title: 'Watch my latest video', url: 'https://www.youtube.com/', hint: 'YouTube' },
  { title: 'Read my blog', url: 'https://', hint: 'Medium, Hashnode, Substack…' },
  { title: 'Message me on WhatsApp', url: 'https://wa.me/', hint: 'wa.me/ + your number with country code' },
  { title: 'Email me', url: 'mailto:', hint: 'mailto: + your email' },
];

const linkUrl = z.string().trim().min(1, 'Add the link.').max(1000)
    .refine((url) => /^(\{site\}(\/[^\s]*)?|https?:\/\/[^\s/$.?#][^\s]*|mailto:[^\s@]+@[^\s@]+\.[^\s@]+|tel:\+?[\d\s()-]{5,})$/i.test(url), 'Use a full link (https://…), mailto: or tel:.');

export const cardLinkSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,16}$/),
  title: z.string().trim().min(1, 'Give every link a title.').max(80),
  url: linkUrl,
  featured: z.boolean().default(false),
  enabled: z.boolean().default(true),
}).strict();

export const linkCardSchema = z.object({
  enabled: z.boolean(),
  headline: z.string().trim().max(120).default(''),
  bio: z.string().trim().max(300).default(''),
  theme: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]).default('midnight'),
  shape: z.enum(['rounded', 'pill', 'square']).default('rounded'),
  showPhoto: z.boolean().default(true),
  showSocials: z.boolean().default(true),
  links: z.array(cardLinkSchema).max(30, 'Up to 30 links.'),
}).strict();

export type CardLink = z.infer<typeof cardLinkSchema>;
export type LinkCard = z.infer<typeof linkCardSchema>;

/** What the card shows that comes from the profile (Admin → Profile), not from the card's own settings. */
export type CardProfile = { name: string; role: string; photo: string; socials: { kind: 'github' | 'linkedin' | 'instagram' | 'email'; url: string }[] };

export const newLinkId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

/** A rough kind for the little icon on each button. */
export function linkKind(url: string): 'video' | 'code' | 'work' | 'mail' | 'phone' | 'chat' | 'calendar' | 'file' | 'photo' | 'web' {
  const u = url.toLowerCase();
  if (u.startsWith('mailto:')) return 'mail';
  if (u.startsWith('tel:')) return 'phone';
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(u)) return 'video';
  if (/github\.com|gitlab\.com|codepen\.io|leetcode\.com/.test(u)) return 'code';
  if (/linkedin\.com/.test(u)) return 'work';
  if (/wa\.me|whatsapp\.com|t\.me|telegram/.test(u)) return 'chat';
  if (/calendly\.com|cal\.com|calendar\.google|zcal\.co|tidycal/.test(u)) return 'calendar';
  if (/\/api\/resume|\.pdf($|\?)/.test(u)) return 'file';
  if (/instagram\.com|behance\.net|dribbble\.com|pinterest\./.test(u)) return 'photo';
  return 'web';
}

/** "{site}/api/resume" → "/api/resume": links to this site work on whichever address it's opened at. */
export const resolveUrl = (url: string) => (url.startsWith('{site}') ? url.slice(6) || '/' : url);
