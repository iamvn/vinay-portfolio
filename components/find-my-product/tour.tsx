'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';

/**
 * Find My Product tour: one slide per step of a real request, each with an illustrated phone screen
 * (drawn in HTML/CSS, not screenshots). Same behaviour as the Kritipath tour: advances by itself on wide
 * screens, pauses on hover/focus/hidden tab, and never auto-advances on phones or with reduced motion.
 */

type Slide = { id: string; tab: string; icon: string; color: string; title: string; text: string; points: string[]; screen: ReactNode };

const INTERVAL = 7000;

function Phone({ title, dark = false, children }: { title: string; dark?: boolean; children: ReactNode }) {
  return (
    <div className={`fm-phone${dark ? ' fm-phone-dark' : ''}`}>
      <div className="fm-phone-notch" />
      <div className="fm-phone-bar"><span className="fm-mark">⌕</span><b>{title}</b><span className="fm-lang">EN | हिं</span></div>
      <div className="fm-phone-body">{children}</div>
    </div>
  );
}

const Quote = ({ shop, price, tier, color, meta, pick }: { shop: string; price: string; tier: string; color: string; meta: string; pick?: boolean }) => (
  <div className={`fm-quote${pick ? ' fm-quote-pick' : ''}`}>
    <span className="fm-shop-ico">🏪</span>
    <div>
      <div className="fm-row"><b>{shop}</b><b>{price}</b></div>
      <small>{meta}</small>
      <span className="fm-tier" style={{ background: `color-mix(in srgb, ${color} 16%, white)`, color }}>{tier}</span>
    </div>
  </div>
);

const SLIDES: Slide[] = [
  {
    id: 'ask', tab: 'Ask', icon: 'search', color: '#e8590c',
    title: 'Ask once. Every shop nearby hears it.',
    text: 'Type what you need or snap a photo of the broken one. Pick a category, how far to look, and whether you’ll pick it up or want it delivered.',
    points: ['Photo, quick tags and your saved devices', '2, 5 or 10 km, or one specific shop', 'Self pickup, home delivery or either'],
    screen: (
      <Phone title="What do you need?">
        <div className="fm-field">📱 Mobile &amp; Accessories</div>
        <div className="fm-field fm-field-strong">65W Type-C charger for Vivo V40</div>
        <div className="fm-chips"><i>Type-C cable</i><i className="on">65W charger</i><i>Power bank</i></div>
        <div className="fm-seg"><i className="on">📣 All nearby</i><i>🏪 One shop</i></div>
        <div className="fm-seg"><i className="on">2 km</i><i>5 km</i><i>10 km</i></div>
        <div className="fm-loc">📍 Location set · Kothrud</div>
        <span className="fm-cta">Send request</span>
      </Phone>
    ),
  },
  {
    id: 'alarm', tab: 'Shop alarm', icon: 'bell', color: '#ff375f',
    title: 'The shop’s phone rings like an order.',
    text: 'Matching shops get a loud alert the moment you ask: a siren in the app, and a sticky notification even when the app is closed.',
    points: ['Only shops that sell that category', 'Works on Android and iPhone (home-screen app)', 'Sound keeps going until someone taps'],
    screen: (
      <Phone title="Sharma Mobiles" dark>
        <div className="fm-alarm">
          <span className="fm-alarm-ring">🔔</span>
          <b>New request: 65W Type-C charger</b>
          <small>650 m away · Kothrud · wants pickup</small>
          <span className="fm-cta">Send your price</span>
          <span className="fm-ghost">Stop alarm</span>
        </div>
      </Phone>
    ),
  },
  {
    id: 'quote', tab: 'Quote in 10s', icon: 'bolt', color: '#ff9f0a',
    title: 'A price in ten seconds, from the counter.',
    text: 'The shopkeeper taps the alert, picks how soon it’s available, types a price and sends. No login needed from the alert link.',
    points: ['In stock, by evening, tomorrow or an alternative', 'Pickup, delivery and delivery charge', 'Change the price until the customer picks'],
    screen: (
      <Phone title="Send your price">
        <div className="fm-grid2"><i className="on">In stock now</i><i>By evening</i><i>Tomorrow</i><i>Alternative</i></div>
        <div className="fm-price">₹ 649</div>
        <div className="fm-check"><i className="on" />🏪 Pickup from my shop</div>
        <div className="fm-check"><i className="on" />🛵 Deliver · ₹30</div>
        <div className="fm-field">Note: 1-year warranty, original box</div>
        <span className="fm-cta">Send quote</span>
      </Phone>
    ),
  },
  {
    id: 'compare', tab: 'Compare', icon: 'chart', color: '#30d158',
    title: 'Quotes arrive live. Pick the best one.',
    text: 'Prices, stock and distance appear on your screen as shops reply, with a chime. Accept for pickup or delivery in one tap.',
    points: ['Sorted by price, with ratings and distance', 'Switch shops if one stops responding', 'Shops that lost are told politely'],
    screen: (
      <Phone title="Quotes (3) · Live">
        <Quote shop="Sharma Mobiles" price="₹649" tier="In stock now" color="#15803d" meta="650 m · ★ 4.6 · 2 min ago" pick />
        <Quote shop="Galaxy Electronics" price="₹699" tier="By evening" color="#b45309" meta="1.4 km · ★ 4.2 · 5 min ago" />
        <Quote shop="City Mobile Point" price="₹720" tier="In stock now" color="#15803d" meta="2.1 km · new · 7 min ago" />
        <span className="fm-cta">Accept · 🏪 Pickup</span>
      </Phone>
    ),
  },
  {
    id: 'collect', tab: 'Collect', icon: 'check', color: '#0a84ff',
    title: 'Show a code. Walk out with it.',
    text: 'Accepting gives you a 4-digit code. Show it at the counter, or give it to the delivery person. The shop enters it to close the order.',
    points: ['Directions to the shop in one tap', 'Same code for home delivery', 'Rate the shop after a verified pickup'],
    screen: (
      <Phone title="Shop chosen — go pick up">
        <div className="fm-code-card">
          <small>🏪 Self pickup — show this code at the counter</small>
          <b className="fm-code">4 7 2 9</b>
          <strong>Sharma Mobiles</strong>
          <small>Shop 12, Paud Road, Kothrud</small>
        </div>
        <div className="fm-seg"><i className="on">💬 Message shop</i><i>🧭 Directions</i></div>
      </Phone>
    ),
  },
  {
    id: 'chat', tab: 'Chat', icon: 'chat', color: '#5e5ce6',
    title: 'Talk it through, without sharing numbers.',
    text: 'Ask about the model, the warranty or the timing in the app. Both sides get an alert, and phone numbers typed into chat are hidden.',
    points: ['One conversation per request and shop', 'Pop-up and sound for new messages', 'Admin decides who sees whose number'],
    screen: (
      <Phone title="Sharma Mobiles">
        <div className="fm-msgs">
          <span className="fm-msg">Is it the original Vivo charger?</span>
          <span className="fm-msg fm-msg-me">Yes, original with 1-year warranty. Kept it aside for you.</span>
          <span className="fm-msg">Great, coming in 15 minutes 🙏</span>
          <span className="fm-msg fm-msg-me">Call me on [number hidden]</span>
        </div>
        <div className="fm-field">Type a message…</div>
      </Phone>
    ),
  },
  {
    id: 'admin', tab: 'Control room', icon: 'grid', color: '#64d2ff',
    title: 'Run the whole market from one screen.',
    text: 'The admin portal shows every request, shop and person, with a live traffic monitor, activity log, feedback and database clean-up.',
    points: ['Add shopkeepers and admins with exact permissions', 'Turn WhatsApp, chat and contact details on or off', 'See errors, traffic and storage at a glance'],
    screen: (
      <Phone title="Admin · Overview">
        <div className="fm-kpis"><span><b>Requests</b><i style={{ width: '72%' }} /></span><span><b>Quotes</b><i style={{ width: '58%' }} /></span><span><b>Shops</b><i style={{ width: '40%' }} /></span></div>
        <div className="fm-toggle-row"><span>WhatsApp alerts</span><i /></div>
        <div className="fm-toggle-row"><span>In-app chat</span><i className="on" /></div>
        <div className="fm-toggle-row"><span>Shops see customer phone</span><i /></div>
        <div className="fm-log"><small>Admin added Sharma Mobiles · 9:42 pm</small><small>Customer asked one shop directly · 9:51 pm</small></div>
      </Phone>
    ),
  },
];

