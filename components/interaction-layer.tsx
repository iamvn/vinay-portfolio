'use client';

import type React from 'react';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';
import { track } from '@/lib/track-client';

// Game mode on/off is remembered in this browser. app/layout.tsx applies the saved choice
// before the page paints, so a returning visitor never sees the wrong theme flash.
const GAME_MODE_KEY = 'portfolio-game-mode';
const GAME_MODE_EVENT = 'portfolio-game-mode-change';

function readGameMode() {
  try {
    return localStorage.getItem(GAME_MODE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeGameMode(on: boolean) {
  try {
    localStorage.setItem(GAME_MODE_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable (private mode): the switch still works for this page view
  }
  document.documentElement.dataset.gameMode = on ? 'on' : 'off';
  window.dispatchEvent(new Event(GAME_MODE_EVENT));
}

function subscribeToGameMode(callback: () => void) {
  window.addEventListener(GAME_MODE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(GAME_MODE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

const nav = [
  ['home', 'HOME'],
  ['about', 'ABOUT'],
  ['skills', 'SKILLS'],
  ['experience', 'EXPERIENCE'],
  ['projects', 'PROJECTS'],
  ['engineering', 'ENGINEERING'],
  ['contact', 'CONTACT'],
] as const;

type SocialLinks = {
  github?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  email?: string | null;
};

export function InteractionLayer({
  name,
  role,
  location,
  summary,
  socialLinks,
  profileImage,
  yearsExperience,
  available,
  availability
}: {
  name: string;
  role: string;
  location: string;
  summary: string;
  socialLinks: SocialLinks;
  profileImage: string;
  yearsExperience: string;
  available: boolean;
  availability: string;
}) {
  // "Savi Bharti" → "SB": each site shows its owner's initials.
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length >= 2 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? 'P').slice(0, 2)).toUpperCase();
  const [active, setActive] = useState('home');
  const [profileOpen, setProfileOpen] = useState(false);
  const gameMode = useSyncExternalStore(subscribeToGameMode, readGameMode, () => true);
  const setGameMode = (update: (current: boolean) => boolean) => writeGameMode(update(gameMode));
  const [menuOpen, setMenuOpen] = useState(false); // phones/tablets: slide-in menu

  // "Contact" (X key, menu button) opens the visitor's email app. Without an email, go to the contact section.
  const contactHref = socialLinks?.email
    ? (socialLinks.email.startsWith('mailto:') ? socialLinks.email : `mailto:${socialLinks.email}`)
    : '#contact';

  // Count contact intents for Admin → Insights: any email or LinkedIn link, wherever it is on the page.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.('a[href]');
      const href = link?.getAttribute('href') ?? '';
      if (href.startsWith('mailto:')) track('contact_email');
      else if (/linkedin\.com/i.test(href)) track('contact_linkedin');
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  // Lock page scrolling behind the open menu.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  useEffect(() => {
    document.documentElement.dataset.gameMode = gameMode ? 'on' : 'off';
    document.documentElement.dataset.theme = gameMode
      ? 'gaming'
      : 'professional';
  }, [gameMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave browser shortcuts (⌘X, Ctrl+B…) and typing in form fields alone.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        if (contactHref.startsWith('mailto:')) { track('contact_email'); window.location.href = contactHref; }
        else document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'b') {
        setProfileOpen(false);
        setMenuOpen(false);
      }

      if (e.key.toLowerCase() === 'y' || e.key === 'Home') {
        e.preventDefault();

        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }

      if (
        e.key === 'Enter' &&
        document.activeElement instanceof HTMLAnchorElement
      ) {
        document.activeElement.click();
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const index = nav.findIndex(([id]) => id === active);

        const next =
          e.key === 'ArrowDown'
            ? Math.min(nav.length - 1, index + 1)
            : Math.max(0, index - 1);

        document
          .getElementById(nav[next][0])
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });

        setActive(nav[next][0]);
      }
    };

    window.addEventListener('keydown', onKey);

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (entry) =>
            entry.isIntersecting && setActive(entry.target.id)
        ),
      {
        rootMargin: '-35% 0px -55% 0px',
      }
    );

    nav.forEach(([id]) => {
      const el = document.getElementById(id);

      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      window.removeEventListener('keydown', onKey);
      observer.disconnect();
    };
  }, [active, contactHref]);

  const iconFor = (id: string) =>
    id === 'home'
      ? 'home'
      : id === 'about'
        ? 'user'
        : id === 'skills'
          ? 'skill'
          : id === 'contact'
            ? 'mail'
            : id === 'projects'
              ? 'game'
              : 'briefcase';

  return (
    <>
      {/* Game Mode Toggle */}
      <div className="fixed right-4 top-4 z-50 hidden items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur lg:flex">
        <span className="text-slate-400">
          Game mode{' '}
          <strong
            className={
              gameMode
                ? 'text-lime-300'
                : 'text-slate-200'
            }
          >
            {gameMode ? 'ON' : 'OFF'}
          </strong>
        </span>

        <button
          aria-label="Toggle game mode"
          aria-pressed={gameMode}
          onClick={() => setGameMode((v) => !v)}
          className={`h-5 w-9 rounded-full border p-0.5 ${gameMode
              ? 'border-lime-300 bg-lime-300/20'
              : 'border-white/20 bg-white/5'
            }`}
        >
          <span
            className={`block size-3.5 rounded-full ${gameMode
                ? 'translate-x-4 bg-lime-300'
                : 'bg-slate-400'
              }`}
          />
        </button>
      </div>

      {/* Phone/tablet menu button (the sidebar below is desktop-only) */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.375rem)] z-40 flex size-11 items-center justify-center overflow-hidden rounded-full border border-lime-300/40 bg-black/80 text-lime-200 shadow-lg backdrop-blur lg:hidden"
      >
        <Icon name="menu" size={20} />
      </button>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="mobile-menu-panel absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col overflow-y-auto border-l border-white/10 bg-[#050b11] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black italic text-lime-300">{initials}</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-full border border-white/10 text-slate-300">
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="size-16 shrink-0 overflow-hidden rounded-full border-2 border-lime-300 bg-gradient-to-br from-slate-800 to-black">
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImage} alt={`${name} profile`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-black text-white">{initials}</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black">{name}</p>
                <p className="truncate text-xs text-slate-400">{role}</p>
                <span className="mt-1 inline-flex rounded-full border border-lime-300/30 px-2 py-0.5 text-[9px] font-bold text-lime-300">
                  ● {available ? (gameMode ? 'ONLINE' : 'OPEN TO WORK') : 'BUSY'}
                </span>
              </div>
            </div>

            <nav className="mt-5 grid gap-1">
              {nav.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => { setActive(id); setMenuOpen(false); }}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-bold ${active === id ? 'border-lime-300/50 bg-lime-300/10 text-lime-200' : 'border-transparent text-slate-300 active:bg-white/5'}`}
                >
                  <Icon name={iconFor(id)} size={18} />
                  {label}
                </a>
              ))}
            </nav>

            <div className="mt-6 grid grid-cols-4 gap-3">
              {socialLinks?.github && (
                <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 text-slate-300 active:text-lime-300"><Icon name="github" size={20} /></a>
              )}
              {socialLinks?.linkedin && (
                <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 text-slate-300 active:text-lime-300"><Icon name="linkedin" size={20} /></a>
              )}
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 text-slate-300 active:text-lime-300"><Icon name="instagram" size={20} /></a>
              )}
              {socialLinks?.email && (
                <a href={socialLinks.email.startsWith('mailto:') ? socialLinks.email : `mailto:${socialLinks.email}`} aria-label="Email" className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 text-slate-300 active:text-lime-300"><Icon name="gmail" size={20} /></a>
              )}
            </div>

            <div className="mt-5 grid gap-3">
              <a href="/api/resume" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-purple-400/50 bg-purple-400/5 text-xs font-black text-purple-200">
                <Icon name="download" size={16} /> DOWNLOAD RESUME
              </a>
              <a href={contactHref} onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center justify-center rounded-xl bg-lime-300 text-xs font-black text-black">
                CONTACT ME
              </a>
            </div>

            {/* pushes the game-mode switch to the bottom, with at least 1.5rem of space above it */}
            <div className="min-h-6 flex-1" aria-hidden="true" />
            <label className="flex min-h-14 items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>Game mode <strong className={gameMode ? 'text-lime-300' : 'text-slate-200'}>{gameMode ? 'ON' : 'OFF'}</strong></span>
              <button
                type="button"
                aria-label="Toggle game mode"
                aria-pressed={gameMode}
                onClick={() => setGameMode((v) => !v)}
                className={`h-7 w-12 rounded-full border p-0.5 ${gameMode ? 'border-lime-300 bg-lime-300/20' : 'border-white/20 bg-white/5'}`}
              >
                <span className={`block size-5 rounded-full transition ${gameMode ? 'translate-x-5 bg-lime-300' : 'bg-slate-400'}`} />
              </button>
            </label>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-white/10 bg-[#050b11]/95 p-5 backdrop-blur lg:block">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-black italic text-lime-300">
            {initials}
          </div>

          <span className="rounded-full border border-lime-300/30 px-2 py-1 text-[9px] font-bold text-lime-300">
            ● {gameMode ? 'PLAYER 1' : 'AVAILABLE'}
          </span>
        </div>

        {/* Profile */}
        <div className="mt-8 text-center">
          <div className="mx-auto size-28 overflow-hidden rounded-full border-2 border-lime-300 bg-gradient-to-br from-slate-800 to-black shadow-lg shadow-lime-300/10">
            {profileImage ? (
              <img
                src={profileImage}
                alt={`${name} profile`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white">
                {initials}
              </div>
            )}
          </div>

          <h2 className="mt-4 text-xl font-black">
            {name}
          </h2>

          <p className="text-xs text-slate-400">
            {role}
          </p>

          <span className="mt-3 inline-flex rounded-full border border-lime-300/30 px-2 py-1 text-[9px] font-bold text-lime-300">
            ● {gameMode ? 'ONLINE' : 'OPEN TO WORK'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="mt-8 space-y-1">
          {nav.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setActive(id)}
              className={`sidebar-nav-link flex items-center gap-3 rounded-lg border px-3 py-3 text-xs font-bold ${active === id
                  ? 'border-lime-300/50 bg-lime-300/10 text-lime-200'
                  : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              <Icon
                name={iconFor(id)}
                size={17}
              />
              {label}
            </a>
          ))}
        </nav>

        {/* Social Links */}
        <div className="absolute bottom-5 left-5 right-5">
          <div className="grid grid-cols-4 gap-2">

            {/* GitHub */}
            {socialLinks?.github && (
              <a
                href={socialLinks.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="group flex items-center justify-center rounded-lg border border-white/10 p-3 text-slate-300 transition hover:border-lime-300/40 hover:bg-lime-300/5 hover:text-lime-300"
              >
                <Icon
                  name="github"
                  size={17}
                />
              </a>
            )}

            {/* LinkedIn */}
            {socialLinks?.linkedin && (
              <a
                href={socialLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn"
                className="group flex items-center justify-center rounded-lg border border-white/10 p-3 text-slate-300 transition hover:border-lime-300/40 hover:bg-lime-300/5 hover:text-lime-300"
              >
                <Icon
                  name="linkedin"
                  size={17}
                />
              </a>
            )}

            {/* Instagram */}
            {socialLinks?.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                title="Instagram"
                className="group flex items-center justify-center rounded-lg border border-white/10 p-3 text-slate-300 transition hover:border-lime-300/40 hover:bg-lime-300/5 hover:text-lime-300"
              >
                <Icon
                  name="instagram"
                  size={17}
                />
              </a>
            )}

            {/* Gmail */}
            {socialLinks?.email && (
              <a
                href={
                  socialLinks.email.startsWith('mailto:')
                    ? socialLinks.email
                    : `mailto:${socialLinks.email}`
                }
                aria-label="Email"
                title="Email"
                className="group flex items-center justify-center rounded-lg border border-white/10 p-3 text-slate-300 transition hover:border-lime-300/40 hover:bg-lime-300/5 hover:text-lime-300"
              >
                <Icon
                  name="gmail"
                  size={17}
                />
              </a>
            )}
          </div>

          {/* Resume */}
          <a
            href="/api/resume"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-purple-400/50 bg-purple-400/5 py-3 text-xs font-black text-purple-200 transition hover:bg-purple-400/10"
          >
            <Icon
              name="download"
              size={16}
            />
            DOWNLOAD RESUME
          </a>
        </div>
      </aside>

      {/* Game Controller HUD */}
      {gameMode && (
        <div className="controller-hud fixed bottom-3 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-black/80 px-5 py-2 text-[10px] font-bold backdrop-blur md:flex">
          <span className="inline-flex items-center gap-2 text-slate-200">
            <FaceButton
              label="A"
              tone="a"
            />
            SELECT
          </span>

          <span className="inline-flex items-center gap-2 text-slate-200">
            <FaceButton
              label="B"
              tone="b"
            />
            BACK
          </span>

          <span className="inline-flex items-center gap-2 text-slate-200">
            <FaceButton
              label="X"
              tone="x"
            />
            CONTACT
          </span>

          <span className="inline-flex items-center gap-2 text-slate-200">
            <FaceButton
              label="Y"
              tone="y"
            />
            TOP
          </span>
        </div>
      )}

      {/* Profile Modal */}
      {profileOpen && (
        <Modal
          title="PLAYER PROFILE"
          onClose={() => setProfileOpen(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Info
              label="ROLE"
              value={role}
            />

            <Info
              label="EXPERIENCE"
              value={`${yearsExperience} years`}
            />

            <Info
              label="LOCATION"
              value={location}
            />

            <Info
              label="STATUS"
              value={available ? availability : 'Not available right now'}
            />
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-300">
            {summary}
          </p>
        </Modal>
      )}

      <button
        className="sr-only"
        onClick={() => setProfileOpen(true)}
        aria-label="Open profile"
      >
        About
      </button>
    </>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
      <div className="text-[9px] font-bold tracking-wider text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-white">
        {value}
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#071018] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lime-300">
            {title}
          </h2>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-lg border border-white/10 text-lg sm:size-auto sm:px-3 sm:py-1 sm:text-base"
          >
            ×
          </button>
        </div>

        <div className="mt-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function FaceButton({
  label,
  tone,
}: {
  label: string;
  tone: 'a' | 'b' | 'x' | 'y';
}) {
  return (
    <span
      aria-hidden="true"
      className={`xbox-face-button xbox-face-button--${tone} xbox-face-button--compact`}
    >
      {label}
    </span>
  );
}