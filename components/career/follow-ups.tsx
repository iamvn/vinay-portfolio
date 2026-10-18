'use client';

import { useEffect, useState } from 'react';
import { api, describeError } from '@/components/admin/api';
import { Button, Card, inputClass, useReadOnly, type Notify } from '@/components/admin/ui';
import { addDays, draftFollowUp, followUpDue, toFollowUp, type FollowUp } from '@/lib/career/followups';
import type { Application, ApplicationSummary } from '@/lib/career/types';

/** Applications → "Follow-ups due": applied 7+ days ago with no reply, with a drafted message for each. */
export function FollowUps({ apps, notify, onChanged }: { apps: ApplicationSummary[]; notify: Notify; onChanged: () => void }) {
  const [now] = useState(() => new Date());
  const due = apps.filter((a) => followUpDue(a, now)).map((a) => toFollowUp(a, now)).sort((a, b) => b.days - a.days);
  if (!due.length) return null;
  return (
    <Card title={`Follow-ups due (${due.length})`} collapsible={false}>
      <p className="-mt-2 mb-3 text-sm text-slate-400">No reply yet on these. A short follow-up after a week is normal and often gets things moving.</p>
      <ul className="divide-y divide-white/5">{due.map((f) => <FollowUpRow key={f.id} item={f} notify={notify} onChanged={onChanged} />)}</ul>
    </Card>
  );
}

function FollowUpRow({ item, notify, onChanged }: { item: FollowUp; notify: Notify; onChanged: () => void }) {
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string; to: string; contactName: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || draft) return;
    Promise.all([api<{ application: Application }>('GET', `/api/applications/${item.id}`), api<{ name?: string }>('GET', '/api/profile').catch(() => ({ name: '' }))])
      .then(([res, profile]) => setDraft(draftFollowUp(res.application, profile?.name ?? '')))
      .catch((error) => notify(describeError(error), 'error'));
  }, [open, draft, item.id, notify]);

  const save = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try { await api('PATCH', `/api/applications/${item.id}`, body); notify(message); onChanged(); } catch (error) { notify(describeError(error), 'error'); } finally { setBusy(false); }
  };
  const followedUp = () => save({ nextStep: 'Follow up again', nextStepAt: addDays(7), timelineNote: 'Followed up' }, `Marked ${item.company || 'it'} as followed up. Next reminder in 7 days.`);
  const notNeeded = () => save({ nextStep: 'No follow-up needed', nextStepAt: '' }, 'No more follow-up reminders for this one.');
  const copy = () => draft && navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`)
    .then(() => notify('Message copied.')).catch(() => notify('Couldn’t copy. Select the text and copy it instead.', 'error'));

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="truncate text-sm font-bold text-white">{item.company || 'Untitled'}{item.role && <span className="font-normal text-slate-400"> · {item.role}</span>}</p>
          <p className="text-xs text-amber-200">Applied {item.days} day{item.days === 1 ? '' : 's'} ago, no reply yet</p>
        </div>
        <Button tone="primary" onClick={() => setOpen((v) => !v)} view>{open ? 'Hide message' : 'Draft follow-up'}</Button>
        <Button disabled={busy || readOnly} onClick={followedUp}>Mark as followed up</Button>
        <Button disabled={busy || readOnly} onClick={notNeeded}>No follow-up</Button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
          {!draft ? <p className="text-xs text-slate-500">Writing a draft…</p> : (
            <>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Subject
                <input id={`fu-subject-${item.id}`} className={`${inputClass} mt-1`} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Message
                <textarea id={`fu-body-${item.id}`} className={`${inputClass} mt-1 normal-case`} rows={9} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={copy} view>Copy message</Button>
                <a href={`mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60 sm:min-h-0 sm:py-2">
                  {draft.to ? `Email ${draft.contactName.split(' ')[0] || draft.to}` : 'Open in email'}
                </a>
              </div>
              {!draft.to && <p className="text-[11px] text-slate-500">Add a recruiter or contact with an email on the application to address it to them.</p>}
            </>
          )}
        </div>
      )}
    </li>
  );
}
