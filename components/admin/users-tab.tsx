'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, PasswordInput, TextInput, inputClass, type Notify } from './ui';

import { EDITOR_DEFAULT_TABS, TAB_IDS, TAB_LABELS, type TabId } from '@/lib/auth/permissions';

export type AdminUser = { id: number; email: string; name: string; role: string; createdAt?: string; owner?: boolean; permissions?: TabId[] | null; tabs?: TabId[] };

/** Checkboxes for the admin tabs a non-admin may use. */
function AccessPicker({ value, onChange, disabled }: { value: TabId[]; onChange: (tabs: TabId[]) => void; disabled?: boolean }) {
  const toggle = (tab: TabId) => onChange(value.includes(tab) ? value.filter((item) => item !== tab) : [...value, tab]);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
      {TAB_IDS.map((tab) => (
        <label key={tab} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-200 sm:min-h-8">
          <input type="checkbox" className="size-5 accent-lime-300 sm:size-4" checked={value.includes(tab)} onChange={() => toggle(tab)} disabled={disabled} />
          {TAB_LABELS[tab]}
        </label>
      ))}
    </div>
  );
}

const MIN_LENGTH = 10;

/** A random 16-character password (for handing to a new admin, who can change it later). */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function ChangePassword({ notify }: { notify: Notify }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < MIN_LENGTH) return notify(`The new password must be at least ${MIN_LENGTH} characters.`, 'error');
    if (next !== repeat) return notify('The new passwords do not match.', 'error');
    setBusy(true);
    try {
      await api('POST', '/api/auth/password', { currentPassword: current, newPassword: next });
      setCurrent(''); setNext(''); setRepeat('');
      notify('Password changed. You stay signed in here; other sessions and API tokens were signed out.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
      <Field label="Current password"><PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" /></Field>
      <Field label="New password" hint={`At least ${MIN_LENGTH} characters`}><PasswordInput value={next} onChange={setNext} autoComplete="new-password" /></Field>
      <Field label="Repeat new password"><PasswordInput value={repeat} onChange={setRepeat} autoComplete="new-password" /></Field>
      <div className="md:col-span-3"><Button tone="primary" type="submit" disabled={busy || !current || !next} className="w-full sm:w-auto">{busy ? 'Saving…' : 'Change password'}</Button></div>
    </form>
  );
}

