'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { api, describeError } from './api';
import { Button, Card, Field, Loading, SaveBar, TextArea, TextInput, Toggle, useReadOnly, type Notify } from './ui';
import { LinkCardView } from '@/components/linkcard/card';
import { PRESETS, SHAPES, THEMES, THEME_IDS, newLinkId, type CardProfile, type LinkCard, type Shape } from '@/lib/linkcard/types';

/**
 * Admin → Link card: one shareable page (/details) with a photo, a short bio and links, for social media
 * bios, QR codes and messages. Edit on the left, see it live on the right (or with "Preview" on phones).
 */
type Data = { card: LinkCard & { saved?: boolean }; profile: CardProfile; stats: { views: number; clicks: Record<string, number> }; url: string };

const strip = ({ saved: _saved, ...card }: LinkCard & { saved?: boolean }): LinkCard => card; // eslint-disable-line @typescript-eslint/no-unused-vars

function Phone({ card, profile }: { card: LinkCard; profile: CardProfile }) {
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2.4rem] border border-white/15 bg-black p-2.5 shadow-2xl">
      <div className="h-[600px] overflow-y-auto overflow-x-hidden rounded-[1.9rem] [scrollbar-width:none]">
        <LinkCardView card={card} profile={profile} href={(_id, url) => url} />
      </div>
    </div>
  );
}

