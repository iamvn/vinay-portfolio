'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../icons';

/**
 * Profile tabs (Design → Profile tabs): one tab bar, and under it one area at a time, like the tabs on a social
 * profile. Any link on the page to a tab's #id (a menu row, a story circle, a bottom-bar icon) opens that tab and
 * brings the bar into view. The bar sticks under the top bar; on phones you can also swipe between tabs.
 */
export type ProfileTab = { label: string; icon: string; href: string; panel: string };

const idOf = (href: string) => (href.startsWith('#') ? href.slice(1) : '');

export function ProfileTabsView({ tabs, panels, editing, stickyTopMobile = 0, stickyTopDesktop = 0 }: {
  tabs: ProfileTab[]; panels: Record<string, ReactNode>; editing: boolean; stickyTopMobile?: number; stickyTopDesktop?: number;
}) {
  const shown = tabs.filter((t) => idOf(t.href) && panels[t.panel] !== undefined);
  const [active, setActive] = useState(() => idOf(shown[0]?.href ?? ''));
  const bar = useRef<HTMLDivElement>(null);
  const ids = shown.map((t) => idOf(t.href));
  const key = ids.join('|');

  const offset = () => (window.matchMedia('(min-width: 768px)').matches ? stickyTopDesktop : stickyTopMobile);
  const open = useCallback((id: string, scroll: boolean) => {
    if (!key.split('|').includes(id)) return false;
    setActive(id);
    if (scroll && bar.current) {
      const top = bar.current.getBoundingClientRect().top + window.scrollY - offset();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: Math.max(0, top - 2), behavior: reduce ? 'auto' : 'smooth' });
    }
    return true;
  }, [key, stickyTopMobile, stickyTopDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Links anywhere on the page to a tab open it (and the address shows that tab, so it can be shared).
  useEffect(() => {
    if (editing) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      const id = idOf(link?.getAttribute('href') ?? '');
      if (id && open(id, true)) {
        event.preventDefault();
        history.replaceState(null, '', `#${id}`);
      }
    };
    const fromHash = () => { const id = idOf(window.location.hash); if (id) open(id, true); };
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', fromHash);
    // Opened with #skills etc. in the address: show that tab.
    if (window.location.hash) requestAnimationFrame(fromHash);
    return () => { document.removeEventListener('click', onClick); window.removeEventListener('hashchange', fromHash); };
  }, [editing, open]);

  // Phones: swipe left / right on the content to move between tabs.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current; touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    const i = ids.indexOf(active), next = ids[i + (dx < 0 ? 1 : -1)];
    if (next) { open(next, false); history.replaceState(null, '', `#${next}`); }
  };

  if (!shown.length) return editing ? <p className="d-prim d-muted text-sm">Add tabs in this block’s settings.</p> : null;

  // In the editor every area is shown, labelled, so each can be edited.
  if (editing) {
    return (
      <div className="d-prim d-ptabs grid gap-6">
        {shown.map((t) => (
          <div key={t.panel} className="grid gap-2">
            <p className="d-muted text-xs font-bold uppercase tracking-wider">Tab: {t.label} ({t.href})</p>
            {panels[t.panel]}
          </div>
        ))}
      </div>
    );
  }

  const current = shown.find((t) => idOf(t.href) === active) ?? shown[0];
  return (
    <div className="d-prim d-ptabs" style={{ ['--ptabs-top-m' as string]: `${stickyTopMobile}px`, ['--ptabs-top-d' as string]: `${stickyTopDesktop}px` }}>
      <div ref={bar} className="d-ptabs-bar" role="tablist" aria-label="Sections">
        {shown.map((t) => {
          const on = t === current;
          return (
            <a key={t.href} href={t.href} role="tab" aria-selected={on} aria-controls={idOf(t.href)} id={`${idOf(t.href)}-tab`}
              className={`d-ptab ${on ? 'd-ptab-on' : ''}`}>
              <Icon name={t.icon || 'grid'} size={22} />
              <span className="d-ptab-label">{t.label}</span>
            </a>
          );
        })}
      </div>
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {shown.map((t) => {
          const id = idOf(t.href), on = t === current;
          return (
            // The id is the tab's #anchor, so links work even before the page's script has loaded.
            <section key={t.panel} id={id} role="tabpanel" aria-labelledby={`${id}-tab`} hidden={!on} className={`d-ptab-panel scroll-mt-28 ${on ? 'd-ptab-panel-on' : ''}`}>
              {panels[t.panel]}
            </section>
          );
        })}
      </div>
    </div>
  );
}
