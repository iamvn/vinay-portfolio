import { z } from 'zod';
import { TAB_IDS, TAB_LABELS, type TabId } from '@/lib/auth/permissions';
import { FEATURE_INFO, SITE_FEATURES, type SiteFeature } from '@/lib/sites/features';

/** Support & requests: what a site's people send to the platform owner. Safe in the browser. */

/** What a site's people can send. */
export const SUPPORT_KINDS = ['access', 'help', 'feedback'] as const;
/** Plus "lead": someone asking for a site of their own from the Kritipath company page (not signed in). */
export const STORED_KINDS = [...SUPPORT_KINDS, 'lead'] as const;
export type SupportKind = (typeof STORED_KINDS)[number];
export const KIND_LABELS: Record<SupportKind, string> = { access: 'Access request', help: 'Help with a problem', feedback: 'Feedback or idea', lead: 'New customer' };

/** What a visitor sends from the company page ("Request access"). */
export const LEAD_PLANS = ['personal', 'team'] as const;
export const leadSchema = z.object({
  name: z.string().trim().min(2, 'Add your name.').max(80),
  email: z.string().trim().toLowerCase().email('Add a valid email.').max(160),
  plan: z.enum(LEAD_PLANS).default('personal'),
  role: z.string().trim().max(120).default(''),
  message: z.string().trim().max(1500).default(''),
  /** Honeypot: people never see this field, bots fill it in. */
  website: z.string().max(200).default(''),
}).strict();
export type LeadInput = z.output<typeof leadSchema>;

export const SUPPORT_STATUSES = ['open', 'in-progress', 'done', 'declined'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const STATUS_LABELS: Record<SupportStatus, string> = { open: 'Open', 'in-progress': 'In progress', done: 'Done', declined: 'Declined' };

/** What an access request is for: "tab:design" or "feature:aiTemplates". */
export type Target = { type: 'tab'; id: TabId } | { type: 'feature'; id: SiteFeature };
export function parseTarget(raw: string): Target | null {
  const [type, id] = raw.split(':');
  if (type === 'tab' && (TAB_IDS as readonly string[]).includes(id)) return { type, id: id as TabId };
  if (type === 'feature' && (SITE_FEATURES as readonly string[]).includes(id)) return { type, id: id as SiteFeature };
  return null;
}
export const targetLabel = (raw: string) => {
  const t = parseTarget(raw);
  return !t ? '' : t.type === 'tab' ? `${TAB_LABELS[t.id]} tab` : FEATURE_INFO[t.id].label;
};

export const requestSchema = z.object({
  kind: z.enum(SUPPORT_KINDS),
  target: z.string().max(40).default(''),
  subject: z.string().trim().min(3, 'Add a short subject.').max(120),
  message: z.string().trim().max(3000).default(''),
}).strict().refine((r) => r.kind !== 'access' || parseTarget(r.target), { message: 'Choose the tab or feature you need.', path: ['target'] });
export type RequestInput = z.output<typeof requestSchema>;

export const answerSchema = z.object({
  status: z.enum(SUPPORT_STATUSES),
  reply: z.string().trim().max(2000),
  /** Access requests: turn the tab or feature on for the site, and mark the request done. */
  grant: z.literal(true),
}).partial().strict();

export type SupportRequest = {
  id: string; site: string; siteName: string; fromName: string; fromEmail: string;
  kind: SupportKind; target: string; subject: string; message: string;
  status: SupportStatus; reply: string; repliedAt: string; createdAt: string; updatedAt: string;
};
