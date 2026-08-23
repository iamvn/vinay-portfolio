'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import { Icon } from './icons';

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
  github?: string;
  linkedin?: string;
  instagram?: string;
  email?: string;
};

export function InteractionLayer({
  name,
  role,
  location,
  summary,
  socialLinks,
  profileImage
}: {
  name: string;
  role: string;
  location: string;
  summary: string;
  socialLinks: SocialLinks;
  profileImage: string;
}) {
  const [active, setActive] = useState('home');
  const [contactOpen, setContactOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [gameMode, setGameMode] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    document.documentElement.dataset.gameMode = gameMode ? 'on' : 'off';
    document.documentElement.dataset.theme = gameMode
      ? 'gaming'
      : 'professional';
  }, [gameMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        setContactOpen(true);
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'b') {
        setContactOpen(false);
        setProfileOpen(false);
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
  }, [active]);

  async function submitContact(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setStatus('SENDING...');

    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(Object.fromEntries(form)),
    });

    setStatus(
      res.ok
        ? 'TRANSMISSION RECEIVED'
        : 'TRANSMISSION FAILED'
    );

    if (res.ok) {
      e.currentTarget.reset();
    }
  }

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
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
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

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-white/10 bg-[#050b11]/95 p-5 backdrop-blur lg:block">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-black italic text-lime-300">
            VB
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
                VB
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
            href="/resume.pdf"
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
              value="6+ years"
            />

            <Info
              label="LOCATION"
              value={location}
            />

            <Info
              label="STATUS"
              value="Available for opportunities"
            />
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-300">
            {summary}
          </p>
        </Modal>
      )}

      {/* Contact Modal */}
      {contactOpen && (
        <Modal
          title="MISSION: CONTACT"
          onClose={() => setContactOpen(false)}
        >
          <form
            onSubmit={submitContact}
            className="space-y-4"
          >
            <input
              name="name"
              required
              placeholder="NAME"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-lime-300"
            />

            <input
              name="email"
              type="email"
              required
              placeholder="EMAIL"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-lime-300"
            />

            <textarea
              name="message"
              required
              placeholder="MESSAGE"
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-lime-300"
            />

            <button className="w-full rounded-xl bg-lime-300 px-5 py-3 text-xs font-black text-black transition hover:bg-lime-200">
              SEND TRANSMISSION
            </button>

            {status && (
              <p className="text-center text-xs font-bold text-lime-300">
                {status}
              </p>
            )}

            <p className="text-center text-[10px] text-slate-600">
              Esc / B = back
            </p>
          </form>
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#071018] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lime-300">
            {title}
          </h2>

          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-white/10 px-3 py-1"
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