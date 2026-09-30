'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
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

  // Keep the selected tab visible in the swipeable tab bar on phones.
  useEffect(() => {
    document.querySelector(`[data-tab="${tab}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [tab]);

  const dismiss = (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id));
  const headerButton = 'inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 text-xs font-black uppercase tracking-wide text-slate-200 sm:min-h-0 sm:px-3.5 sm:py-2';

  return (
    <div className="admin-shell min-h-screen bg-[#030609] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#030609]/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:py-4">
          <div className="min-w-0">
            <p className="hidden font-mono text-[10px] uppercase tracking-[.3em] text-lime-300 sm:block">Control room</p>
            <h1 className="truncate text-lg font-black uppercase tracking-tight sm:text-xl">
              <span className="sm:hidden">Admin</span><span className="hidden sm:inline">Portfolio admin</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-slate-500 md:inline">Signed in as <b className="text-slate-300">{user.email}</b> · {user.owner ? 'Owner' : user.role === 'admin' ? 'Admin' : 'Editor'}</span>
            <a href="/" target="_blank" rel="noreferrer" className={`${headerButton} hover:border-lime-300/60`}>
              <span className="sm:hidden">Site ↗</span><span className="hidden sm:inline">View site ↗</span>
            </a>
            <button onClick={signOut} className={`${headerButton} hover:border-red-400/60 hover:text-red-200`}>
              Sign out
            </button>
          </div>
        </div>
        <nav
          aria-label="Admin sections"
          className="mx-auto flex max-w-5xl snap-x gap-1 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] sm:pb-3 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              data-tab={id}
              onClick={() => select(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-lg px-4 text-xs font-black uppercase tracking-wide transition sm:min-h-0 sm:px-3.5 sm:py-2 ${tab === id ? 'bg-lime-300 text-black' : 'bg-white/[.04] text-slate-300 hover:bg-white/5 hover:text-white sm:bg-transparent sm:text-slate-400'}`}
            >
              {id === 'users' && user.role !== 'admin' ? 'My account' : label}
            </button>
          ))}
        </nav>
      </header>

      <main key={reloadKey} className="mx-auto max-w-5xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:py-6">
        {tab === 'profile' && <ProfileTab notify={notify} />}
        {tab === 'experience' && <ListTab config={EXPERIENCE} notify={notify} />}
        {tab === 'skills' && <ListTab config={SKILLS} notify={notify} />}
        {tab === 'projects' && <ListTab config={PROJECTS} notify={notify} />}
        {tab === 'copy' && <CopyTab notify={notify} />}
        {tab === 'resume' && <ResumeTab notify={notify} />}
        {tab === 'backup' && <BackupTab notify={notify} onReplaced={() => setReloadKey((key) => key + 1)} />}
        {tab === 'users' && <UsersTab me={user} notify={notify} />}
      </main>

      {/* Messages: top of the screen on phones (clear of the bottom save bars), bottom-right on desktop. Tap to dismiss. */}
      <div
        className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:max-w-sm"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-left text-sm shadow-2xl ${toast.tone === 'error' ? 'border-red-400/40 bg-red-950/95 text-red-100' : 'border-lime-300/40 bg-slate-950/95 text-lime-100'}`}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </div>
  );
}
