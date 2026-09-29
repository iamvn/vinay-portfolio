'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, TextArea, TextInput, type Notify } from './ui';

export type AdminUser = { id: number; email: string; name: string; role: string; createdAt?: string };

const MIN_LENGTH = 10;

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (value: string) => void; autoComplete: string }) {
  return (
    <input
      type="password"
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-lime-300/60"
    />
  );
}

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
      <div className="md:col-span-3"><Button tone="primary" type="submit" disabled={busy || !current || !next}>{busy ? 'Saving…' : 'Change password'}</Button></div>
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
          <TextArea value={token.token} onChange={() => {}} rows={3} mono />
          <p className="text-[11px] text-slate-500">Expires {new Date(token.expiresAt).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}

function AddAdmin({ onAdded, notify }: { onAdded: (user: AdminUser) => void; notify: Notify }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const user = await api<AdminUser>('POST', '/api/users', { email, name, password });
      onAdded(user);
      setEmail(''); setName(''); setPassword('');
      notify(`Added ${user.email}. Share the password with them privately; they can change it after logging in.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-t border-white/5 pt-5 md:grid-cols-3">
      <Field label="Email"><TextInput value={email} onChange={setEmail} placeholder="name@example.com" /></Field>
      <Field label="Name (optional)"><TextInput value={name} onChange={setName} /></Field>
      <Field label="Temporary password" hint={`At least ${MIN_LENGTH} characters`}><TextInput value={password} onChange={setPassword} /></Field>
      <div className="flex flex-wrap gap-2 md:col-span-3">
        <Button onClick={() => setPassword(generatePassword())}>Generate password</Button>
        <Button tone="primary" type="submit" disabled={busy || !email || !password}>{busy ? 'Adding…' : 'Add admin'}</Button>
      </div>
    </form>
  );
}

export function UsersTab({ me, notify }: { me: AdminUser; notify: Notify }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  useEffect(() => {
    api<AdminUser[]>('GET', '/api/users').then(setUsers).catch((error) => notify(describeError(error), 'error'));
  }, [notify]);

  async function remove(user: AdminUser) {
    try {
      await api('DELETE', `/api/users/${user.id}`);
      setUsers((current) => (current ?? []).filter((item) => item.id !== user.id));
      notify(`Removed ${user.email}. They are signed out everywhere.`);
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  return (
    <div className="space-y-5">
      <Card title={`My account · ${me.email}`}>
        <ChangePassword notify={notify} />
      </Card>

      <Card title="Admins">
        {!users ? <Loading /> : (
          <ul className="mb-5 divide-y divide-white/5">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-bold text-white">{user.email}{user.id === me.id && <span className="ml-2 rounded-full bg-lime-300/10 px-2 py-0.5 text-[10px] text-lime-200">you</span>}</p>
                  <p className="text-xs text-slate-500">{user.name || '—'} · {user.role}{user.createdAt ? ` · added ${new Date(user.createdAt).toLocaleDateString()}` : ''}</p>
                </div>
                {user.id !== me.id && <ConfirmButton onConfirm={() => remove(user)}>Remove</ConfirmButton>}
              </li>
            ))}
          </ul>
        )}
        <AddAdmin notify={notify} onAdded={(user) => setUsers((current) => [...(current ?? []), user])} />
      </Card>

      <Card title="API token">
        <ApiToken notify={notify} />
      </Card>
    </div>
  );
}
