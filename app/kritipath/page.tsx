import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { BrandMark, BrandName } from '@/components/brand-mark';
import { ProductTour } from '@/components/kritipath/product-tour';
import { RequestForm } from '@/components/kritipath/request-form';
import { Icon } from '@/components/icons';
import { BRAND, brandUrl } from '@/lib/brand';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/seo';
import { currentSite } from '@/lib/sites/context';
import './kritipath.css';

export const dynamic = 'force-dynamic';

const TITLE = `${BRAND.name}: ${BRAND.tagline}`;
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: BRAND.description,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.founder.name, url: SITE_URL }],
  creator: BRAND.founder.name,
  alternates: { canonical: `${SITE_URL}${BRAND.path}` },
  openGraph: { type: 'website', siteName: BRAND.name, title: TITLE, description: BRAND.description, url: `${SITE_URL}${BRAND.path}` },
  twitter: { card: 'summary_large_image', title: TITLE, description: BRAND.description },
};

const FEATURES: { icon: string; color: string; title: string; text: string }[] = [
  { icon: 'palette', color: '#0a84ff', title: 'A portfolio you design', text: 'A drag-and-drop designer with ready templates, from Apple-style glass to bold themes. Publish in one click.' },
  { icon: 'sparkle', color: '#bf5af2', title: 'Templates made by AI', text: 'Describe a theme, a streaming app, a cricket ground, a newspaper, and AI turns it into a complete design.' },
  { icon: 'notes', color: '#ff9f0a', title: 'Resumes that pass ATS', text: 'Build clean, ATS-friendly resumes straight from your profile and check your score before you apply.' },
  { icon: 'chat', color: '#30d158', title: 'An AI that answers recruiters', text: '“Ask my resume” replies to questions about your experience, using only what’s on your site.' },
  { icon: 'briefcase', color: '#ff375f', title: 'Every application, tracked', text: 'Paste a job link, see how your profile matches what it asks for, and follow each application to the offer.' },
  { icon: 'user', color: '#5e5ce6', title: 'Real interview stories', text: 'A community of real interview experiences: the rounds, the questions, and how people prepared.' },
  { icon: 'chart', color: '#64d2ff', title: 'Know who’s looking', text: 'Private insights on visits, where they came from, and who clicked to contact you.' },
  { icon: 'globe', color: '#ffd60a', title: 'Your address, your data', text: 'Your own subdomain or custom domain, a private database for every site, backups and team roles.' },
];

const STEPS = [
  { title: 'Request access', text: 'Tell us a little about you below. It takes under a minute.' },
  { title: 'We set up your site', text: 'We create your own address and a private database, then send you a sign-in.' },
  { title: 'Make it yours', text: 'Add your profile, pick a template, and publish. Change anything, anytime.' },
];

const AUDIENCE = [
  { title: 'Job seekers', text: 'Stand out with a portfolio, a resume and an AI assistant that work together, and keep every application in one place.' },
  { title: 'Engineers & designers', text: 'Show real projects as case studies, design your own look, and let your work speak before the first call.' },
  { title: 'Teams & institutions', text: 'Bootcamps, colleges and career coaches can run many sites, each with its own people and permissions.' },
];

const STATS: [string, string][] = [
  ['8 tools', 'portfolio, resume, AI, jobs and more'],
  ['1 login', 'for your whole career'],
  ['Any AI', 'Claude, OpenAI, Gemini and others'],
  ['Your domain', 'with a private database per site'],
];

const dots = (colors: string[]) => (
  <span style={{ display: 'flex', gap: 4, marginBottom: 4 }}>{colors.map((c) => <i key={c} style={{ width: 7, height: 7, borderRadius: 99, background: c }} />)}</span>
);
const TEMPLATES: { name: string; bg: string; ink: string; ai?: boolean; serif?: boolean; top?: ReactNode }[] = [
  { name: 'Glass Studio', bg: 'linear-gradient(135deg,#fde2ec,#e9e3ff 55%,#dbeafe)', ink: '#1d1d1f', top: dots(['#ff5f57', '#febc2e', '#28c840']) },
  { name: 'Arcade', bg: 'linear-gradient(160deg,#04070b,#0b1a12)', ink: '#bef264' },
  { name: 'Minimal', bg: '#f6f1e7', ink: '#3b3127', serif: true },
  { name: 'Studio', bg: '#ffffff', ink: '#111827' },
  { name: 'Cricket', bg: 'linear-gradient(160deg,#0f5132,#198754)', ink: '#ffffff', ai: true },
  { name: 'Streaming', bg: 'linear-gradient(160deg,#111,#3a0b0f)', ink: '#ffffff', ai: true },
  { name: 'Newspaper', bg: '#f4ecd8', ink: '#2b2b2b', ai: true, serif: true },
  { name: 'Console', bg: 'linear-gradient(160deg,#050816,#0b2a6b)', ink: '#e0e7ff', ai: true },
  { name: 'Classic', bg: 'linear-gradient(160deg,#030609,#0c1a24)', ink: '#67e8f9' },
];

