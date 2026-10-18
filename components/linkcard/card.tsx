import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { THEMES, linkKind, resolveUrl, type CardProfile, type LinkCard } from '@/lib/linkcard/types';

/**
 * The link card itself: used by the public page (/details) and the live preview in Admin → Link card.
 * `href` decides where each button goes (the public page counts the click first).
 */

const KIND_ICON: Record<ReturnType<typeof linkKind>, string> = {
  video: 'camera', code: 'code', work: 'briefcase', mail: 'mail', phone: 'chat', chat: 'chat', calendar: 'calendar', file: 'download', photo: 'camera', web: 'globe',
};
const SHAPE = { rounded: '16px', pill: '999px', square: '6px' } as const;

export function LinkCardView({ card, profile, href, top, footer }: {
  card: LinkCard; profile: CardProfile; href: (id: string, url: string) => string; top?: ReactNode; footer?: ReactNode;
}) {
  const t = THEMES[card.theme] ?? THEMES.midnight;
  const radius = SHAPE[card.shape] ?? SHAPE.rounded;
  const links = card.links.filter((l) => l.enabled);
  const initials = profile.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const vars = { '--lc-text': t.text, '--lc-muted': t.muted, '--lc-btn': t.button, '--lc-btn-text': t.buttonText, '--lc-border': t.border, '--lc-accent': t.accent, '--lc-accent-text': t.accentText, '--lc-radius': radius } as CSSProperties;

  return (
    <div className="lc-root" style={{ ...vars, background: t.bg, color: t.text }}>
      <div className="lc-inner">
        {top}
        {card.showPhoto && (
          profile.photo
            ? <img className="lc-photo" src={profile.photo} alt="" width={96} height={96} />
            : <span className="lc-photo lc-initials" aria-hidden="true">{initials || '★'}</span>
        )}
        <h1 className="lc-name">{profile.name}</h1>
        {card.headline && <p className="lc-headline">{card.headline}</p>}
        {card.bio && <p className="lc-bio">{card.bio}</p>}
        {card.showSocials && profile.socials.length > 0 && (
          <ul className="lc-socials" aria-label="Profiles">
            {profile.socials.map((s) => (
              <li key={s.kind}>
                <a href={s.url} target={s.kind === 'email' ? undefined : '_blank'} rel="noopener noreferrer" aria-label={s.kind === 'email' ? 'Email' : s.kind[0].toUpperCase() + s.kind.slice(1)}>
                  <Icon name={s.kind === 'email' ? 'mail' : s.kind} size={20} />
                </a>
              </li>
            ))}
          </ul>
        )}
        <ul className="lc-links">
          {links.map((l) => {
            const url = resolveUrl(l.url);
            const external = /^https?:/i.test(url);
            return (
              <li key={l.id}>
                <a className={`lc-link ${l.featured ? 'lc-featured' : ''}`} href={href(l.id, url)} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
                  <span className="lc-link-icon" aria-hidden="true"><Icon name={KIND_ICON[linkKind(url)]} size={18} /></span>
                  <span className="lc-link-title">{l.title}</span>
                  <span className="lc-link-go" aria-hidden="true"><Icon name="arrowUpRight" size={16} /></span>
                </a>
              </li>
            );
          })}
        </ul>
        {links.length === 0 && <p className="lc-bio" style={{ opacity: 0.7 }}>No links yet.</p>}
        {footer}
      </div>
    </div>
  );
}
