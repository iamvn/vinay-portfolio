'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BackupTab } from './backup-tab';
import { CopyTab } from './copy-tab';
import { EXPERIENCE, ListTab, PROJECTS, SKILLS } from './list-tab';
import { ProfileTab } from './profile-tab';
import { ResumeTab } from './resume-tab';
import { InsightsTab } from './insights-tab';
import { AiTab } from './ai-tab';
import { DesignTab } from './design-tab';
import { UsersTab, type AdminUser } from './users-tab';
import { ReadOnlyFieldset, ReadOnlyProvider, type Notify } from './ui';

const TABS = [
  ['profile', 'Profile'],
  ['experience', 'Experience'],
  ['skills', 'Skills'],
  ['projects', 'Projects'],
  ['copy', 'Site text'],
  ['design', 'Design'],
  ['resume', 'Resume'],
  ['insights', 'Insights'],
  ['ai', 'AI assistant'],
  ['backup', 'Backup'],
  ['users', 'Users & security'],
] as const;

type Tab = (typeof TABS)[number][0];
/** Tabs this user can open: admins get all; others get the tabs an admin enabled, plus "My account". */
const visibleTabs = (user: AdminUser) =>
  TABS.filter(([id]) => user.role === 'admin' || id === 'users' || (user.tabs ?? []).includes(id as never));
type Toast = { id: number; message: string; tone: 'success' | 'error' };

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export type DatabaseInfo = {
  kind: 'file' | 'turso' | 'remote'; label: string; persistent: boolean; onVercel: boolean; deploymentBranch?: boolean;
  lastDeploy?: { at: string; result: 'seeded' | 'kept' | 'partial'; projects: number; users: number; commit: string | null } | null;
  seededAt?: string | null;
};
const shortDate = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** Makes it obvious which database is being edited: a local file on this computer, or the live one. */
function DatabaseNotice({ database }: { database: DatabaseInfo }) {
  if (!database.persistent) {
    return (
      <p role="alert" className="mb-4 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
        <b>Changes here will be lost on the next deploy.</b>{' '}
        {database.deploymentBranch
          ? <>This deployment uses its own temporary database branch ({database.label}). In Vercel → Settings → Environment Variables, set <code>DATABASE_URL</code> to your permanent Turso database and <code>DATABASE_AUTH_TOKEN</code>, then redeploy.</>
          : <>This site is using a database file inside the deployment. In Vercel → Settings → Environment Variables, remove the <code>file:</code> DATABASE_URL and connect your Turso database.</>}
      </p>
    );
  }
  if (database.kind === 'file') {
    return (
      <p className="mb-4 rounded-xl border border-cyan-300/30 bg-cyan-300/[.06] px-4 py-3 text-sm text-cyan-100">
        <b>Local database</b> ({database.label}). Changes here stay on this computer and don&apos;t appear on the live site. To copy them over, use Backup → Download here, then Restore in the live site&apos;s admin.
      </p>
    );
  }
  return null;
}

export function AdminApp({ user, database }: { user: AdminUser; database?: DatabaseInfo }) {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash.slice(1), () => '');
  const tabs = visibleTabs(user);
  const can = (id: Tab) => tabs.some(([tab]) => tab === id);
  const tab: Tab = tabs.some(([id]) => id === hash) ? (hash as Tab) : tabs[0][0];
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  // Read-only users can look at every tab they have, but not change anything ("My account" stays usable).
  const viewOnly = Boolean(user.viewOnly);

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
            <span className="hidden text-xs text-slate-500 md:inline">Signed in as <b className="text-slate-300">{user.email}</b> · {user.owner ? 'Owner' : user.role === 'admin' ? 'Admin' : viewOnly ? 'Editor (read-only)' : 'Editor'}</span>
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
          {tabs.map(([id, label]) => (
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
        {database && <DatabaseNotice database={database} />}
        {viewOnly && tab !== 'users' && (
          <p className="mb-4 rounded-xl border border-yellow-300/30 bg-yellow-300/[.06] px-4 py-3 text-sm text-yellow-100">
            <b>Read-only access.</b> You can look through everything here, but you can&apos;t save changes. Ask an admin if you need to edit something.
          </p>
        )}
        <ReadOnlyProvider value={viewOnly && tab !== 'users'}>
          {tab === 'profile' && <ReadOnlyFieldset><ProfileTab notify={notify} /></ReadOnlyFieldset>}
          {tab === 'experience' && <ListTab config={EXPERIENCE} notify={notify} />}
          {tab === 'skills' && <ListTab config={SKILLS} notify={notify} />}
          {tab === 'projects' && <ListTab config={PROJECTS} notify={notify} />}
          {tab === 'copy' && <ReadOnlyFieldset><CopyTab notify={notify} /></ReadOnlyFieldset>}
          {tab === 'resume' && <ReadOnlyFieldset><ResumeTab notify={notify} /></ReadOnlyFieldset>}
          {tab === 'insights' && can('insights') && <InsightsTab notify={notify} />}
          {tab === 'ai' && can('ai') && <ReadOnlyFieldset><AiTab notify={notify} /></ReadOnlyFieldset>}
          {tab === 'design' && can('design') && <DesignTab notify={notify} />}
          {tab === 'backup' && <BackupTab notify={notify} onReplaced={() => setReloadKey((key) => key + 1)} />}
        </ReadOnlyProvider>
        {tab === 'users' && <UsersTab me={user} notify={notify} />}
        {database && database.persistent && database.kind !== 'file' && (
          <div className="mt-8 space-y-1 text-center text-[11px] text-slate-500">
            <p>Database: {database.label}{database.kind === 'turso' ? ' (Turso)' : ''} · changes are saved permanently</p>
            {database.seededAt && <p>Starter content loaded into this database on {shortDate(database.seededAt)}</p>}
            {database.lastDeploy && (
              <p className={database.lastDeploy.result === 'kept' ? '' : 'text-yellow-300'}>
                Last deploy{database.lastDeploy.commit ? ` (${database.lastDeploy.commit})` : ''}, {shortDate(database.lastDeploy.at)}:{' '}
                {database.lastDeploy.result === 'kept' ? `existing content kept (${database.lastDeploy.projects} projects, ${database.lastDeploy.users} users)`
                  : database.lastDeploy.result === 'seeded' ? 'found an EMPTY database and loaded the starter content'
                  : 'found no profile; starter content NOT loaded'}
              </p>
            )}
          </div>
        )}
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
