'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, inputClass, type Notify } from './ui';
import type { AccessAsk } from './guide';
import type { Missing } from '@/lib/support/access';
import { KIND_LABELS, STATUS_LABELS, SUPPORT_KINDS, SUPPORT_STATUSES, targetLabel, type SupportKind, type SupportRequest, type SupportStatus } from '@/lib/support/types';

/**
 * Support & requests. Everyone on a site: ask the platform owner for a tab or feature, for help, or send
 * feedback, and follow the answers. The platform owner: one inbox for every site, with replies, statuses and
 * a one-click "Turn it on" for access requests.
 */

const when = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const STATUS_TONE: Record<SupportStatus, string> = {
  open: 'bg-amber-300/15 text-amber-200',
  'in-progress': 'bg-cyan-300/15 text-cyan-200',
  done: 'bg-lime-300/15 text-lime-200',
  declined: 'bg-white/10 text-slate-300',
};
const KIND_HINT: Record<SupportKind, string> = {
  access: 'A tab or feature your site doesn’t have yet.',
  help: 'Something isn’t working, or you’re stuck.',
  feedback: 'An idea, a wish, or what you think.',
  lead: 'Someone asking for a site from the Kritipath page.',
};
const Pill = ({ status }: { status: SupportStatus }) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_TONE[status]}`}>{STATUS_LABELS[status]}</span>;

export function SupportTab({ notify, owner, prefill, onPrefillUsed }: {
  notify: Notify; owner: boolean; prefill: AccessAsk | null; onPrefillUsed: () => void;
}) {
  return owner ? <Inbox notify={notify} /> : <MyRequests notify={notify} prefill={prefill} onPrefillUsed={onPrefillUsed} />;
}

// ---------------------------------------------------------------- people on a site

function MyRequests({ notify, prefill, onPrefillUsed }: { notify: Notify; prefill: AccessAsk | null; onPrefillUsed: () => void }) {
  const [data, setData] = useState<{ requests: SupportRequest[]; missing: Missing } | null>(null);
  const [kind, setKind] = useState<SupportKind>(prefill ? 'access' : 'help');
  const [target, setTarget] = useState(prefill?.target ?? '');
  const [subject, setSubject] = useState(prefill ? `Access to ${prefill.label}` : '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<{ requests: SupportRequest[]; missing: Missing }>('GET', '/api/support', undefined, { fresh: true }).then(setData).catch((error) => notify(describeError(error), 'error')), [notify]);
  useEffect(() => { void load(); }, [load]);
  // The Guide's "Request access" fills the form in once (the form is re-created for each new ask).
  const used = useRef(onPrefillUsed);
  useEffect(() => { if (prefill) used.current(); }, [prefill]);

  if (!data) return <Loading />;
  const options = [
    ...data.missing.features.filter((f) => f.reason === 'site').map((f) => ({ value: `feature:${f.id}`, label: `✨ ${f.label} (feature)` })),
    ...data.missing.tabs.filter((t) => t.reason === 'site').map((t) => ({ value: `tab:${t.id}`, label: `${t.label} tab` })),
  ];
  const userLevel = data.missing.tabs.filter((t) => t.reason === 'user');
  const pickTarget = (value: string) => {
    setTarget(value);
    const label = targetLabel(value);
    if (label && (!subject.trim() || subject.startsWith('Access to '))) setSubject(`Access to ${label}`);
  };

  async function send() {
    setBusy(true);
    try {
      await api('POST', '/api/support', { kind, target: kind === 'access' ? target : '', subject: subject.trim(), message: message.trim() });
      notify('Sent. You’ll see the answer here.');
      setSubject(''); setMessage(''); setTarget('');
      await load();
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title="Ask the platform owner">
        <p className="mb-4 text-sm leading-6 text-slate-300">Request a tab or feature, get help, or share feedback. The platform owner sees it in their inbox and replies here.</p>
        <div className="grid gap-3">
          <div role="radiogroup" aria-label="What is it about?" className="grid gap-2 sm:grid-cols-3">
            {SUPPORT_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`rounded-xl border p-3 text-left transition ${kind === k ? 'border-lime-300/70 bg-lime-300/10' : 'border-white/10 bg-black/20 hover:border-white/25'}`}>
                <span className="block text-sm font-black text-white">{KIND_LABELS[k]}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{KIND_HINT[k]}</span>
              </button>
            ))}
          </div>
          {kind === 'access' && (
            options.length ? (
              <Field label="What do you need?">
                <select className={inputClass} value={target} onChange={(e) => pickTarget(e.target.value)}>
                  <option value="">Choose a tab or feature…</option>
                  {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">Your site already has every tab and feature.</p>
            )
          )}
          {kind === 'access' && userLevel.length > 0 && (
            <p className="text-xs text-slate-400">
              {userLevel.map((t) => t.label).join(', ')}: your site has {userLevel.length === 1 ? 'it' : 'them'}, so your site admin can give you access in Users &amp; security.
            </p>
          )}
          <Field label="Subject"><input className={inputClass} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder={kind === 'feedback' ? 'e.g. Idea: a dark mode for the admin' : kind === 'help' ? 'e.g. My custom domain doesn’t open' : 'e.g. Access to Insights'} /></Field>
          <Field label="Details (optional)" hint={`${message.length}/3000`}>
            <textarea className={inputClass} rows={4} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder={kind === 'access' ? 'What would you use it for?' : kind === 'help' ? 'What happened, and what did you expect?' : 'Tell us more…'} />
          </Field>
          <div><Button tone="primary" onClick={send} disabled={busy || subject.trim().length < 3 || (kind === 'access' && !target)}>{busy ? 'Sending…' : 'Send'}</Button></div>
        </div>
      </Card>

      <Card title={`Your requests (${data.requests.length})`} id="support-mine">
        {data.requests.length === 0 ? <p className="text-sm text-slate-500">Nothing sent yet.</p> : (
          <ul className="divide-y divide-white/5">
            {data.requests.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill status={r.status} />
                  <b className="text-sm text-white">{r.subject}</b>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{KIND_LABELS[r.kind]}{r.target ? ` · ${targetLabel(r.target)}` : ''} · sent {when(r.createdAt)}</p>
                {r.message && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-300">{r.message}</p>}
                {r.reply && (
                  <div className="mt-2 rounded-lg border border-lime-300/20 bg-lime-300/[.06] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-lime-300/80">Reply · {when(r.repliedAt || r.updatedAt)}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-slate-100">{r.reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- the platform owner

type Filter = 'active' | 'all' | SupportStatus;

function Inbox({ notify }: { notify: Notify }) {
  const [filter, setFilter] = useState<Filter>('active');
  const [data, setData] = useState<{ filter: Filter; items: SupportRequest[]; count: Record<SupportStatus, number> } | null>(null);
  const load = useCallback(() => {
    const current = filter;
    return api<{ items: SupportRequest[]; count: Record<SupportStatus, number> }>('GET', `/api/platform/support?filter=${current}`, undefined, { fresh: true })
      .then((d) => setData({ filter: current, ...d })).catch((error) => notify(describeError(error), 'error'));
  }, [filter, notify]);
  useEffect(() => { void load(); }, [load]);
  const shown = data?.filter === filter ? data : null;
  const count = data?.count;
  const chips: [Filter, string, number | undefined][] = [
    ['active', 'Needs attention', count && count.open + count['in-progress']],
    ...SUPPORT_STATUSES.map((s) => [s, STATUS_LABELS[s], count?.[s]] as [Filter, string, number | undefined]),
    ['all', 'All', count && Object.values(count).reduce((a, b) => a + b, 0)],
  ];

  return (
    <Card title="Support inbox (every site)" id="support-inbox">
      <p className="mb-3 text-sm leading-6 text-slate-300">Requests, questions and feedback from every site’s people. Reply, set a status, or turn on what they asked for in one click.</p>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter requests">
        {chips.map(([value, label, n]) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}
            className={`min-h-9 rounded-full px-3 text-xs font-bold ${filter === value ? 'bg-lime-300 text-black' : 'border border-white/10 text-slate-300 hover:text-white'}`}>
            {label}{n !== undefined ? ` (${n})` : ''}
          </button>
        ))}
      </div>
      {!shown ? <Loading /> : shown.items.length === 0 ? <p className="text-sm text-slate-500">{filter === 'active' ? 'All caught up: nothing waiting for you.' : 'Nothing here.'}</p> : (
        <ul className="divide-y divide-white/5">
          {shown.items.map((r) => <InboxItem key={`${r.id}-${r.updatedAt}`} request={r} notify={notify} onChanged={load} />)}
        </ul>
      )}
    </Card>
  );
}

/** The password new customers' sites start with (the owner can change it before creating the site). */
const DEFAULT_SITE_PASSWORD = 'test@12345';
const SITE_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const slugFrom = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

type CreatedSite = { name: string; url: string; email: string; password: string };

/** The message sent to a new customer: their address, how to sign in, and the temporary password. */
function welcomeText(c: CreatedSite) {
  const first = c.name.split(' ')[0] || c.name;
  const admin = c.url ? `${c.url.replace(/\/+$/, '')}/admin` : '';
  return [
    `Hi ${first},`,
    '',
    'Your Kritipath site is ready.',
    '',
    ...(c.url ? [`Your site: ${c.url}`, `Sign in: ${admin}`] : []),
    `Email: ${c.email}`,
    `Temporary password: ${c.password}`,
    '',
    'Please sign in and change your password under My account first.',
    '',
    'Welcome aboard,',
    'Vinay · Kritipath',
  ].join('\n');
}

/** New customer (Kritipath "Request access"): create their site in one click, then share the sign-in details. */
function CreateSiteFromLead({ request: r, notify, onCreated }: { request: SupportRequest; notify: Notify; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(r.fromName);
  const [slug, setSlug] = useState(slugFrom(r.fromName) || slugFrom(r.fromEmail.split('@')[0]));
  const [email, setEmail] = useState(r.fromEmail);
  const [password, setPassword] = useState(DEFAULT_SITE_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedSite | null>(null);
  const valid = SITE_SLUG.test(slug) && name.trim().length > 0 && /.+@.+\..+/.test(email) && password.length >= 10;

  async function create() {
    setBusy(true);
    try {
      const site = await api<{ name: string; url?: string; ownerEmail: string }>('POST', '/api/platform/sites', { slug, name: name.trim(), ownerEmail: email.trim(), ownerPassword: password });
      setCreated({ name: site.name, url: site.url ?? '', email: site.ownerEmail, password });
      await api('PATCH', `/api/platform/support/${r.id}`, { status: 'done' }).catch(() => null);
      notify(`Created ${site.name}'s site.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const text = welcomeText(created);
    const copy = () => navigator.clipboard.writeText(text).then(() => notify('Sign-in details copied.')).catch(() => notify('Couldn’t copy. Select the text and copy it instead.', 'error'));
    return (
      <div className="grid gap-3 rounded-xl border border-lime-300/30 bg-lime-300/[.05] p-3">
        <p className="text-sm font-bold text-lime-100">{created.name}&apos;s site is ready. Send them their sign-in details:</p>
        <textarea readOnly className={`${inputClass} font-mono sm:text-xs`} rows={14} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Sign-in details" />
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={copy} view>Copy details</Button>
          <a href={`mailto:${created.email}?subject=${encodeURIComponent('Your Kritipath site is ready')}&body=${encodeURIComponent(text)}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60 sm:min-h-0 sm:py-2">Email {created.name.split(' ')[0] || 'them'}</a>
          <Button onClick={() => { setCreated(null); setOpen(false); onCreated(); }} view>Done</Button>
        </div>
        <p className="text-[11px] text-slate-500">&ldquo;Email&rdquo; opens your email app with this message filled in. Everyone gets the same starting password, so ask them to change it straight away.</p>
      </div>
    );
  }
  const plainEmail = (
    <a href={`mailto:${r.fromEmail}?subject=${encodeURIComponent('Your Kritipath site')}`}
      className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60 sm:min-h-0 sm:py-2">Email {r.fromName.split(' ')[0] || 'them'}</a>
  );
  if (!open) return <><Button tone="primary" onClick={() => setOpen(true)}>Create site</Button>{plainEmail}</>;
  return (
    <div className="grid w-full gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Address" hint={SITE_SLUG.test(slug) ? undefined : '3–40 lowercase letters, numbers or hyphens'}>
          <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Their email (sign-in)"><input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" spellCheck={false} /></Field>
        <Field label="Starting password" hint="They change it after signing in."><input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" spellCheck={false} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button tone="primary" disabled={busy || !valid} onClick={create}>{busy ? 'Creating site…' : 'Create site'}</Button>
        <Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

function InboxItem({ request: r, notify, onChanged }: { request: SupportRequest; notify: Notify; onChanged: () => void }) {
  const [reply, setReply] = useState(r.reply);
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      await api('PATCH', `/api/platform/support/${r.id}`, body);
      notify(message);
      onChanged();
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  const lead = r.kind === 'lead';
  const canGrant = r.kind === 'access' && r.target && r.site !== 'main' && r.status !== 'done';
  return (
    <li className="grid gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill status={r.status} />
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-200">{KIND_LABELS[r.kind]}</span>
        <b className="text-sm text-white">{r.subject}</b>
      </div>
      <p className="text-[11px] text-slate-400">
        <b className="text-slate-200">{r.fromName || r.fromEmail}</b>{r.fromName && ` ${r.fromEmail}`} · {r.siteName} ({r.site}) · {when(r.createdAt)}
        {r.target && <> · wants <b className="text-amber-200">{targetLabel(r.target)}</b></>}
      </p>
      {r.message && <p className="whitespace-pre-line text-sm text-slate-300">{r.message}</p>}
      {/* New customers have no account yet: create their site here (Create site), or answer them by email. */}
      {!lead && <textarea className={inputClass} rows={2} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} aria-label={`Reply to ${r.subject}`} placeholder="Reply (they see it in their Support tab)" />}
      <div className="flex flex-wrap items-center gap-2">
        {lead && r.status !== 'done' && <CreateSiteFromLead request={r} notify={notify} onCreated={onChanged} />}
        {lead && r.status === 'done' && <a href={`mailto:${r.fromEmail}?subject=${encodeURIComponent('Your Kritipath site')}`} className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60 sm:min-h-0 sm:py-2">Email {r.fromName.split(' ')[0] || 'them'}</a>}
        {canGrant && <Button tone="primary" disabled={busy} onClick={() => patch({ grant: true, ...(reply.trim() !== r.reply ? { reply: reply.trim() } : {}) }, `Turned on ${targetLabel(r.target)} for ${r.siteName}.`)}>Turn it on for {r.siteName}</Button>}
        {!lead && <Button disabled={busy || reply.trim() === r.reply} onClick={() => patch({ reply: reply.trim(), ...(r.status === 'open' ? { status: 'in-progress' } : {}) }, 'Reply saved.')}>Send reply</Button>}
        <select aria-label="Status" className={`${inputClass} w-auto! min-w-36`} value={r.status} disabled={busy} onChange={(e) => patch({ status: e.target.value }, `Marked ${STATUS_LABELS[e.target.value as SupportStatus].toLowerCase()}.`)}>
          {SUPPORT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <ConfirmButton onConfirm={() => api('DELETE', `/api/platform/support/${r.id}`).then(() => { notify('Request deleted.'); onChanged(); }).catch((error) => notify(describeError(error), 'error'))} disabled={busy} confirmLabel="Delete? Tap again">Delete</ConfirmButton>
      </div>
    </li>
  );
}