export function LinkCardTab({ notify, onOpenProfile }: { notify: Notify; onOpenProfile: () => void }) {
  const readOnly = useReadOnly();
  const [data, setData] = useState<Data | null>(null);
  const [card, setCard] = useState<LinkCard | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api<Data>('GET', '/api/linkcard', undefined, { fresh: true }).then((d) => {
    setData(d);
    const c = strip(d.card);
    setCard(c);
    setSaved(d.card.saved ? JSON.stringify(c) : '');
  }).catch((e) => notify(describeError(e), 'error')), [notify]);
  useEffect(() => { void load(); }, [load]);

  const url = data?.url ?? '';
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0a0a0a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [url]);

  const dirty = useMemo(() => Boolean(card) && JSON.stringify(card) !== saved, [card, saved]);
  if (!data || !card) return <Loading />;

  const set = (patch: Partial<LinkCard>) => setCard({ ...card, ...patch });
  const setLink = (id: string, patch: Partial<LinkCard['links'][number]>) => set({ links: card.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const move = (i: number, by: number) => {
    const links = [...card.links];
    const [item] = links.splice(i, 1);
    links.splice(i + by, 0, item);
    set({ links });
  };
  const add = (title = '', link = 'https://') => set({ links: [...card.links, { id: newLinkId(), title, url: link, featured: false, enabled: true }] });

  async function save() {
    if (!card) return;
    setBusy(true);
    try {
      const next = await api<LinkCard & { saved: boolean }>('PUT', '/api/linkcard', card);
      const c = strip(next);
      setCard(c);
      setSaved(JSON.stringify(c));
      notify(card.enabled ? 'Link card saved. It’s live.' : 'Saved. The card is switched off, so the link shows “not found”.');
    } catch (e) {
      notify(describeError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { notify('Couldn’t copy. Select the link and copy it.', 'error'); }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: data?.profile.name, url }); } catch { /* cancelled */ } } else void copy();
  }
  const clicks = Object.values(data.stats.clicks).reduce((a, b) => a + b, 0);
  const live = card.enabled && Boolean(saved);

  return (
    <div className="space-y-4">
      {/* Share: the first thing on the tab */}
      <section className="overflow-hidden rounded-2xl border border-lime-300/30 bg-gradient-to-br from-lime-300/[.12] via-slate-950 to-cyan-300/[.08] p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[.3em] text-lime-300">Your link card</p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">One link for every bio.</h2>
            <p className="mt-1 text-sm text-slate-300">Put it on Instagram, LinkedIn, X, your email signature or a QR code. Everything you want people to find, on one page.</p>
            <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-black/40 p-1.5 pl-3">
              <span className={`size-2 shrink-0 rounded-full ${live ? 'bg-lime-300' : 'bg-slate-500'}`} aria-hidden="true" />
              <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-sm text-white hover:text-lime-200">{url.replace(/^https?:\/\//, '')}</a>
              <Button tone="primary" onClick={copy} view>{copied ? 'Copied' : 'Copy'}</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={share} view>Share…</Button>
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60 sm:min-h-0 sm:py-2">Open ↗</a>
              <Button onClick={() => setPreview(true)} className="lg:hidden" view>Preview</Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {!saved ? 'Not saved yet: what you see is a starting point made from your profile. Save to make it yours.'
                : card.enabled ? <>Last 30 days: <b className="text-white">{data.stats.views}</b> view{data.stats.views === 1 ? '' : 's'} · <b className="text-white">{clicks}</b> link click{clicks === 1 ? '' : 's'}</>
                : 'Switched off: the link shows “not found” until you turn it back on.'}
            </p>
          </div>
          {qr && (
            <div className="flex shrink-0 flex-col items-center gap-2 self-center">
              <img src={qr} alt={`QR code for ${url}`} width={136} height={136} className="rounded-xl bg-white p-1" />
              <a href={qr} download="link-card-qr.png" className="text-xs font-bold text-lime-300 hover:underline">Download QR</a>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Card title="On or off" id="linkcard-on">
            <Toggle label={card.enabled ? 'The card is live at /details' : 'The card is switched off'} checked={card.enabled} onChange={(enabled) => set({ enabled })} />
          </Card>

          <Card title="About you" id="linkcard-about">
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Your name, photo and social links come from <button type="button" onClick={onOpenProfile} className="font-bold text-lime-300 hover:underline">Profile</button>.</p>
              <Field label="Headline" hint="A few words under your name, e.g. “Frontend engineer · open to work”.">
                <TextInput value={card.headline} onChange={(headline) => set({ headline })} placeholder="What you do" />
              </Field>
              <Field label={`Short bio (${card.bio.length}/300)`}>
                <TextArea value={card.bio} onChange={(bio) => set({ bio: bio.slice(0, 300) })} rows={3} placeholder="One or two lines about you." />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Show my photo" checked={card.showPhoto} onChange={(showPhoto) => set({ showPhoto })} />
                <Toggle label={`Show social icons (${data.profile.socials.length})`} checked={card.showSocials} onChange={(showSocials) => set({ showSocials })} />
              </div>
            </div>
          </Card>

          <Card title={`Links (${card.links.length})`} id="linkcard-links">
            <ul className="space-y-3">
              {card.links.map((l, i) => (
                <li key={l.id} className={`rounded-xl border p-3 ${l.featured ? 'border-lime-300/40 bg-lime-300/[.05]' : 'border-white/10 bg-black/20'} ${l.enabled ? '' : 'opacity-60'}`}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Title"><TextInput value={l.title} onChange={(title) => setLink(l.id, { title })} placeholder="e.g. My portfolio" /></Field>
                    <Field label="Link" hint={l.url.startsWith('{site}') ? 'A page on your own site.' : undefined}>
                      <TextInput value={l.url} onChange={(value) => setLink(l.id, { url: value.trim() })} placeholder="https://…" />
                    </Field>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button type="button" disabled={readOnly} aria-pressed={l.featured} onClick={() => setLink(l.id, { featured: !l.featured })}
                      className={`min-h-9 rounded-lg px-2.5 text-xs font-bold ${l.featured ? 'bg-lime-300 text-black' : 'border border-white/15 text-slate-300 hover:border-lime-300/60'}`}>★ {l.featured ? 'Highlighted' : 'Highlight'}</button>
                    <button type="button" disabled={readOnly} aria-pressed={!l.enabled} onClick={() => setLink(l.id, { enabled: !l.enabled })}
                      className="min-h-9 rounded-lg border border-white/15 px-2.5 text-xs font-bold text-slate-300 hover:border-white/40">{l.enabled ? 'Hide' : 'Show'}</button>
                    <button type="button" disabled={readOnly || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${l.title || 'link'} up`} className="min-h-9 min-w-9 rounded-lg border border-white/15 text-slate-300 disabled:opacity-30">↑</button>
                    <button type="button" disabled={readOnly || i === card.links.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${l.title || 'link'} down`} className="min-h-9 min-w-9 rounded-lg border border-white/15 text-slate-300 disabled:opacity-30">↓</button>
                    <span className="ml-auto text-xs text-slate-500">{data.stats.clicks[l.id] ?? 0} click{(data.stats.clicks[l.id] ?? 0) === 1 ? '' : 's'}</span>
                    <button type="button" disabled={readOnly} onClick={() => set({ links: card.links.filter((x) => x.id !== l.id) })} aria-label={`Delete ${l.title || 'link'}`}
                      className="min-h-9 rounded-lg px-2.5 text-xs font-bold text-slate-500 hover:text-red-300">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
            {!readOnly && (
              <div className="mt-4 space-y-2">
                <Button tone="primary" onClick={() => add()} disabled={card.links.length >= 30}>+ Add a link</Button>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick add">
                  <span className="mr-1 self-center text-[11px] text-slate-500">Quick add:</span>
                  {PRESETS.map((p) => (
                    <button key={p.title} type="button" title={p.hint} disabled={card.links.length >= 30} onClick={() => add(p.title, p.url)}
                      className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-bold text-slate-300 hover:border-lime-300/60 hover:text-white">{p.title}</button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Look" id="linkcard-look">
            <Field label="Theme" group>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {THEME_IDS.map((id) => (
                  <button key={id} type="button" disabled={readOnly} onClick={() => set({ theme: id })} aria-pressed={card.theme === id}
                    className={`rounded-xl p-1 text-center ${card.theme === id ? 'ring-2 ring-lime-300' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                    <span className="flex h-12 items-end justify-center rounded-lg pb-1.5" style={{ background: THEMES[id].bg }}>
                      <i className="h-2 w-8 rounded-full" style={{ background: THEMES[id].accent }} />
                    </span>
                    <span className="mt-1 block text-[11px] font-bold text-slate-300">{THEMES[id].label}</span>
                  </button>
                ))}
              </div>
            </Field>
            <div className="mt-4">
              <Field label="Button shape" group>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(SHAPES) as Shape[]).map((s) => (
                    <button key={s} type="button" disabled={readOnly} onClick={() => set({ shape: s })} aria-pressed={card.shape === s}
                      className={`min-h-10 px-4 text-xs font-bold ${s === 'pill' ? 'rounded-full' : s === 'square' ? 'rounded-sm' : 'rounded-xl'} ${card.shape === s ? 'bg-lime-300 text-black' : 'border border-white/15 text-slate-300'}`}>{SHAPES[s]}</button>
                  ))}
                </div>
              </Field>
            </div>
          </Card>

          <SaveBar dirty={dirty || !saved} busy={busy} onSave={save} onReset={saved ? () => setCard(JSON.parse(saved)) : undefined} saveLabel={saved ? 'Save link card' : 'Save and publish'} />
        </div>

        <aside className="hidden lg:sticky lg:top-36 lg:block" aria-label="Preview">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">Live preview</p>
          <Phone card={card} profile={data.profile} />
        </aside>
      </div>

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 pt-[calc(env(safe-area-inset-top)+.75rem)] backdrop-blur lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-black text-white">Preview</p>
            <button type="button" onClick={() => setPreview(false)} className="min-h-11 rounded-lg bg-lime-300 px-4 text-xs font-black uppercase text-black">Done</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl">
            <LinkCardView card={card} profile={data.profile} href={(_id, u) => u} />
          </div>
        </div>
      )}
    </div>
  );
}
