import { Icon } from '@/components/icons';
import { LinkCardView } from '@/components/linkcard/card';
import type { CardProfile, LinkCard, ThemeId } from '@/lib/linkcard/types';
import { BRAND } from '@/lib/brand';

/**
 * The "what we're building" story on the company page, told like a pitch: the problem, what Kritipath is (and
 * isn't), how one profile powers everything, why now, what's different, what's live today, where it's going, FAQ.
 * Every "live today" item is a shipped feature; nothing here is a made-up number.
 */

const SCATTERED = [
  { label: 'Résumé doc', note: 'last edited 8 months ago', rot: -4 },
  { label: 'Job spreadsheet', note: '47 rows, 12 “no reply”', rot: 3 },
  { label: 'Portfolio site', note: 'one more builder, one more bill', rot: -2 },
  { label: 'Social profile', note: 'same as everyone else’s', rot: 5 },
  { label: 'Prep sheet', note: 'DSA list, half done', rot: -5 },
  { label: 'Interview notes', note: 'somewhere in a chat', rot: 2 },
];

const PAINS = [
  { title: 'Everything goes stale', text: 'Your experience lives in six places. Update one and the rest drift: the resume says one thing, the portfolio another.' },
  { title: 'Everyone looks the same', text: 'AI made polished résumés free, so a polished résumé no longer stands out. Recruiters want proof of work, and a PDF can’t show it.' },
  { title: 'You apply into a void', text: 'No idea who looked, what they asked, or which application needs a nudge. Most job searches run on hope and a spreadsheet.' },
];

const NOT_IS: [string, string][] = [
  ['a job board', 'We don’t list jobs. You bring the roles you want; Kritipath helps you win them.'],
  ['an auto-apply bot', 'Nothing is ever sent in your name. You apply; every application just gets stronger.'],
  ['a résumé template', 'Your resumes are generated from one living profile, so they’re always current.'],
  ['a website builder', 'Your site is wired to your resume, your AI assistant and your visitor insights.'],
];

const INPUTS = ['Your resume PDF', 'LinkedIn export', 'Projects & case studies', 'Skills & stories'];
const OUTPUTS: { icon: string; color: string; title: string; text: string }[] = [
  { icon: 'globe', color: '#0a84ff', title: 'Portfolio site', text: 'On your own domain' },
  { icon: 'notes', color: '#ff9f0a', title: 'ATS resumes', text: 'Tailored, scored' },
  { icon: 'chat', color: '#30d158', title: 'AI that answers for you', text: 'Grounded in your profile' },
  { icon: 'briefcase', color: '#ff375f', title: 'Application pipeline', text: 'Match, track, follow up' },
  { icon: 'target', color: '#00c7be', title: 'Prep plan', text: 'Goals, tasks, nudges' },
  { icon: 'chart', color: '#64d2ff', title: 'Insights', text: 'Who looked, from where' },
  { icon: 'send', color: '#bf5af2', title: 'Link card', text: 'One link for every bio, with a QR code' },
];

const LOOP = [
  { n: 'Build', text: 'Import a resume or LinkedIn once. Your profile becomes the source of truth.' },
  { n: 'Show', text: 'Publish a portfolio you designed, and share one link card in every bio.' },
  { n: 'Apply', text: 'Paste a job link, see your match, generate the right resume, track it.' },
  { n: 'Prepare', text: 'Turn the gap into a plan: DSA, system design, daily tasks, reminders.' },
  { n: 'Learn', text: 'See who visited, what recruiters asked your AI, and what real interviews looked like.' },
];

const WHY_NOW = [
  { icon: 'sparkle', title: 'AI made the résumé cheap', text: 'When anyone can generate a perfect-looking résumé in seconds, it stops being a signal. Real work, shown well, becomes the signal.' },
  { icon: 'cpu', title: 'Screening is automated', text: 'Applicant tracking systems and AI screeners read before people do. Structure and fit decide who gets seen, so you should check both first.' },
  { icon: 'rocket', title: 'Careers aren’t linear', text: 'People switch roles, stacks and countries more than ever. A career needs a home that outlives any one job or platform.' },
];

