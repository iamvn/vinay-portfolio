'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { BackupTab } from './backup-tab';
import { CopyTab } from './copy-tab';
import { EXPERIENCE, ListTab, PROJECTS, SKILLS } from './list-tab';
import { ProfileTab } from './profile-tab';
import { ResumeTab } from './resume-tab';
import { UsersTab, type AdminUser } from './users-tab';
import type { Notify } from './ui';

const TABS = [
  ['profile', 'Profile'],
  ['experience', 'Experience'],
  ['skills', 'Skills'],
  ['projects', 'Projects'],
  ['copy', 'Site text'],
  ['resume', 'Resume'],
  ['backup', 'Backup'],
  ['users', 'Users & security'],
] as const;

type Tab = (typeof TABS)[number][0];
type Toast = { id: number; message: string; tone: 'success' | 'error' };

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function AdminApp({ user }: { user: AdminUser }) {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash.slice(1), () => '');
  const tab: Tab = TABS.some(([id]) => id === hash) ? (hash as Tab) : 'profile';
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // The selected tab lives in the URL hash, so a refresh stays on the same tab.
  const select = (next: Tab) => {
    history.replaceState(null, '', `#${next}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.replace('/login');
  }

  const notify: Notify = useCallback((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === 'error' ? 8000 : 3000);
  }, []);

  return (
    <div className="admin-shell min-h-screen bg-[#030609] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#030609]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.3em] text-lime-300">Control room</p>
            <h1 className="text-xl font-black uppercase tracking-tight">Portfolio admin</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">Signed in as <b className="text-slate-300">{user.email}</b></span>
            <a href="/" target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-3.5 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-lime-300/60">
              View site ↗
            </a>
            <button onClick={signOut} className="rounded-lg border border-white/15 px-3.5 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-red-400/60 hover:text-red-200">
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => select(id)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-black uppercase tracking-wide transition ${tab === id ? 'bg-lime-300 text-black' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main key={reloadKey} className="mx-auto max-w-5xl px-4 py-6">
        {tab === 'profile' && <ProfileTab notify={notify} />}
        {tab === 'experience' && <ListTab config={EXPERIENCE} notify={notify} />}
        {tab === 'skills' && <ListTab config={SKILLS} notify={notify} />}
        {tab === 'projects' && <ListTab config={PROJECTS} notify={notify} />}
        {tab === 'copy' && <CopyTab notify={notify} />}
        {tab === 'resume' && <ResumeTab notify={notify} />}
        {tab === 'backup' && <BackupTab notify={notify} onReplaced={() => setReloadKey((key) => key + 1)} />}
        {tab === 'users' && <UsersTab me={user} notify={notify} />}
      </main>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl ${toast.tone === 'error' ? 'border-red-400/40 bg-red-950/90 text-red-100' : 'border-lime-300/40 bg-slate-950/95 text-lime-100'}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