function ApiToken({ notify }: { notify: Notify }) {
  const [token, setToken] = useState<{ token: string; expiresAt: string } | null>(null);

  async function generate() {
    try {
      setToken(await api('POST', '/api/auth/token'));
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  async function copy() {
    if (!token) return;
    await navigator.clipboard.writeText(token.token).then(() => notify('Token copied.'), () => notify('Could not copy — select it and copy manually.', 'error'));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-6 text-slate-400">
        For curl or scripts. Send it as <code className="text-cyan-200">Authorization: Bearer &lt;token&gt;</code>. It works for 7 days, or until you change your password. Treat it like a password.
      </p>
      <div className="flex gap-2">
        <Button onClick={generate}>{token ? 'Generate another' : 'Generate API token'}</Button>
        {token && <Button onClick={copy}>Copy</Button>}
      </div>
      {token && (
        <>
          <PasswordInput value={token.token} onChange={() => {}} autoComplete="off" />
          <p className="text-[11px] text-slate-500">Expires {new Date(token.expiresAt).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}

type Role = 'admin' | 'editor';

const ROLE_INFO: Record<Role, { label: string; help: string }> = {
  editor: { label: 'Editor', help: 'Uses only the tabs you tick below, plus their own password. Can’t add or remove users.' },
  admin: { label: 'Admin', help: 'Full access, including adding and removing users and changing roles.' },
};

function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
      {(Object.keys(ROLE_INFO) as Role[]).map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          disabled={disabled}
          onClick={() => onChange(role)}
          className={`min-h-11 rounded-lg border px-3 text-sm font-bold transition disabled:opacity-40 sm:min-h-9 sm:text-xs ${value === role ? 'border-lime-300 bg-lime-300/10 text-lime-200' : 'border-white/10 text-slate-400 hover:text-white'}`}
        >
          {value === role ? '● ' : '○ '}{ROLE_INFO[role].label}
        </button>
      ))}
    </div>
  );
}

function AddUser({ onAdded, notify }: { onAdded: () => void; notify: Notify }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [access, setAccess] = useState<TabId[]>(EDITOR_DEFAULT_TABS);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const user = await api<AdminUser>('POST', '/api/users', { email, name, password, role, ...(role === 'editor' ? { permissions: access } : {}) });
      onAdded();
      setEmail(''); setName(''); setPassword(''); setRole('editor'); setAccess(EDITOR_DEFAULT_TABS);
      notify(`Added ${user.email} as ${ROLE_INFO[user.role as Role]?.label ?? user.role}. Share the password with them privately; they can change it after logging in.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
      <Field label="Email">
        <input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </Field>
      <Field label="Name (optional)"><TextInput value={name} onChange={setName} /></Field>
      <Field label="Temporary password" hint={`At least ${MIN_LENGTH} characters · use Show to read it out`}><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" /></Field>
      <div className="md:col-span-3">
        <Field group label="Role" hint={ROLE_INFO[role].help}>
          <RolePicker value={role} onChange={setRole} />
        </Field>
      </div>
      {role === 'editor' && (
        <div className="md:col-span-3">
          <Field group label="Tabs this user can use" hint="“My account” (their password) is always available. Admins always see every tab.">
            <AccessPicker value={access} onChange={setAccess} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:col-span-3">
        <Button onClick={() => setPassword(generatePassword())}>Generate password</Button>
        <Button tone="primary" type="submit" disabled={busy || !email || !password}>{busy ? 'Adding…' : 'Add user'}</Button>
      </div>
    </form>
  );
}

function UserRow({ user, onChanged, notify }: { user: AdminUser; onChanged: () => void; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const role = (user.role === 'admin' ? 'admin' : 'editor') as Role;

  async function changeRole(next: Role) {
    if (next === role) return;
    setBusy(true);
    try {
      await api('PATCH', `/api/users/${user.id}`, { role: next });
      notify(`${user.email} is now ${ROLE_INFO[next].label === 'Admin' ? 'an Admin' : 'an Editor'}.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function saveAccess(tabs: TabId[] | null) {
    setBusy(true);
    try {
      await api('PATCH', `/api/users/${user.id}`, { permissions: tabs });
      notify(tabs === null ? `${user.email}: access reset to the default tabs.` : `${user.email} can now use: ${tabs.length ? tabs.map((tab) => TAB_LABELS[tab]).join(', ') : 'only My account'}.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api('DELETE', `/api/users/${user.id}`);
      notify(`Removed ${user.email}. They are signed out everywhere.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">
          {user.email}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${role === 'admin' ? 'bg-lime-300/10 text-lime-200' : 'bg-white/[.06] text-slate-300'}`}>{user.owner ? 'Owner' : ROLE_INFO[role].label}</span>
        </p>
        <p className="text-xs text-slate-500">
          {user.name || 'No name'}{user.createdAt ? ` · added ${new Date(user.createdAt).toLocaleDateString()}` : ''}
        </p>
      </div>
      {user.owner ? (
        <p className="text-xs text-slate-500 sm:col-span-2 sm:text-right">Owner · can’t be changed or removed</p>
      ) : (
        <>
          <div className="sm:w-52"><RolePicker value={role} onChange={changeRole} disabled={busy} /></div>
          <ConfirmButton onConfirm={remove} disabled={busy} confirmLabel="Tap again to remove">Remove</ConfirmButton>
        </>
      )}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Access</p>
          {role === 'editor' && user.permissions && (
            <button type="button" onClick={() => saveAccess(null)} disabled={busy} className="min-h-9 text-xs font-bold text-cyan-300 hover:text-white disabled:opacity-40">Reset to default</button>
          )}
        </div>
        {role === 'admin'
          ? <p className="text-xs text-slate-500">Admins can use every tab.</p>
          : <AccessPicker value={user.tabs ?? EDITOR_DEFAULT_TABS} onChange={(tabs) => saveAccess(tabs)} disabled={busy} />}
      </div>
    </li>
  );
}

export function UsersTab({ me, notify }: { me: AdminUser; notify: Notify }) {
  const admin = me.role === 'admin';
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  const load = useCallback(() => {
    if (!admin) return; // editors can't list users (the server would refuse anyway)
    api<AdminUser[]>('GET', '/api/users').then(setUsers).catch((error) => notify(describeError(error), 'error'));
  }, [admin, notify]);

  useEffect(load, [load]);

  // Your own account is managed under "My account" and can never be removed, so it isn't listed here.
  const others = users?.filter((user) => user.id !== me.id);

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title={`My account · ${me.email}`}>
        <p className="mb-4 text-xs text-slate-500">
          Signed in as <b className="text-slate-300">{me.owner ? 'Owner (admin)' : ROLE_INFO[admin ? 'admin' : 'editor'].label}</b>.{' '}
          {me.owner
            ? 'Nobody can remove this account or change its role.'
            : admin
              ? 'You can manage users, but not the owner account or your own role.'
              : `You can use: ${(me.tabs ?? []).map((tab) => TAB_LABELS[tab]).join(', ') || 'only this page'}. An admin chooses which tabs you can use. Only admins can manage users or create API tokens.`}
        </p>
        <ChangePassword notify={notify} />
      </Card>

      {admin && (
        <>
          <Card title={others ? `Other users (${others.length})` : 'Other users'}>
            {!others ? <Loading /> : others.length === 0 ? (
              <p className="text-sm text-slate-400">No other users yet. Add one below.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {others.map((user) => <UserRow key={user.id} user={user} onChanged={load} notify={notify} />)}
              </ul>
            )}
          </Card>

          <Card title="Add user">
            <AddUser notify={notify} onAdded={load} />
          </Card>
        </>
      )}

      {admin && (
        <Card title="API token">
          <ApiToken notify={notify} />
        </Card>
      )}
    </div>
  );
}
