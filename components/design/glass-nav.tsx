'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';

/**
 * The "Floating glass" navigation bar (Liquid Glass). At the top of the page it's transparent, so the hero's
 * wallpaper shows through; once the page scrolls it turns into frosted glass to stay readable. On phones the
 * links move into a menu behind a hamburger button.
 */
export function GlassNav({ brand, links, showResume, sticky, overlay, editing }: {
  brand: string;
  links: { label: string; href: string }[];
  showResume: boolean;
  sticky: boolean;
  overlay: boolean;
  editing: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sticky || editing) return;
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [sticky, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, [open]);

  const resume = showResume && <a href="/api/resume" className="d-nav-cta">Resume <Icon name="arrowUpRight" size={14} /></a>;
  return (
    <header className={`d-gnav z-30 ${sticky && !editing ? 'sticky top-0' : 'relative'} ${overlay ? 'd-nav-overlay' : ''}`} data-solid={scrolled || open ? 'true' : undefined}>
      <div className="d-gnav-inner">
        <div className="d-gnav-bar">
          <a href="#home" className="flex min-h-11 min-w-0 items-center truncate px-1 text-[15px] font-semibold tracking-tight no-underline md:text-base">{brand}</a>
          <nav aria-label="Sections" className="hidden items-center justify-center gap-0.5 md:flex">
            {links.map((link, i) => <a key={link.label + link.href} href={link.href} aria-current={i === 0 ? 'location' : undefined} className="d-nav-pill">{link.label}</a>)}
          </nav>
          <div className="flex items-center justify-end gap-2">
            <span className="hidden md:inline-flex">{resume}</span>
            {links.length > 0 && (
              <button ref={buttonRef} type="button" className="d-gnav-burger md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="d-gnav-menu" onClick={() => setOpen((v) => !v)}>
                <Icon name={open ? 'close' : 'menu'} size={20} />
              </button>
            )}
            {links.length === 0 && <span className="md:hidden">{resume}</span>}
          </div>
        </div>
        {open && (
          <div ref={menuRef} id="d-gnav-menu" className="d-gnav-menu d-glass d-glass-light md:hidden">
            <nav aria-label="Sections (menu)" className="grid gap-1">
              {links.map((link, i) => (
                <a key={link.label + link.href} href={link.href} onClick={() => setOpen(false)} aria-current={i === 0 ? 'location' : undefined} className="d-gnav-item">
                  {link.label}<Icon name="arrow" size={16} />
                </a>
              ))}
            </nav>
            {showResume && <a href="/api/resume" onClick={() => setOpen(false)} className="d-nav-cta mt-3 w-full justify-center">Resume <Icon name="arrowUpRight" size={14} /></a>}
          </div>
        )}
      </div>
    </header>
  );
}