const DIFFERENT = [
  { icon: 'layers', title: 'One profile, many outputs', text: 'Write your experience once. The site, every resume, the AI assistant and the job match all read from it.' },
  { icon: 'database', title: 'You own it', text: 'Every site gets its own private database, its own address, nightly encrypted backups, and your data stays yours.' },
  { icon: 'bolt', title: 'Bring any AI', text: 'Claude, OpenAI, Gemini and more. Pick the model you trust; the product isn’t tied to one vendor.' },
  { icon: 'users', title: 'Built for one, or a thousand', text: 'Multi-tenant from day one: colleges, bootcamps and coaches can run many sites, each with its own people and roles.' },
];

const LIVE = [
  'Drag-and-drop portfolio designer', 'AI-generated templates from one sentence', 'ATS resume builder with a score', '“Ask my resume” AI assistant',
  'Link card for social bios, with QR code and click counts', 'Job link match and application pipeline', 'Follow-up reminders', 'Goal-based prep tracker', 'Community: interview stories and free resources',
  'Resume PDF and LinkedIn import', 'Visitor and contact insights', 'Custom domains, private database per site', 'Team roles, activity log, backups, health alerts',
];

const FAQ: [string, string][] = [
  ['Do I get a link-in-bio page too?', 'Yes. Every site has a link card at yoursite/details: your photo, a short bio and every link that matters, in the theme you pick. Put it in your Instagram, LinkedIn or X bio, print the QR code, and see which links people click. It’s included, with nothing extra to set up.'],
  ['Is Kritipath an AI job search tool?', 'No. Job search tools find openings. Kritipath is where your career lives: your portfolio, resumes, applications, prep and insights, built from one profile. AI helps along the way, but it’s a tool inside the product, not the product.'],
  ['Do you list jobs or apply for me?', 'Neither. You choose the roles you want. Kritipath shows how well you match, builds the right resume, tracks the application and reminds you to follow up. Nothing is ever sent in your name.'],
  ['Who owns my data?', 'You do. Every site has its own private database and address, with nightly encrypted backups. You decide what’s public.'],
  ['Which AI does it use?', 'Your choice: Claude, OpenAI, Gemini and others. The AI only answers from what’s on your site.'],
  ['Can a college, bootcamp or coach use it?', 'Yes. One account can run many sites, each with its own people, permissions and domain.'],
  ['How do I get started?', `${BRAND.name} is in early access, and each site is set up personally. Request access below and we’ll reach out.`],
];