const LINKEDIN = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i;

/** The Kritipath company page: what the platform does, who made it, and how to get a site. Main site only. */
export default async function KritipathPage() {
  const site = await currentSite();
  if (!site.isMain) redirect(brandUrl('site'));
  const profile = await prisma.profile.findUnique({ where: { id: 1 }, select: { role: true, profileImage: true, socialLinks: true } }).catch(() => null);
  let linkedin = '';
  try { linkedin = String((JSON.parse(profile?.socialLinks ?? '{}') as Record<string, unknown>).linkedin ?? ''); } catch { /* none */ }
  if (!LINKEDIN.test(linkedin)) linkedin = '';
  const photo = profile?.profileImage && /^(\/|https:\/\/)/.test(profile.profileImage) ? profile.profileImage : '';
  const firstName = BRAND.founder.name.split(' ')[0];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: BRAND.name, url: `${SITE_URL}${BRAND.path}`, foundingDate: String(BRAND.founded), description: BRAND.description,
        founder: { '@type': 'Person', name: BRAND.founder.name, jobTitle: BRAND.founder.title, url: SITE_URL } },
      { '@type': 'SoftwareApplication', name: BRAND.name, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: BRAND.description },
    ],
  };

  return (
    <div className="cl-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="cl-nav">
        <div className="cl-wrap">
          <div className="cl-nav-bar cl-glass">
            <a href="#top" className="cl-brand" aria-label={`${BRAND.name} home`}><BrandMark size={26} /><BrandName /></a>
            <nav className="cl-nav-links" aria-label="Page sections">
              <a href="#tour">Tour</a><a href="#features">Features</a><a href="#templates">Templates</a><a href="#founder">Founder</a><a href="/login">Sign in</a>
            </nav>
            <a href="#get-started" className="cl-btn cl-btn-dark">Get started</a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="cl-hero cl-wrap">
          <span className="cl-eyebrow cl-glass"><span className="cl-dot" aria-hidden="true" />{BRAND.name} · The complete career suite</span>
          <h1 className="cl-h1">Your work, your story,<br /><span className="cl-gradient">one path forward.</span></h1>
          <p className="cl-lead">
            {BRAND.name} gives every professional a portfolio website they design themselves, ATS-ready resumes, an AI assistant that answers recruiters,
            and a tracker for every application. On your own address.
          </p>
          <div className="cl-hero-ctas">
            <a href="#get-started" className="cl-btn cl-btn-dark cl-btn-lg">Request access</a>
            <a href="/" className="cl-btn cl-btn-glass cl-btn-lg">See a live site <Icon name="arrowUpRight" size={16} /></a>
          </div>

          {/* A sample site: an original illustration, not a screenshot. */}
          <div className="cl-preview cl-glass" aria-hidden="true">
            <div className="cl-window">
              <div className="cl-window-bar"><i /><i /><i /><span className="cl-url">yourname.com</span></div>
              <div className="cl-mock">
                <div style={{ display: 'grid', gap: '.8rem', textAlign: 'left' }}>
                  <div className="cl-skel" style={{ width: '38%' }} />
                  <div className="cl-skel-dark" style={{ width: '92%' }} />
                  <div className="cl-skel-dark" style={{ width: '70%' }} />
                  <div className="cl-skel" style={{ width: '85%', marginTop: '.4rem' }} />
                  <div className="cl-skel" style={{ width: '60%' }} />
                  <div className="cl-chip-row">
                    {[['React', '#0a84ff'], ['Product', '#bf5af2'], ['Leadership', '#30d158'], ['AI', '#ff375f']].map(([label, color]) => (
                      <span key={label} className="cl-chip"><i style={{ background: color }} />{label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '.8rem' }}>
                  <div className="cl-mock-card cl-glass" style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                    <div className="cl-score"><span>86</span></div>
                    <div style={{ flex: 1, display: 'grid', gap: '.45rem' }}>
                      <b style={{ fontSize: '.9rem' }}>ATS score</b>
                      <div className="cl-skel" style={{ width: '90%' }} /><div className="cl-skel" style={{ width: '65%' }} />
                    </div>
                  </div>
                  <div className="cl-mock-card cl-glass" style={{ display: 'grid', gap: '.5rem', textAlign: 'left' }}>
                    <div className="cl-bubble cl-bubble-me">What has she built with AI?</div>
                    <div className="cl-bubble">She built a résumé assistant and a test-automation agent. Want the details?</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="cl-stats">
            {STATS.map(([value, label]) => <div key={label} className="cl-stat cl-glass"><b>{value}</b><span>{label}</span></div>)}
          </div>
        </section>

        <section id="tour" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">See it in action</p>
          <h2 className="cl-h2">One login. Your whole career.</h2>
          <p className="cl-lead">Take the tour: the designer, AI templates, the resume builder, your AI assistant, the job tracker and the control room.</p>
          <ProductTour />
          <p className="cl-tour-note">Screens are illustrations of the product.</p>
        </section>

        <section id="features" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Everything in one place</p>
          <h2 className="cl-h2">More than a portfolio.</h2>
          <p className="cl-lead">Eight tools that usually live in eight different apps, made to work together.</p>
          <div className="cl-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="cl-feature cl-glass">
                <span className="cl-tile" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${f.color} 70%, white), ${f.color})`, color: f.color }}>
                  <span style={{ color: '#fff', display: 'grid' }}><Icon name={f.icon} size={20} /></span>
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="templates" className="cl-section cl-center">
          <div className="cl-wrap">
            <p className="cl-kicker">Templates</p>
            <h2 className="cl-h2">Start beautiful. Make it yours.</h2>
            <p className="cl-lead">Ready-made looks from calm to bold, and new ones made by AI from a single sentence. Switch any time; your content comes with you.</p>
          </div>
          <div className="cl-marquee">
            <div className="cl-marquee-track">
              {[...TEMPLATES, ...TEMPLATES].map((t, i) => (
                <article key={`${t.name}-${i}`} className="cl-tpl cl-glass" aria-hidden={i >= TEMPLATES.length || undefined}>
                  <div className="cl-tpl-shot" style={{ background: t.bg, color: t.ink, fontFamily: t.serif ? 'Georgia, serif' : undefined }}>
                    {t.top}
                    <i className="cl-t-bar" style={{ width: '36%' }} />
                    <i className="cl-t-bar cl-t-bar-dark" style={{ width: '82%', height: '.75rem' }} />
                    <i className="cl-t-bar cl-t-bar-dark" style={{ width: '58%', height: '.75rem' }} />
                    <span className="cl-tpl-cards"><i /><i /><i /></span>
                  </div>
                  <div className="cl-tpl-meta"><b>{t.name}</b><span className={t.ai ? 'ai' : ''}>{t.ai ? 'Made with AI' : 'Built-in'}</span></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">How it works</p>
          <h2 className="cl-h2">Live in three steps.</h2>
          <ol className="cl-steps" style={{ listStyle: 'none', padding: 0 }}>
            {STEPS.map((s, i) => (
              <li key={s.title} className="cl-step cl-glass">
                <span className="cl-step-n">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Who it’s for</p>
          <h2 className="cl-h2">Made for people with careers to show.</h2>
          <div className="cl-audience">
            {AUDIENCE.map((a) => (
              <article key={a.title} className="cl-aud cl-glass"><h3>{a.title}</h3><p>{a.text}</p></article>
            ))}
          </div>
        </section>

        <section id="founder" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">The founder</p>
          <h2 className="cl-h2">Built by an engineer, for everyone.</h2>
          <div className="cl-founder cl-glass">
            {photo ? <img src={photo} alt={BRAND.founder.name} width={220} height={220} /> : <BrandMark size={140} />}
            <div>
              <span className="cl-badge-role">{BRAND.founder.title}</span>
              <h3>{BRAND.founder.name}</h3>
              {profile?.role && <p className="cl-note" style={{ fontSize: '1rem', marginTop: '.25rem' }}>{profile.role}</p>}
              <blockquote>
                “In Sanskrit, <i lang="sa">kriti</i> (कृति) is the work you create, and <i lang="sa">path</i> (पथ) is the road it opens. A career is more
                than a résumé: your work, your story and your next move belong in one place that looks as good as the work itself.
                {BRAND.name} started as my own portfolio and grew into a platform anyone can use.”
              </blockquote>
              <div className="cl-founder-links">
                <a href="/" className="cl-btn cl-btn-dark">See {firstName}’s portfolio <Icon name="arrowUpRight" size={15} /></a>
                {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer" className="cl-btn cl-btn-glass"><Icon name="linkedin" size={15} /> LinkedIn</a>}
              </div>
            </div>
          </div>
        </section>

        <section id="get-started" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Get started</p>
          <h2 className="cl-h2">Get your {BRAND.name} site.</h2>
          <div className="cl-cta cl-glass">
            <div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.03em' }}>Request access</h3>
              <p className="cl-note" style={{ fontSize: '1rem', marginTop: '.5rem' }}>We’re opening {BRAND.name} to people one by one, so every site gets set up properly.</p>
              <ul>
                {['Your own site, address and private database', 'Every tool on this page included', 'Help moving your existing resume and projects in', 'For yourself, or for a whole team'].map((item) => (
                  <li key={item}><Icon name="check" size={18} />{item}</li>
                ))}
              </ul>
            </div>
            <RequestForm />
          </div>
        </section>
      </main>

      <footer className="cl-footer">
        <div className="cl-wrap cl-footer-row">
          <span className="cl-brand" style={{ fontSize: '.95rem' }}><BrandMark size={20} /><BrandName /></span>
          <nav aria-label="Footer">
            <a href="#features">Features</a><a href="#get-started">Get started</a><a href="/community">Community</a><a href="/login">Sign in</a>
          </nav>
          <span>© {BRAND.founded} {BRAND.name}. Founded by {BRAND.founder.name}.</span>
        </div>
      </footer>
    </div>
  );
}
