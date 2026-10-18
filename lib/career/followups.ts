import type { Application, ApplicationSummary } from './types';

/**
 * Follow-up reminders (Applications, and the bell in the admin header). An application needs a follow-up when
 * it's still "Applied" and either a follow-up date you set has come, or it was sent 7+ days ago with no next step.
 * "Mark as followed up" sets the next step to "Follow up again" in 7 days; "No follow-up" sets a next step with no date.
 */
export const FOLLOW_UP_AFTER_DAYS = 7;
const DAY = 86_400_000;
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (days: number, from = new Date()) => today(new Date(from.getTime() + days * DAY));
const daysSince = (date: string, now = new Date()) => Math.max(0, Math.floor((new Date(today(now)).getTime() - new Date(date.slice(0, 10)).getTime()) / DAY));

type FollowUpFields = Pick<ApplicationSummary, 'status' | 'appliedAt' | 'nextStep' | 'nextStepAt'>;
export function followUpDue(app: FollowUpFields, now = new Date()) {
  if (app.status !== 'applied' || !app.appliedAt) return false;
  if (app.nextStepAt) return app.nextStepAt <= today(now);
  return !app.nextStep.trim() && daysSince(app.appliedAt, now) >= FOLLOW_UP_AFTER_DAYS;
}

export type FollowUp = { id: number; company: string; role: string; appliedAt: string; days: number };
export const toFollowUp = (app: Pick<ApplicationSummary, 'id' | 'company' | 'role' | 'appliedAt'>, now = new Date()): FollowUp =>
  ({ id: app.id, company: app.company, role: app.role, appliedAt: app.appliedAt, days: daysSince(app.appliedAt, now) });

/** A short, polite follow-up message (to a contact if the application has one with an email). */
export function draftFollowUp(app: Pick<Application, 'company' | 'role' | 'appliedAt' | 'contacts'>, yourName: string) {
  const contact = app.contacts.find((c) => c.email.trim()) ?? app.contacts.find((c) => c.name.trim());
  const first = contact?.name.trim().split(/\s+/)[0];
  const when = app.appliedAt ? new Date(app.appliedAt.slice(0, 10)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'recently';
  const role = app.role || 'the open role';
  const company = app.company || 'your team';
  const subject = `Following up: ${role} application`;
  const body = [
    `Hi ${first || 'there'},`,
    '',
    `I applied for the ${role} role at ${company} on ${when} and wanted to follow up. I'm still very interested in the position and the work your team is doing.`,
    '',
    `If it helps, I'd be glad to share more about my experience, a portfolio walkthrough, or references. Is there an update on the hiring timeline, or anything else I can send?`,
    '',
    'Thank you for your time,',
    yourName || '',
  ].join('\n').trimEnd();
  return { subject, body, to: contact?.email.trim() ?? '', contactName: contact?.name.trim() ?? '' };
}
