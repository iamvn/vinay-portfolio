'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        window.location.replace(next); // full load so the server sees the new cookie
        return;
      }
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Could not log in.');
    } catch {
      setError('Network error. Try again.');
    }
    setBusy(false);
  }

  // 16px text on phones stops iOS Safari from zooming in when a field is focused.
  const input = 'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-base text-slate-100 outline-none transition focus:border-lime-300/60 sm:py-2.5 sm:text-sm';
  return (
    <main className="admin-shell game-grid flex min-h-dvh items-center justify-center bg-[#030609] px-4 py-8 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/90 p-7 shadow-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[.3em] text-lime-300">Control room</p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">Admin login</h1>
        <label className="mt-6 block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Email</span>
          <input className={input} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Password</span>
          <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-950/60 px-3 py-2 text-sm text-red-100">{error}</p>}
        <button type="submit" disabled={busy} className="mt-6 min-h-12 w-full rounded-xl bg-lime-300 py-3 text-sm sm:text-xs font-black uppercase tracking-wide text-black transition hover:bg-lime-200 disabled:opacity-50">
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <Link href="/" className="mt-2 flex min-h-11 items-center justify-center text-xs text-slate-500 hover:text-slate-300">← Back to the site</Link>
      </form>
    </main>
  );
}