const Tile = ({ icon, color }: { icon: string; color: string }) => (
  <span className="cl-tile" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 70%, white), ${color})`, color }}>
    <span style={{ color: '#fff', display: 'grid' }}><Icon name={icon} size={20} /></span>
  </span>
);

export function PitchProblem() {
  return (
    <section id="problem" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">The problem</p>
      <h2 className="cl-h2">A career today is scattered<br />across six apps.</h2>
      <p className="cl-lead">The work is real. The way it’s shown is broken.</p>
      <div className="cl-scatter" aria-label="Where a career lives today">
        {SCATTERED.map((s) => (
          <div key={s.label} className="cl-scrap cl-glass" style={{ ['--r' as string]: `${s.rot}deg` }}>
            <b>{s.label}</b><span>{s.note}</span>
          </div>
        ))}
      </div>
      <div className="cl-audience">
        {PAINS.map((p) => <article key={p.title} className="cl-aud cl-glass"><h3>{p.title}</h3><p>{p.text}</p></article>)}
      </div>
    </section>
  );
}

export function PitchNotIs() {
  return (
    <section id="what" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">What we’re building</p>
      <h2 className="cl-h2">Not another AI job search.</h2>
      <p className="cl-lead">
        {BRAND.name} is a <b style={{ color: 'var(--cl-ink)' }}>career operating system</b>: one place that holds your work and turns it into
        everything a career needs, on an address you own.
      </p>
      <div className="cl-isnot">
        {NOT_IS.map(([not, is]) => (
          <div key={not} className="cl-isnot-row cl-glass">
            <span className="cl-isnot-x"><em>Not</em>{not}</span>
            <span className="cl-isnot-is"><Icon name="check" size={18} />{is}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PitchOneProfile() {
  return (
    <section id="how-it-works" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">How it works</p>
      <h2 className="cl-h2">One profile. Everything else follows.</h2>
      <p className="cl-lead">Put your work in once. Every tool reads from the same profile, so nothing goes out of date.</p>
      <div className="cl-flow">
        <ul className="cl-flow-in" aria-label="What goes in">
          {INPUTS.map((i) => <li key={i} className="cl-glass">{i}</li>)}
        </ul>
        <span className="cl-flow-arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span>
        <div className="cl-flow-core">
          <span className="cl-flow-core-k">Your {BRAND.name} profile</span>
          <b>One source of truth</b>
          <span>Experience · projects · skills · goals</span>
        </div>
        <span className="cl-flow-arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span>
        <ul className="cl-flow-out" aria-label="What comes out">
          {OUTPUTS.map((o) => (
            <li key={o.title} className="cl-glass"><Tile icon={o.icon} color={o.color} /><span><b>{o.title}</b><small>{o.text}</small></span></li>
          ))}
        </ul>
      </div>

      <h3 className="cl-h3">The career loop</h3>
      <ol className="cl-loop">
        {LOOP.map((s, i) => (
          <li key={s.n} className="cl-glass"><span className="cl-step-n">{i + 1}</span><b>{s.n}</b><p>{s.text}</p></li>
        ))}
      </ol>
      <p className="cl-note" style={{ marginTop: '1rem' }}>Every turn of the loop makes the profile richer, and the next application stronger.</p>
    </section>
  );
}

export function PitchWhyNow() {
  return (
    <section id="why-now" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">Why now</p>
      <h2 className="cl-h2">Hiring changed. The tools didn’t.</h2>
      <div className="cl-audience">
        {WHY_NOW.map((w) => (
          <article key={w.title} className="cl-aud cl-glass"><Tile icon={w.icon} color="#6d5cf6" /><h3 style={{ marginTop: '1rem' }}>{w.title}</h3><p>{w.text}</p></article>
        ))}
      </div>
    </section>
  );
}

export function PitchDifferent() {
  return (
    <section id="different" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">Why {BRAND.name}</p>
      <h2 className="cl-h2">Built differently, on purpose.</h2>
      <div className="cl-grid">
        {DIFFERENT.map((d) => (
          <article key={d.title} className="cl-feature cl-glass"><Tile icon={d.icon} color="#0a84ff" /><h3>{d.title}</h3><p>{d.text}</p></article>
        ))}
      </div>
    </section>
  );
}

export function PitchLive() {
  return (
    <section id="live" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">Not a mockup</p>
      <h2 className="cl-h2">Already built. Already live.</h2>
      <p className="cl-lead">Everything below is running today, on real sites with real people.</p>
      <ul className="cl-live cl-glass">
        {LIVE.map((l) => <li key={l}><span className="cl-dot" aria-hidden="true" />{l}</li>)}
      </ul>
    </section>
  );
}

export function PitchVision() {
  return (
    <section id="vision" className="cl-section cl-wrap cl-center">
      <div className="cl-vision">
        <p className="cl-kicker" style={{ color: '#ffb4c8' }}>Where this goes</p>
        <h2 className="cl-h2">From résumés to proof of work.</h2>
        <p>
          Today, {BRAND.name} is the one place a professional keeps and shows their work. Tomorrow it’s where hiring starts: recruiters
          see real projects, ask an AI that knows the candidate, and reach out to people whose work they’ve already seen. Not a keyword
          match on a PDF.
        </p>
        <p className="cl-vision-line"><i lang="sa">कृति</i> your work · <i lang="sa">पथ</i> the path it opens</p>
      </div>
    </section>
  );
}

export function PitchFaq() {
  return (
    <section id="faq" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">Questions</p>
      <h2 className="cl-h2">The ones people ask first.</h2>
      <div className="cl-faq">
        {FAQ.map(([q, a], i) => (
          <details key={q} className="cl-glass" open={i === 0}>
            <summary>{q}<i className="cl-faq-plus" aria-hidden="true" /></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

const COMMUNITY = [
  { href: '/community', icon: 'users', color: '#5e5ce6', kicker: 'Interview experiences', title: 'Real rounds. Real questions.',
    text: 'People share how their interviews actually went: every round, the questions asked, the outcome and how they prepared. Search by company, role, level or topic.' },
  { href: '/community/resources', icon: 'bulb', color: '#30d158', kicker: 'Free resources', title: 'The links that actually helped.',
    text: 'YouTube videos, articles, GitHub repos and courses, shared by the people who learned from them and sorted by topic. Free for anyone to read; added by members, each with their name on it.' },
];

export function PitchCommunity() {
  return (
    <section id="community" className="cl-section cl-wrap cl-center">
      <p className="cl-kicker">Community</p>
      <h2 className="cl-h2">Nobody gets hired alone.</h2>
      <p className="cl-lead">A career platform should make everyone better, not just its users. So the community is open to all: read, learn and share, free.</p>
      <div className="cl-community">
        {COMMUNITY.map((c) => (
          <a key={c.href} href={c.href} className="cl-community-card cl-glass">
            <Tile icon={c.icon} color={c.color} />
            <span className="cl-community-k">{c.kicker}</span>
            <b>{c.title}</b>
            <p>{c.text}</p>
            <span className="cl-community-go">Open {c.kicker.toLowerCase()} <Icon name="arrowUpRight" size={15} /></span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** A made-up person for the illustration: the real card uses each site's own profile. */
const SAMPLE_PROFILE: CardProfile = { name: 'Aanya Rao', role: '', photo: '', socials: [{ kind: 'linkedin', url: '#' }, { kind: 'github', url: '#' }, { kind: 'instagram', url: '#' }, { kind: 'email', url: '#' }] };
const sampleCard = (theme: ThemeId, shape: LinkCard['shape']): LinkCard => ({
  enabled: true, theme, shape, showPhoto: true, showSocials: true,
  headline: 'Product designer · open to work', bio: 'I design calm, useful apps. Currently exploring AI-first interfaces.',
  links: [
    { id: 'a1', title: 'See my portfolio', url: '#', featured: true, enabled: true },
    { id: 'a2', title: 'Download my resume', url: '#', featured: false, enabled: true },
    { id: 'a3', title: 'Book a 15-min call', url: 'https://cal.com/', featured: false, enabled: true },
    { id: 'a4', title: 'Read my case studies', url: '#', featured: false, enabled: true },
  ],
});
const LINK_POINTS = [
  'Your photo, a short bio and every link that matters, on one page',
  'Seven themes and three button shapes, with a live preview while you edit',
  'A QR code for your resume, business card or conference badge',
  'See how many people opened it and which links they clicked',
  'Its own share preview on WhatsApp, LinkedIn and X',
  'Built from your profile, so it’s ready before you even open it',
];

export function PitchLinkCard() {
  return (
    <section id="link-card" className="cl-section cl-wrap">
      <div className="cl-lc">
        <div className="cl-lc-copy">
          <p className="cl-kicker">New · Link card</p>
          <h2 className="cl-h2">One link for every bio.</h2>
          <p className="cl-lead" style={{ marginInline: 0 }}>
            Instagram, LinkedIn and X give you one link. Make it count: every {BRAND.name} site comes with a link card at
            <b style={{ color: 'var(--cl-ink)' }}> yoursite/details</b>, made from your profile and ready to share.
          </p>
          <ul className="cl-lc-points">
            {LINK_POINTS.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}
          </ul>
          <div className="cl-lc-ctas">
            <a href="/details" className="cl-btn cl-btn-dark">See a live link card <Icon name="arrowUpRight" size={15} /></a>
            <a href="#get-started" className="cl-btn cl-btn-glass">Get yours</a>
          </div>
        </div>
        {/* An illustration of the real card component, with a made-up person. */}
        <div className="cl-lc-phones" aria-hidden="true" inert>
          {(['midnight', 'sunset', 'aurora'] as const).map((theme, i) => (
            <div key={theme} className={`cl-lc-phone cl-lc-phone-${i}`}>
              <div className="cl-lc-screen">
                <LinkCardView card={sampleCard(theme, i === 1 ? 'pill' : 'rounded')} profile={SAMPLE_PROFILE} href={() => '#link-card'} nameAs="p" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
