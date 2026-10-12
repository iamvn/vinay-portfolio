'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';

/**
 * "See it in action": a carousel through the product, one slide per tool, each with an illustrated
 * screen (drawn in HTML/CSS, not screenshots). Advances by itself every few seconds; pauses while the
 * pointer or keyboard focus is on it, when the tab is hidden, and for people who prefer reduced motion.
 * On phones it doesn't advance by itself: people swipe or tap the tabs.
 */

type Slide = { id: string; tab: string; icon: string; color: string; title: string; text: string; points: string[]; screen: ReactNode };

const INTERVAL = 7000;

const Bar = ({ w, dark = false, h }: { w: string; dark?: boolean; h?: string }) => <i className={`cl-t-bar${dark ? ' cl-t-bar-dark' : ''}`} style={{ width: w, height: h }} />;

function Window({ title, dark = false, children }: { title: string; dark?: boolean; children: ReactNode }) {
  return (
    <div className={`cl-t-win${dark ? ' cl-t-win-dark' : ''}`}>
      <div className="cl-t-win-bar"><i /><i /><i /><span>{title}</span></div>
      <div className="cl-t-win-body">{children}</div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    id: 'design', tab: 'Design studio', icon: 'palette', color: '#0a84ff',
    title: 'Design it like a pro. No code.',
    text: 'A visual editor built for portfolios: drag blocks onto the page, restyle anything, and see it on desktop and phone as you go.',
    points: ['Drag-and-drop sections and blocks', 'Glass, bold, minimal or your own look', 'Preview, publish and undo in one click'],
    screen: (
      <Window title="Design · Home page">
        <div className="cl-t-editor">
          <div className="cl-t-side">
            <b>Blocks</b>
            {['Hero', 'Projects', 'Skills', 'Experience', 'Contact'].map((label, i) => (
              <span key={label} className={`cl-t-block${i === 1 ? ' cl-t-block-drag' : ''}`}><i />{label}</span>
            ))}
          </div>
          <div className="cl-t-canvas">
            <div className="cl-t-hero">
              <Bar w="34%" /><Bar w="80%" dark h=".9rem" /><Bar w="58%" dark h=".9rem" />
              <span className="cl-t-btn">View my work</span>
            </div>
            <div className="cl-t-cards"><i /><i /><i /></div>
            <span className="cl-t-drop">Drop here</span>
          </div>
          <div className="cl-t-props">
            <b>Style</b>
            <span className="cl-t-label">Corners</span><span className="cl-t-slider"><i style={{ width: '70%' }} /></span>
            <span className="cl-t-label">Colors</span>
            <span className="cl-t-swatches">{['#1d1d1f', '#0a84ff', '#bf5af2', '#ff9f0a', '#30d158'].map((c) => <i key={c} style={{ background: c }} />)}</span>
            <span className="cl-t-label">Glass</span><span className="cl-t-toggle"><i /></span>
          </div>
        </div>
      </Window>
    ),
  },
  {
    id: 'ai', tab: 'AI templates', icon: 'sparkle', color: '#bf5af2',
    title: 'Describe a theme. Get a whole design.',
    text: 'Type an idea, a cricket ground, a streaming app, a morning newspaper, and AI builds a complete template around your real content.',
    points: ['Any theme you can imagine', 'Filled with your own profile and projects', 'Every block stays editable'],
    screen: (
      <Window title="Create a template with AI">
        <div className="cl-t-ai">
          <div className="cl-t-prompt"><Icon name="sparkle" size={16} /><span>Build me a cricket-themed portfolio with a scoreboard hero</span><b>Create</b></div>
          <div className="cl-t-themes">
            <div className="cl-t-theme" style={{ background: 'linear-gradient(160deg,#0f5132,#198754)' }}>
              <span className="cl-t-score">248/3 <small>Overs 42.1</small></span><Bar w="70%" /><Bar w="45%" /><em>Cricket</em>
            </div>
            <div className="cl-t-theme" style={{ background: 'linear-gradient(160deg,#141414,#3a0b0f)' }}>
              <span className="cl-t-rail">{[0, 1, 2, 3].map((i) => <i key={i} />)}</span><Bar w="60%" /><em>Streaming</em>
            </div>
            <div className="cl-t-theme cl-t-theme-paper">
              <span className="cl-t-mast">THE DAILY CAREER</span><Bar w="90%" dark /><Bar w="70%" dark /><em>Newspaper</em>
            </div>
            <div className="cl-t-theme cl-t-shimmer"><span>Generating…</span></div>
          </div>
        </div>
      </Window>
    ),
  },
  {
    id: 'resume', tab: 'Resume & ATS', icon: 'notes', color: '#ff9f0a',
    title: 'Resumes that get past the robots.',
    text: 'Turn your profile into a clean, ATS-friendly resume in a few clicks, then check your score and fix what’s missing before you apply.',
    points: ['ATS-friendly templates', 'Built from your profile, always up to date', 'A score with clear fixes'],
    screen: (
      <Window title="Resume builder">
        <div className="cl-t-resume">
          <div className="cl-t-paper">
            <Bar w="46%" dark h=".8rem" /><Bar w="30%" />
            <hr />
            <b>Experience</b><Bar w="92%" /><Bar w="84%" /><Bar w="70%" />
            <b>Projects</b><Bar w="88%" /><Bar w="60%" />
            <b>Skills</b><span className="cl-t-tags">{['React', 'TypeScript', 'Node.js', 'AI'].map((t) => <i key={t}>{t}</i>)}</span>
          </div>
          <div className="cl-t-ats">
            <div className="cl-t-ring" style={{ ['--p' as string]: '92%' }}><span>92</span></div>
            <b>ATS score</b>
            <ul>
              <li className="ok">Keywords match the job</li>
              <li className="ok">Clear, standard sections</li>
              <li className="ok">Readable by parsers</li>
              <li className="warn">Add numbers to 2 bullets</li>
            </ul>
          </div>
        </div>
      </Window>
    ),
  },
  {
    id: 'assistant', tab: 'Ask my resume', icon: 'chat', color: '#30d158',
    title: 'Your AI, answering recruiters 24/7.',
    text: 'Visitors ask about your experience and get instant, accurate answers drawn only from your own site, then a nudge to contact you.',
    points: ['Answers from your content, nothing invented', 'Works with Claude, OpenAI, Gemini and more', 'Turns curious visitors into conversations'],
    screen: (
      <Window title="Ask my resume">
        <div className="cl-t-chat">
          <p className="me">Has she led a frontend team?</p>
          <p>Yes. She led a team of four on an enterprise trading platform, owning the architecture and the move to Next.js.</p>
          <p className="me">What has she built with AI?</p>
          <p>A resume assistant with ATS scoring, and a test-automation agent that writes Puppeteer scripts from recordings.</p>
          <p className="cl-t-typing"><i /><i /><i /></p>
        </div>
      </Window>
    ),
  },
  {
    id: 'jobs', tab: 'Job tracker', icon: 'briefcase', color: '#ff375f',
    title: 'Every application, on one board.',
    text: 'Paste a job link to see what it asks for and how your profile matches, then follow each one from applied to offer.',
    points: ['Match score for every job', 'Applied, interview, offer at a glance', 'Notes, dates and links together'],
    screen: (
      <Window title="Applications">
        <div className="cl-t-board">
          {[
            { col: 'Applied', items: [['Frontend Engineer', 78], ['UI Developer', 71]] },
            { col: 'Interview', items: [['Product Engineer', 92], ['Senior React Dev', 86]] },
            { col: 'Offer', items: [['Staff Engineer', 89]] },
          ].map(({ col, items }) => (
            <div key={col} className="cl-t-col">
              <b>{col} <small>{items.length}</small></b>
              {items.map(([role, match]) => (
                <span key={role as string} className="cl-t-job">
                  <span>{role}</span>
                  <i className={(match as number) >= 85 ? 'hi' : ''}>{match}% match</i>
                </span>
              ))}
            </div>
          ))}
        </div>
      </Window>
    ),
  },
  {
    id: 'progress', tab: 'Progress tracker', icon: 'target', color: '#00c7be',
    title: 'A plan for your next switch.',
    text: 'Set a goal, pick 2 or 3 months to prepare, and break it into focus areas like DSA and system design. Daily tasks, steps and a bell keep you on it.',
    points: ['Goal timeline with days left', 'Board from Open to Done, with steps for every task', 'Daily streaks, notes, DSA sheets and a yearly vision board'],
    screen: (
      <Window title="Progress tracker" dark>
        <div className="cl-t-goal">
          <div className="cl-t-goal-head">
            <span><small>Your goal</small><b>Land a senior frontend role</b></span>
            <i className="cl-t-bell" aria-hidden="true"><Icon name="bell" size={14} /><em>2</em></i>
          </div>
          <div className="cl-t-goal-stats">
            {[['62', 'days left'], ['48%', 'tasks done'], ['9', 'day streak']].map(([v, l]) => <span key={l}><b>{v}</b><small>{l}</small></span>)}
          </div>
          <span className="cl-t-goal-time"><i style={{ width: '31%' }} /></span>
          <div className="cl-t-goal-body">
            <div className="cl-t-kanban">
              {[
                ['Open', '#94a3b8', [['DSA', 'Graphs: BFS & DFS', 0]]],
                ['In progress', '#22d3ee', [['DSA', 'Sliding window', 60], ['System design', 'Design a URL shortener', 30]]],
                ['Tested', '#c084fc', [['Projects', 'Portfolio case study', 100]]],
                ['Done', '#a3e635', [['DSA', 'Arrays & hashing', 100]]],
              ].map(([col, dot, cards]) => (
                <div key={col as string} className="cl-t-kcol">
                  <b><i style={{ background: dot as string }} />{col as string}</b>
                  {(cards as [string, string, number][]).map(([area, title, p]) => (
                    <span key={title} className="cl-t-kcard">
                      <small style={{ color: area === 'DSA' ? '#a3e635' : area === 'Projects' ? '#fb923c' : '#22d3ee' }}>{area}</small>
                      <span>{title}</span>
                      {p > 0 && p < 100 && <i><em style={{ width: `${p}%` }} /></i>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="cl-t-today">
              <b>Today</b>
              {[['Solve 2 LeetCode problems', true], ['Read 1 design article', true], ['Revise DP notes', false]].map(([t, done]) => (
                <span key={t as string} className={done ? 'done' : ''}><i />{t as string}</span>
              ))}
              <b className="cl-t-vision-h">Vision 2026</b>
              <span className="cl-t-vision"><i /><i /><i /></span>
            </div>
          </div>
        </div>
      </Window>
    ),
  },
  {
    id: 'community', tab: 'Community', icon: 'users', color: '#5e5ce6',
    title: 'Real interview stories, shared.',
    text: 'Read how others cleared their interviews: every round, the questions asked and how they prepared. Share your own, even anonymously.',
    points: ['Rounds, questions and prep, by company and role', 'Search and filter in seconds', 'Post anonymously or keep drafts'],
    screen: (
      <Window title="Community · Interview stories">
        <div className="cl-t-comm">
          <span className="cl-t-search"><Icon name="search" size={13} /> Search company, role or topic</span>
          <span className="cl-t-chips">{['All', 'Frontend', 'Backend', 'Selected', 'Fresher'].map((c, i) => <i key={c} className={i === 0 ? 'on' : ''}>{c}</i>)}</span>
          {[
            { who: 'A', name: 'Anonymous', role: 'Frontend Engineer · Nimbus Labs', result: 'Selected', rounds: ['DSA', 'Machine coding', 'System design', 'HR'], color: '#5e5ce6' },
            { who: 'R', name: 'Rohan K.', role: 'SDE II · Orbit Pay', result: 'Offer', rounds: ['Online test', 'DSA', 'Hiring manager'], color: '#ff9f0a' },
          ].map((p) => (
            <article key={p.name} className="cl-t-post">
              <header>
                <i style={{ background: p.color }}>{p.who}</i>
                <span><b>{p.name}</b><small>{p.role}</small></span>
                <em>{p.result}</em>
              </header>
              <span className="cl-t-rounds">{p.rounds.map((r, k) => <i key={r}>{k + 1}. {r}</i>)}</span>
              <Bar w="92%" /><Bar w="70%" />
            </article>
          ))}
        </div>
      </Window>
    ),
  },
  {
    id: 'admin', tab: 'Control room', icon: 'chart', color: '#64d2ff',
    title: 'Run everything from one control room.',
    text: 'A complete CMS for your career: edit your profile, projects and site text, see who visits, and invite your team with the right access.',
    points: ['Visits, sources and contact clicks', 'Profile, projects, resume and text in one place', 'Roles, backups and your own domain'],
    screen: (
      <Window title="Kritipath · Insights" dark>
        <div className="cl-t-admin">
          <span className="cl-t-tabs">{['Profile', 'Projects', 'Design', 'Insights', 'Users'].map((t) => <i key={t} className={t === 'Insights' ? 'on' : ''}>{t}</i>)}</span>
          <div className="cl-t-kpis">
            {[['Visitors', '1,284', '+18%'], ['Contact clicks', '96', '+24%'], ['Resume views', '312', '+9%']].map(([k, v, d]) => (
              <span key={k}><small>{k}</small><b>{v}</b><em>{d}</em></span>
            ))}
          </div>
          <div className="cl-t-chart">{[38, 52, 44, 66, 58, 74, 62, 88, 70, 92, 80, 96].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
          <div className="cl-t-sources">
            {[['LinkedIn', 46], ['Google', 28], ['Direct', 18], ['GitHub', 8]].map(([s, p]) => (
              <span key={s as string}><small>{s}</small><i><em style={{ width: `${p}%` }} /></i><b>{p}%</b></span>
            ))}
          </div>
        </div>
      </Window>
    ),
  },
  {
    id: 'activity', tab: 'Activity log', icon: 'pulse', color: '#ac8e68',
    title: 'See what happens, on every site.',
    text: 'For teams and institutions running many sites: one log of sign-ins, new users, access changes and community posts, so nothing happens unseen.',
    points: ['Sign-ins, users and access changes', 'Community posts and moderation', 'Filter by site or by type of activity'],
    screen: (
      <Window title="Kritipath · Activity logs" dark>
        <div className="cl-t-log">
          <span className="cl-t-filters"><i>All sites ▾</i><i>All activity ▾</i><small>1,248 events</small></span>
          {[
            ['09:41', 'Signed in', '#94a3b8', 'Priya S.', 'priya-sharma'],
            ['09:32', 'Added user', '#a3e635', 'Aman (admin)', 'design-lab'],
            ['09:10', 'Posted to community', '#a78bfa', 'Anonymous', 'kritipath'],
            ['08:55', 'Changed user', '#22d3ee', 'Neha R.', 'cs-batch-26'],
            ['08:20', 'Sent a request', '#fbbf24', 'Kabir M.', 'kabir-dev'],
            ['Yesterday', 'Created site', '#4ade80', 'Owner', 'cs-batch-26'],
          ].map(([time, kind, color, who, site]) => (
            <span key={time + kind} className="cl-t-event">
              <small>{time}</small>
              <em style={{ color, borderColor: `${color}55`, background: `${color}18` }}>{kind}</em>
              <b>{who}</b>
              <i>{site}</i>
            </span>
          ))}
        </div>
      </Window>
    ),
  },
];

export function ProductTour() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [tick, setTick] = useState(0); // restarts the progress bar
  const tabsRef = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    // Phones and narrow windows: no auto-advance (slides differ in height, so the page would jump while reading).
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

  // Keep the active tab visible in the scrolling tab row (phones), without moving the page.
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
            key={s.id} type="button" role="tab" data-i={i} id={`tour-tab-${s.id}`} aria-controls="tour-panel" aria-selected={i === index}
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

      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${slide.id}`} className="cl-tour-panel cl-glass">
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
        <div key={`${slide.id}-screen`} className="cl-tour-screen" aria-hidden="true">{slide.screen}</div>
      </div>
    </div>
  );
}
