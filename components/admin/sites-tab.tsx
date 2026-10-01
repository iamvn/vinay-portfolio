'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, describeError } from './api';
import { Button, Card, Field, Loading, PasswordInput, TextInput, buttonBase, inputClass, type Notify } from './ui';

type SiteRow = {
  slug: string; name: string; ownerEmail: string; domain: string | null; status: 'active' | 'suspended'; createdAt: string; url: string | null; storage: string;
  canAddUsers: boolean; canAddSites: boolean; createdBy: string; createdByUser: string;
};
type Platform = { isMain: boolean; rootDomain: string | null; turso: boolean; onVercel: boolean; vercelApi: boolean; exampleUrl: string | null };
type Activity = { id: number; at: string; site: string; siteName: string; actor: string; kind: 'user.added' | 'site.created' | 'site.deleted'; details: Record<string, string> };

const slugify = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => alphabet[byte % alphabet.length]).join('');
}

function Setup({ platform }: { platform: Platform }) {
  const items: { ok: boolean; text: ReactNode }[] = [
    {
      ok: Boolean(platform.rootDomain),
      text: platform.rootDomain
        ? <>Sites live at <b>&lt;address&gt;.{platform.rootDomain}</b>.</>
        : platform.vercelApi
          ? <>No domain of your own: each new site gets a free <b>&lt;address&gt;.vercel.app</b>, added to your Vercel project automatically.</>
          : <>No <code>ROOT_DOMAIN</code> set. Free option: give each site a <b>&lt;address&gt;.vercel.app</b> custom domain (add it in Vercel → Domains, or set VERCEL_API_TOKEN + VERCEL_PROJECT to do it automatically).{platform.onVercel ? '' : <> Locally, sites open at <b>&lt;address&gt;.localhost:3000</b>.</>}</>,
    },
    {
      ok: platform.turso || !platform.onVercel,
      text: platform.turso
        ? 'Each new site gets its own Turso database.'
        : platform.onVercel
          ? <>Set <code>TURSO_API_TOKEN</code> and <code>TURSO_ORG</code> in Vercel so each site can get its own database.</>
          : 'Locally, each site gets its own database file in prisma/sites/.',
    },
  ];
  return (
    <ul className="space-y-1.5 text-xs leading-5">
      {items.map((item, i) => (
        <li key={i} className={`flex gap-2 ${item.ok ? 'text-slate-300' : 'text-yellow-200'}`}><span aria-hidden="true">{item.ok ? '✓' : '!'}</span><span>{item.text}</span></li>
      ))}
    </ul>
  );
}

function CreateSite({ platform, onCreated, notify }: { platform: Platform; onCreated: (site: SiteRow, password: string) => void; notify: Notify }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const address = slug || 'address';
  const preview = platform.rootDomain ? `${address}.${platform.rootDomain}` : platform.exampleUrl?.replace('savi-bharti', address).replace(/^https?:\/\//, '') ?? `${address}.yourdomain.com`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const site = await api<SiteRow & { note?: string }>('POST', '/api/platform/sites', { slug, name, ownerEmail: email, ownerPassword: password });
      onCreated(site, password);
      if (site.note) notify(site.note, 'error');
      setName(''); setSlug(''); setSlugTouched(false); setEmail(''); setPassword('');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <Field label="Owner's name"><TextInput value={name} onChange={(v) => { setName(v); if (!slugTouched) setSlug(slugify(v)); }} placeholder="Savi Bharti" /></Field>
      <Field label="Site address" hint={`Opens at ${preview}`}>
        <input className={inputClass} value={slug} placeholder="savi-bharti" autoCapitalize="none" spellCheck={false}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} />
      </Field>
      <Field label="Owner's email (their login)">
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="savi@example.com" autoCapitalize="none" />
      </Field>
      <Field label="Temporary password" hint="At least 10 characters. Share it privately; they can change it after logging in.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <p className="text-xs leading-5 text-slate-400 md:col-span-2">
        The new site starts as a <b className="text-slate-200">copy of your site</b>: content, projects, experience, skills, site text and design, with the owner&apos;s name and email.
        Your photo, uploaded resume, social links, private assistant notes, users, AI keys and analytics are <b className="text-slate-200">not</b> copied.
        After that the two sites are completely separate.
      </p>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button onClick={() => setPassword(generatePassword())}>Generate password</Button>
        <Button tone="primary" type="submit" disabled={busy || !name.trim() || !slug || !email || !password}>{busy ? 'Creating site…' : 'Create site'}</Button>
      </div>
    </form>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-lime-300" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="block text-sm font-bold text-slate-100">{label}</span><span className="block text-xs leading-5 text-slate-400">{hint}</span></span>
    </label>
  );
}

