import { prisma } from './prisma';

/** Anonymous activity shown in Admin → Insights. No IPs, cookies or personal data are stored. */
export const EVENT_TYPES = ['resume_download', 'contact_email', 'contact_copy', 'contact_linkedin', 'ask'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Types a visitor's browser may report through the public /api/track endpoint. */
export const CLIENT_EVENT_TYPES: EventType[] = ['contact_email', 'contact_copy', 'contact_linkedin'];

/** Records an event. Never throws: tracking must not break the page or the request it's attached to. */
export async function recordEvent(type: EventType, detail = '') {
  try {
    await prisma.event.create({ data: { type, detail: detail.slice(0, 500), createdAt: new Date().toISOString() } });
  } catch (error) {
    console.error('recordEvent failed', error);
  }
}

export const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/** Start of today in UTC (used for the assistant's daily question cap). */
export const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};
