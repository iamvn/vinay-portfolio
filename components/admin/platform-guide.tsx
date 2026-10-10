'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, TextArea, inputClass, type Notify } from './ui';
import { TAB_LABELS, type TabId } from '@/lib/auth/permissions';
import { ANNOUNCEMENT_KINDS, ANNOUNCEMENT_LABELS, DEFAULT_GUIDE, GUIDE_TABS, isLive, type Announcement, type Guide, type GuideTab } from '@/lib/guide/content';

/** Platform owner (Sites tab): the Guide's text for every site, and announcements to every site's admins. */

const tabName = (tab: GuideTab) => (tab === 'users' ? 'Users & security' : tab === 'support' ? 'Support' : tab === 'sites' ? 'Sites' : tab === 'activity' ? 'Activity logs' : TAB_LABELS[tab as TabId]);

export function GuideEditor({ notify }: { notify: Notify }) {
  const [guide, setGuide] = useState<(Guide & { changed: GuideTab[] }) | null>(null);
  const [tab, setTab] = useState<GuideTab>('applications');
  const [summary, setSummary] = useState('');
  const [features, setFeatures] = useState('');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);

  const show = useCallback((data: Guide & { changed: GuideTab[] }, which: GuideTab) => {
    setGuide(data);
    setSummary(data.tabs[which].summary);
    setFeatures(data.tabs[which].features.join('\n'));
    setIntro(data.intro);
  }, []);
  useEffect(() => {
    api<Guide & { changed: GuideTab[] }>('GET', '/api/platform/guide', undefined, { fresh: true }).then((data) => show(data, 'applications')).catch((error) => notify(describeError(error), 'error'));
  }, [notify, show]);

  if (!guide) return <Card title="Admin guide"><Loading /></Card>;
  const pick = (next: GuideTab) => { setTab(next); setSummary(guide.tabs[next].summary); setFeatures(guide.tabs[next].features.join('\n')); };
  const lines = features.split('\n').map((l) => l.trim()).filter(Boolean);
  const dirty = summary.trim() !== guide.tabs[tab].summary || lines.join('\n') !== guide.tabs[tab].features.join('\n') || intro.trim() !== guide.intro;

  async function save(reset = false) {
    setBusy(true);
    try {
      const data = await api<Guide & { changed: GuideTab[] }>('PUT', '/api/platform/guide', {
        intro: intro.trim(), tabs: { [tab]: reset ? null : { summary: summary.trim(), features: lines.slice(0, 12) } },
      });
      show(data, tab);
      notify(reset ? `${tabName(tab)} is back to the default text.` : `Guide saved. Every site’s admin shows it now.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Admin guide (every site)">
      <p className="mb-4 text-sm leading-6 text-slate-300">
        The <b className="text-white">Guide</b> button in every site’s admin explains each tab: a short summary and its features. Change the wording here
        when you add something; it updates for everyone at once. Each person only sees the tabs they can use.
      </p>
      <div className="grid gap-3">
        <Field label="Greeting" hint="Shown when someone opens the Guide.">
          <input className={inputClass} value={intro} maxLength={300} onChange={(e) => setIntro(e.target.value)} />
        </Field>
        <Field label="Tab">
          <select className={`${inputClass} sm:w-72`} value={tab} onChange={(e) => pick(e.target.value as GuideTab)}>
            {GUIDE_TABS.map((t) => <option key={t} value={t}>{tabName(t)}{guide.changed.includes(t) ? ' (edited)' : ''}</option>)}
          </select>
        </Field>
        <Field label="What it’s for" hint="One or two sentences.">
          <TextArea value={summary} onChange={setSummary} rows={2} />
        </Field>
        <Field label="Features" hint="One per line, up to 12.">
          <TextArea value={features} onChange={setFeatures} rows={6} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" disabled={busy || !dirty || !summary.trim()} onClick={() => save()}>{busy ? 'Saving…' : 'Save guide'}</Button>
          {guide.changed.includes(tab) && <ConfirmButton onConfirm={() => save(true)} confirmLabel="Use the default text?">Reset to default</ConfirmButton>}
          {!guide.changed.includes(tab) && <span className="self-center text-xs text-slate-500">Using the default text{DEFAULT_GUIDE.tabs[tab].summary === summary.trim() ? '' : ' (your changes aren’t saved yet)'}</span>}
        </div>
      </div>
    </Card>
  );
}

const EMPTY = { kind: 'new' as Announcement['kind'], message: '', link: '', linkLabel: '', until: '' };

export function AnnouncementsEditor({ notify }: { notify: Notify }) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<Announcement[]>('GET', '/api/platform/announcements', undefined, { fresh: true }).then(setItems).catch((error) => notify(describeError(error), 'error')), [notify]);
  useEffect(() => { void load(); }, [load]);

  async function post() {
    setBusy(true);
    try {
      await api('POST', '/api/platform/announcements', { ...draft, active: true });
      setDraft(EMPTY);
      notify('Announcement sent. Every site’s admins see it at the top of their admin.');
      await load();
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function toggle(item: Announcement) {
    try { await api('PATCH', `/api/platform/announcements/${item.id}`, { active: !item.active }); await load(); } catch (error) { notify(describeError(error), 'error'); }
  }
  async function remove(item: Announcement) {
    try { await api('DELETE', `/api/platform/announcements/${item.id}`); notify('Announcement deleted.'); await load(); } catch (error) { notify(describeError(error), 'error'); }
  }

  return (
    <Card title="Announcements (every site)">
      <p className="mb-4 text-sm leading-6 text-slate-300">
        Tell every site’s admins about a new feature or a change. It shows as a bar at the top of their admin (each person can dismiss it) and under
        “What’s new” in the Guide.
      </p>
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Field label="Type">
          <select className={`${inputClass} sm:w-40`} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Announcement['kind'] })}>
            {ANNOUNCEMENT_KINDS.map((k) => <option key={k} value={k}>{ANNOUNCEMENT_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="Message" hint={`${draft.message.length}/400`}>
          <textarea className={inputClass} rows={2} maxLength={400} value={draft.message} placeholder="New: Prep notes and a Question bank in Applications. Note every question you’re asked and practise them in one place."
            onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
        </Field>
        <Field label="Link (optional)" hint="https://… or a path like /community or /admin#applications">
          <input className={inputClass} value={draft.link} placeholder="/admin#applications" onChange={(e) => setDraft({ ...draft, link: e.target.value.trim() })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Link text"><input className={inputClass} value={draft.linkLabel} maxLength={40} placeholder="Try it" onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })} /></Field>
          <Field label="Show until (optional)" hint="Empty: until you turn it off."><input className={inputClass} type="date" value={draft.until} onChange={(e) => setDraft({ ...draft, until: e.target.value })} /></Field>
        </div>
      </div>
      <div className="mt-3"><Button tone="primary" disabled={busy || draft.message.trim().length < 3} onClick={post}>{busy ? 'Sending…' : 'Send to every site'}</Button></div>

      <h4 className="mb-2 mt-6 text-[11px] font-black uppercase tracking-[.2em] text-lime-300/80">Sent</h4>
      {!items ? <Loading /> : items.length === 0 ? <p className="text-sm text-slate-500">Nothing sent yet.</p> : (
        <ul className="divide-y divide-white/5">
          {items.map((item) => {
            const live = isLive(item);
            return (
              <li key={item.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-100">
                    <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-200">{ANNOUNCEMENT_LABELS[item.kind]}</span>
                    {item.message}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    <span className={live ? 'font-bold text-lime-200' : ''}>{live ? 'Showing' : item.active ? 'Ended' : 'Turned off'}</span>
                    {' · '}sent {new Date(item.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                    {item.until && ` · until ${new Date(`${item.until}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
                    {item.link && ` · links to ${item.link}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => toggle(item)}>{item.active ? 'Turn off' : 'Turn on'}</Button>
                  <ConfirmButton onConfirm={() => remove(item)} confirmLabel="Delete?">Delete</ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