/** Main site only: what this site's admins are allowed to do. Ticked boxes are saved together. */
function Security({ site, busy, save }: { site: SiteRow; busy: boolean; save: (changes: { canAddUsers: boolean; canAddSites: boolean }) => void }) {
  const [users, setUsers] = useState(site.canAddUsers);
  const [sites, setSites] = useState(site.canAddSites);
  const dirty = users !== site.canAddUsers || sites !== site.canAddSites;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.02] p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Security</p>
      <div className="space-y-1">
        <Check checked={users} onChange={setUsers} label="Site admins can add users"
          hint="Lets this site's admins give other people access in Users & security. Each user they add shows up in Activity below." />
        <Check checked={sites} onChange={setSites} label="Site admins can create sites"
          hint="Gives this site's admins a Sites tab to create sites of their own (they only see theirs). Each one shows up here and in Activity." />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button tone="primary" disabled={busy || !dirty} onClick={() => save({ canAddUsers: users, canAddSites: sites })}>{busy ? 'Saving…' : 'Save security'}</Button>
        <Button disabled={busy || !dirty} onClick={() => { setUsers(site.canAddUsers); setSites(site.canAddSites); }}>Cancel</Button>
      </div>
    </div>
  );
}

function SiteItem({ site, isMain, onChanged, notify }: { site: SiteRow; isMain: boolean; onChanged: () => void; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState(site.domain ?? '');
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function run(method: string, body: unknown, message: string) {
    setBusy(true);
    try {
      await api(method, `/api/platform/sites/${site.slug}`, body);
      notify(message);
      onChanged();
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const link = `${buttonBase} border border-white/15 text-slate-200 hover:border-cyan-300/60`;
  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-white">
            {site.name}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${site.status === 'active' ? 'bg-lime-300/10 text-lime-200' : 'bg-yellow-300/10 text-yellow-200'}`}>{site.status === 'active' ? 'Live' : 'Paused'}</span>
          </p>
          <p className="truncate text-xs text-slate-400">{site.url ? site.url.replace(/^https?:\/\//, '') : site.slug} · owner {site.ownerEmail} · {site.storage} · since {new Date(site.createdAt).toLocaleDateString()}</p>
          {isMain && site.createdBy && (
            <p className="truncate text-xs text-cyan-200">Created by {site.createdByUser || 'an admin'} from the site “{site.createdBy}”</p>
          )}
        </div>
        {site.url && (
          <div className="flex gap-2">
            <a className={link} href={site.url} target="_blank" rel="noreferrer">Site ↗</a>
            <a className={link} href={`${site.url}/admin`} target="_blank" rel="noreferrer">Their admin ↗</a>
          </div>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label="Custom domain (optional)" hint={`Free: ${site.slug}.vercel.app (if nobody has it). Own domain: e.g. ${site.slug.replace(/-/g, '')}.com with DNS pointed to Vercel.`}>
          <input className={inputClass} value={domain} placeholder={`${site.slug}.vercel.app`} onChange={(e) => setDomain(e.target.value.trim().toLowerCase())} />
        </Field>
        <Button disabled={busy || domain === (site.domain ?? '')} onClick={() => run('PATCH', { domain: domain || null }, domain ? `${site.name} now also answers at ${domain}.` : 'Custom domain removed.')}>Save domain</Button>
        <Button disabled={busy} onClick={() => run('PATCH', { status: site.status === 'active' ? 'suspended' : 'active' }, site.status === 'active' ? `${site.name} is paused.` : `${site.name} is live again.`)}>
          {site.status === 'active' ? 'Pause site' : 'Resume site'}
        </Button>
      </div>
      {isMain && (
        <Security key={`${site.canAddUsers}-${site.canAddSites}`} site={site} busy={busy}
          save={(changes) => run('PATCH', changes, `Saved security for ${site.name}.`)} />
      )}
      {!deleting ? (
        <button type="button" onClick={() => setDeleting(true)} className="text-xs font-bold text-red-300 hover:text-red-200">Delete site…</button>
      ) : (
        <div className="space-y-2 rounded-xl border border-red-400/30 bg-red-950/30 p-3">
          <p className="text-xs text-red-100">This permanently deletes <b>{site.name}</b>&apos;s site and database (content, users, resumes). Download a backup from their admin first if needed. Type <b>{site.slug}</b> to confirm.</p>
          <div className="flex flex-wrap gap-2">
            <input className={`${inputClass} max-w-60`} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={site.slug} />
            <Button tone="danger" disabled={busy || confirm !== site.slug} onClick={() => run('DELETE', { confirm }, `Deleted ${site.name}.`)}>Delete forever</Button>
            <Button onClick={() => { setDeleting(false); setConfirm(''); }}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function describeActivity(item: Activity): ReactNode {
  const d = item.details;
  if (item.kind === 'user.added') return <>added user <b>{d.name ? `${d.name} (${d.email})` : d.email}</b> as {d.role === 'admin' ? 'an admin' : 'an editor'}{d.access ? ` (${d.access})` : ''}</>;
  if (item.kind === 'site.created') return <>created the site <b>{d.name}</b> ({d.domain ?? d.slug}) for {d.ownerEmail}</>;
  return <>deleted the site <b>{d.name}</b> ({d.slug})</>;
}

function ActivityLog({ items }: { items: Activity[] }) {
  if (!items.length) return <p className="text-sm text-slate-400">Nothing yet. When another site&apos;s admin adds a user or creates a site, it appears here.</p>;
  return (
    <ul className="divide-y divide-white/5">
      {items.map((item) => (
        <li key={item.id} className="py-2.5 text-sm leading-6 text-slate-300">
          <span className="text-slate-100">{item.actor}</span> <span className="text-slate-500">(admin of <b className="text-lime-200">{item.siteName || item.site}</b>)</span> {describeActivity(item)}
          <span className="block text-xs text-slate-500">{new Date(item.at).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

/** Platform: create and manage other people's portfolio sites (main site admins, or site admins allowed to). */
export function SitesTab({ notify }: { notify: Notify }) {
  const [state, setState] = useState<{ sites: SiteRow[]; platform: Platform; activity: Activity[] } | null>(null);
  const [created, setCreated] = useState<{ site: SiteRow; password: string } | null>(null);
  const load = useCallback(() => {
    api<{ sites: SiteRow[]; platform: Platform; activity: Activity[] }>('GET', '/api/platform/sites').then(setState).catch((error) => notify(describeError(error), 'error'));
  }, [notify]);
  useEffect(load, [load]);

  if (!state) return <Loading />;
  const isMain = state.platform.isMain;
  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title="Sites">
        <p className="mb-3 text-sm leading-6 text-slate-300">
          Give other people their own portfolio, identical to yours: their own address, content, design, resume builder, users and login.
          Nothing they change affects your site, and nothing you change affects theirs. They manage it at <b>their-address/admin</b>.
          {!isMain && ' You only see the sites you created.'}
        </p>
        {isMain && <Setup platform={state.platform} />}
      </Card>

      {created && (
        <Card title="Site created">
          <div className="space-y-2 text-sm text-slate-200">
            <p><b>{created.site.name}</b>&apos;s site is ready{created.site.url ? <> at <a className="text-cyan-300 underline" href={created.site.url} target="_blank" rel="noreferrer">{created.site.url.replace(/^https?:\/\//, '')}</a></> : ''}.</p>
            <p className="text-xs text-slate-400">Send them privately: the address, <b>{created.site.url ? `${created.site.url}/admin` : '/admin'}</b> to log in, email <b>{created.site.ownerEmail}</b> and the temporary password you set. Ask them to change it under My account.</p>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </div>
        </Card>
      )}

      <Card title={`All sites (${state.sites.length})`}>
        {state.sites.length === 0 ? <p className="text-sm text-slate-400">No sites yet. Create the first one below.</p> : (
          <ul className="divide-y divide-white/5">{state.sites.map((site) => <SiteItem key={site.slug} site={site} isMain={isMain} onChanged={load} notify={notify} />)}</ul>
        )}
      </Card>

      {isMain && (
        <Card title="Activity on other sites">
          <ActivityLog items={state.activity} />
        </Card>
      )}

      <Card title="New site">
        <CreateSite platform={state.platform} notify={notify} onCreated={(site, password) => { setCreated({ site, password }); load(); notify(`Created ${site.name}'s site.`); }} />
      </Card>
    </div>
  );
}