export function FmpTour() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [tick, setTick] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 899px)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { media.removeEventListener('change', update); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL);
    return () => window.clearTimeout(timer);
  }, [index, paused, reduced, tick, go]);

  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (row && tab) row.scrollTo({ left: tab.offsetLeft - row.clientWidth / 2 + tab.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [index, reduced]);

  const slide = SLIDES[index];
  return (
    <div
      className="cl-tour"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div ref={tabsRef} className="cl-tour-tabs cl-glass" role="tablist" aria-label="Product tour">
        {SLIDES.map((s, i) => (
          <button
            key={s.id} type="button" role="tab" data-i={i} id={`fm-tab-${s.id}`} aria-controls="fm-panel" aria-selected={i === index}
            tabIndex={i === index ? 0 : -1}
            className="cl-tour-tab"
            onClick={() => go(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + SLIDES.length) % SLIDES.length;
                go(next);
                tabsRef.current?.querySelector<HTMLElement>(`[data-i="${next}"]`)?.focus();
              }
            }}
          >
            <span className="cl-tour-ico" style={{ background: s.color }}><Icon name={s.icon} size={14} /></span>
            {s.tab}
            {i === index && !reduced && <span key={tick} className="cl-tour-progress" style={{ animationDuration: `${INTERVAL}ms`, animationPlayState: paused ? 'paused' : 'running' }} />}
          </button>
        ))}
      </div>

      <div id="fm-panel" role="tabpanel" aria-labelledby={`fm-tab-${slide.id}`} className="cl-tour-panel cl-glass">
        <div key={slide.id} className="cl-tour-copy">
          <span className="cl-tour-chip" style={{ color: slide.color }}><Icon name={slide.icon} size={14} />{slide.tab}</span>
          <h3>{slide.title}</h3>
          <p>{slide.text}</p>
          <ul>{slide.points.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}</ul>
          <div className="cl-tour-nav">
            <button type="button" aria-label="Previous" onClick={() => go(index - 1)}><Icon name="arrow" size={16} /></button>
            <span>{index + 1} / {SLIDES.length}</span>
            <button type="button" aria-label="Next" onClick={() => go(index + 1)}><Icon name="arrow" size={16} /></button>
          </div>
        </div>
        <div key={`${slide.id}-screen`} className="cl-tour-screen fm-screen" aria-hidden="true">{slide.screen}</div>
      </div>
    </div>
  );
}
