import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FmpTour } from '@/components/find-my-product/tour';
import { Icon } from '@/components/icons';
import { BRAND } from '@/lib/brand';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/seo';
import { currentSite } from '@/lib/sites/context';
import '../kritipath/kritipath.css';
import './fmp.css';

export const dynamic = 'force-dynamic';

/** The live app. Every "try it" button on this page goes here. */
const APP = 'https://find-my-product-chi.vercel.app';
const NAME = 'Find My Product';
const PATH = '/find-my-product';
const TAGLINE = 'Ask the shops near you. Get prices in minutes.';
const DESCRIPTION =
  'Tell nearby shops what you need. They reply with price and stock. Pick one, pick it up or get it delivered. Free during the Pune pilot, in English and Hindi.';

const TITLE = `${NAME}: ${TAGLINE}`;
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: NAME,
  authors: [{ name: BRAND.founder.name, url: SITE_URL }],
  creator: BRAND.founder.name,
  alternates: { canonical: `${SITE_URL}${PATH}` },
  openGraph: { type: 'website', siteName: NAME, title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${PATH}` },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const Tile = ({ icon, color }: { icon: string; color: string }) => (
  <span className="cl-tile" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 70%, white), ${color})`, color }}>
    <span style={{ color: '#fff', display: 'grid' }}><Icon name={icon} size={20} /></span>
  </span>
);

const Mark = ({ size = 26 }: { size?: number }) => (
  <span className="fm-brandmark" style={{ width: size, height: size, fontSize: size * 0.6 }} aria-hidden="true">⌕</span>
);

const STATS: [string, string][] = [
  ['2–10 km', 'you choose how far to ask'],
  ['4 stock levels', 'now, by evening, tomorrow, alternative'],
  ['EN · हिंदी', 'the whole app, alerts included'],
  ['₹0', 'free for customers and shops in the pilot'],
];

const SCATTERED = [
  { label: 'Shop no. 1', note: '“Nahi hai, kal aana”', rot: -4 },
  { label: 'Shop no. 2', note: 'shutter down for lunch', rot: 3 },
  { label: 'Online', note: 'delivery in 2 days', rot: -2 },
  { label: 'Six phone calls', note: 'three didn’t pick up', rot: 5 },
  { label: 'Maps listing', note: 'open, but is it in stock?', rot: -5 },
  { label: 'Society WhatsApp group', note: '“anyone knows a shop?”', rot: 2 },
];

const PAINS = [
  { title: 'You walk shop to shop', text: 'For a charger, a cable or a bulb, the only way to know who has it is to go and ask. Half an hour for a ₹300 item.' },
  { title: 'The price is a guess', text: 'Every counter quotes differently, and you never know if the next shop would have been cheaper or had it ready.' },
  { title: 'Shops miss real customers', text: 'The shop two streets away had it in stock all along. It just never knew someone nearby was looking.' },
];

const NOT_IS: [string, string][] = [
  ['an online store', 'We don’t hold stock or take payment. You buy from the shop, at the shop’s price.'],
  ['a delivery app', 'Shops deliver themselves if they choose to. Most people simply walk over and pick it up.'],
  ['a shop directory', 'Listings don’t tell you what’s on the shelf today. Here the shop answers your exact question.'],
  ['a WhatsApp group', 'Requests go only to shops that sell that category, within the distance you chose.'],
];

const INPUTS = ['What you need (or a photo)', 'Category', 'Your location', 'Pickup or delivery'];
const OUTPUTS: { icon: string; color: string; title: string; text: string }[] = [
  { icon: 'bell', color: '#ff375f', title: 'Loud alert to shops', text: 'Only matching shops nearby' },
  { icon: 'bolt', color: '#ff9f0a', title: 'Quotes with stock', text: 'Price, when, delivery fee' },
  { icon: 'chart', color: '#30d158', title: 'Live comparison', text: 'Sorted by price and distance' },
  { icon: 'chat', color: '#5e5ce6', title: 'Chat with the shop', text: 'Numbers stay private' },
  { icon: 'check', color: '#0a84ff', title: 'Pickup code', text: '4 digits at the counter' },
  { icon: 'star', color: '#ffd60a', title: 'Verified reviews', text: 'Only after a real pickup' },
];

const LOOP = [
  { n: 'Ask', text: 'Type it or snap it. Choose 2, 5 or 10 km, or ask one shop directly.' },
  { n: 'Ring', text: 'Shops that sell that category hear a loud alert on their phone.' },
  { n: 'Quote', text: 'They reply with a price and when it’s ready, in about ten seconds.' },
  { n: 'Pick', text: 'Compare live and accept, for pickup or home delivery.' },
  { n: 'Collect', text: 'Show your 4-digit code, take the item, rate the shop.' },
];

const FEATURES: { icon: string; color: string; title: string; text: string }[] = [
  { icon: 'bell', color: '#ff375f', title: 'An alarm shops can’t miss', text: 'A siren in the app and a sticky notification on the lock screen, so a request rings like an order.' },
  { icon: 'pulse', color: '#30d158', title: 'Quotes, live', text: 'Prices appear on your screen the moment shops reply, with a chime and a pop-up on any page.' },
  { icon: 'home', color: '#ff9f0a', title: 'Pickup or delivery', text: 'Say how you want it; each shop says if it delivers and what it charges.' },
  { icon: 'check', color: '#0a84ff', title: 'A code for every order', text: 'A 4-digit code proves the right person collected it, at the counter or the door.' },
  { icon: 'chat', color: '#5e5ce6', title: 'Private chat', text: 'Ask about the model or the timing in the app. Phone numbers typed into chat are hidden.' },
  { icon: 'sparkle', color: '#bf5af2', title: 'Flash deals', text: 'Shops post a counter deal in ten seconds; followers and recent customers nearby get an alert.' },
  { icon: 'grid', color: '#64d2ff', title: 'A QR sticker per shop', text: 'Every shop gets its own QR automatically. Customers scan it to see the shop and ask it directly.' },
  { icon: 'globe', color: '#00c7be', title: 'English and हिंदी', text: 'One tap switches the whole app, and alerts arrive in each person’s own language.' },
  { icon: 'download', color: '#ac8e68', title: 'An app without an app store', text: 'Add it to the home screen on Android or iPhone. It opens like an app and gets alerts.' },
  { icon: 'users', color: '#e8590c', title: 'Run by people, not bots', text: 'An admin portal with permissions, activity log, feedback, traffic monitor and data clean-up.' },
];

const SHOP_STEPS = [
  { title: 'Scan your sticker', text: 'Sign up from the QR at your counter in about ten seconds, standing inside the shop so customers nearby can reach you.' },
  { title: 'Hear every customer', text: 'Turn on alerts once. When someone close by asks for something you sell, your phone rings.' },
  { title: 'Win the order', text: 'Send a price, hand over the item when they show their code, and collect reviews that bring the next customer.' },
];

const WHY_NOW = [
  { icon: 'rocket', title: 'Everyone expects it today', text: 'Quick commerce taught people that waiting two days is optional. The shop down the road can do it in twenty minutes, if you know it has the item.' },
  { icon: 'building', title: 'The stock is already local', text: 'Small electronics and mobile shops carry exactly what people need in a hurry. What they lack is a way to be asked.' },
  { icon: 'cpu', title: 'Phones are finally enough', text: 'Location, push alerts and home-screen apps now work in the browser on Android and iPhone. No app store, no download, no cost to run.' },
];

const DIFFERENT = [
  { icon: 'pin', title: 'Local first', text: 'Requests never travel past the distance you chose, and only reach shops that sell that category.' },
  { icon: 'database', title: 'Private by design', text: 'Shops see your area, not your exact location. The admin decides whether names, numbers and call buttons are shown.' },
  { icon: 'bolt', title: 'Free to run', text: 'Alerts use web push, not paid SMS. WhatsApp alerts are built in, behind a switch, for when the pilot grows.' },
  { icon: 'users', title: 'For the whole market', text: 'Customers, shopkeepers and admins each get their own app, with roles and permissions set by one owner.' },
];

const LIVE = [
  'Requests to all nearby shops or one shop', 'Category matching: mobile & electronics', 'Loud alarm and lock-screen alerts for shops', 'Quotes with stock level and timing',
  'Pickup or home delivery with fees', '4-digit pickup and delivery code', 'In-app chat with hidden phone numbers', 'Flash deals and shop followers',
  'Automatic QR sticker for every shop', 'English and Hindi, alerts included', 'Admin portal: roles, activity, monitor, database', 'Help & support, feedback, verified reviews',
];

const AUDIENCE = [
  { title: 'Customers', text: 'Get the thing you need today, from a shop you can walk to, at a price you’ve compared, without making six calls.' },
  { title: 'Shopkeepers', text: 'Hear from customers who are already looking, a few streets away. Answer from the counter in seconds.' },
  { title: 'Markets & associations', text: 'Run a whole street or area: onboard shops, set who sees what, and watch demand as it happens.' },
];

const FAQ: [string, string][] = [
  ['Is it free?', 'Yes. During the Pune pilot it’s free for customers and for shops. There’s no commission on what you buy.'],
  ['Do I pay in the app?', 'No. You pay the shop directly, at the counter or on delivery, the way you always have.'],
  ['Do shops see my phone number?', 'Not by default. Shops see your area, never your exact location, and the admin decides whether names, numbers and call buttons are shown. Chat hides numbers typed into messages.'],
  ['Do I need to install anything?', 'No download is needed. Open it in Chrome or Safari, and add it to your home screen if you want alerts like an app. On iPhone, alerts need iOS 16.4 or newer.'],
  ['Is it available in Hindi?', 'Yes. Tap EN | हिं at the top of any page. Everything switches, and your alerts arrive in the language you chose.'],
  ['I own a shop. How do I join?', 'Scan the Find My Product QR sticker at your counter, or open the app and sign up as a shop. Our team in Pune can also add you.'],
];

const LINKEDIN = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i;

/** Find My Product: what it does, how a request works, and how to try it. Main site only. */
export default async function FindMyProductPage() {
  const site = await currentSite();
  if (!site.isMain) redirect('/');
  const profile = await prisma.profile.findUnique({ where: { id: 1 }, select: { role: true, profileImage: true, socialLinks: true } }).catch(() => null);
  let linkedin = '';
  try { linkedin = String((JSON.parse(profile?.socialLinks ?? '{}') as Record<string, unknown>).linkedin ?? ''); } catch { /* none */ }
  if (!LINKEDIN.test(linkedin)) linkedin = '';
  const photo = profile?.profileImage && /^(\/|https:\/\/)/.test(profile.profileImage) ? profile.profileImage : '';
  const firstName = BRAND.founder.name.split(' ')[0];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: NAME,
    url: APP,
    applicationCategory: 'ShoppingApplication',
    operatingSystem: 'Web, Android, iOS',
    description: DESCRIPTION,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    author: { '@type': 'Person', name: BRAND.founder.name, url: SITE_URL },
  };

  return (
    <div className="cl-page fm-page">
      <div className="cl-aurora" aria-hidden="true" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="cl-nav">
        <div className="cl-wrap">
          <div className="cl-nav-bar cl-glass">
            <a href="#top" className="cl-brand" aria-label={`${NAME} home`}><Mark /><span>{NAME}</span></a>
            <nav className="cl-nav-links" aria-label="Page sections">
              <a href="#problem">Problem</a><a href="#how-it-works">How it works</a><a href="#tour">Product</a><a href="#shops">For shops</a><a href="#why-now">Why now</a><a href="#faq">FAQ</a>
            </nav>
            <a href={APP} className="cl-btn cl-btn-dark">Open the app</a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="cl-hero cl-wrap">
          <span className="cl-eyebrow cl-glass"><span className="cl-dot" aria-hidden="true" />{NAME} · Live in India · Free pilot</span>
          <h1 className="cl-h1">Need it today?<br /><span className="cl-gradient">Ask the shops near you.</span></h1>
          <p className="cl-lead">
            Tell nearby shops what you need. Their phones ring, they reply with a price and whether it’s on the shelf, and you pick the best
            one. Walk over and collect it, or have it delivered.
          </p>
          <div className="cl-hero-ctas">
            <a href={`${APP}/request/new`} className="cl-btn cl-btn-dark cl-btn-lg">Ask nearby shops</a>
            <a href={`${APP}/login?next=/merchant/onboard`} className="cl-btn cl-btn-glass cl-btn-lg">I own a shop <Icon name="arrowUpRight" size={16} /></a>
          </div>

          {/* An illustration of a request and its quotes, not a screenshot. */}
          <div className="cl-preview cl-glass fm-hero-preview" aria-hidden="true">
            <div className="fm-hero-grid">
              <div className="fm-hero-card cl-glass">
                <span className="fm-k">Customer · Kothrud</span>
                <b className="fm-big">65W Type-C charger for Vivo V40</b>
                <div className="fm-chips"><i>📱 Mobile &amp; Accessories</i><i>📣 All shops · 2 km</i><i>🏪 Pickup</i></div>
                <div className="fm-sent"><span className="cl-dot" />Sent to 6 shops · quotes appear live</div>
              </div>
              <div className="fm-hero-card cl-glass fm-quotes">
                <div className="fm-q"><span>🏪</span><div><b>Sharma Mobiles</b><small>650 m · ★ 4.6</small></div><em className="fm-ok">In stock</em><b>₹649</b></div>
                <div className="fm-q"><span>🏪</span><div><b>Galaxy Electronics</b><small>1.4 km · ★ 4.2</small></div><em className="fm-eve">By evening</em><b>₹699</b></div>
                <div className="fm-q"><span>🏪</span><div><b>City Mobile Point</b><small>2.1 km · new</small></div><em className="fm-ok">In stock</em><b>₹720</b></div>
              </div>
              <div className="fm-hero-card cl-glass fm-ring">
                <span className="fm-bell">🔔</span>
                <div><b>New request: 65W Type-C charger</b><small>650 m away · wants pickup · tap to send your price</small></div>
              </div>
            </div>
          </div>
          <div className="cl-stats">
            {STATS.map(([value, label]) => <div key={label} className="cl-stat cl-glass"><b>{value}</b><span>{label}</span></div>)}
          </div>
        </section>

        <section id="problem" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">The problem</p>
          <h2 className="cl-h2">A ₹300 charger<br />shouldn’t take an hour.</h2>
          <p className="cl-lead">The shop that has it is probably within walking distance. Finding it is the hard part.</p>
          <div className="cl-scatter" aria-label="How people look for things today">
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

        <section id="what" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">What we’re building</p>
          <h2 className="cl-h2">The street’s shops, one question away.</h2>
          <p className="cl-lead">
            {NAME} is a <b style={{ color: 'var(--cl-ink)' }}>request line to your local market</b>: you ask once, the right shops nearby
            answer, and you buy from them the way you always have.
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

        <section id="how-it-works" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">How it works</p>
          <h2 className="cl-h2">One request. Every shop nearby.</h2>
          <p className="cl-lead">You describe it once. The right shops hear about it, answer, and the whole order runs through the app.</p>
          <div className="cl-flow">
            <ul className="cl-flow-in" aria-label="What you send">
              {INPUTS.map((i) => <li key={i} className="cl-glass">{i}</li>)}
            </ul>
            <span className="cl-flow-arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span>
            <div className="cl-flow-core">
              <span className="cl-flow-core-k">Your request</span>
              <b>Matched to nearby shops</b>
              <span>Category · distance · pickup or delivery</span>
            </div>
            <span className="cl-flow-arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span>
            <ul className="cl-flow-out" aria-label="What happens next">
              {OUTPUTS.map((o) => (
                <li key={o.title} className="cl-glass"><Tile icon={o.icon} color={o.color} /><span><b>{o.title}</b><small>{o.text}</small></span></li>
              ))}
            </ul>
          </div>

          <h3 className="cl-h3">From question to counter</h3>
          <ol className="cl-loop">
            {LOOP.map((s, i) => (
              <li key={s.n} className="cl-glass"><span className="cl-step-n">{i + 1}</span><b>{s.n}</b><p>{s.text}</p></li>
            ))}
          </ol>
          <p className="cl-note" style={{ marginTop: '1rem' }}>Every completed order earns the shop a verified review, and the next customer a better choice.</p>
        </section>

        <section id="tour" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">See it in action</p>
          <h2 className="cl-h2">One request, start to finish.</h2>
          <p className="cl-lead">Follow a phone charger from the customer’s question to the shop’s counter, and the control room behind it.</p>
          <FmpTour />
          <p className="cl-tour-note">Screens are illustrations of the product. Shop names are examples.</p>
        </section>

        <section id="features" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Everything in one place</p>
          <h2 className="cl-h2">More than a search box.</h2>
          <p className="cl-lead">Ten pieces that make a local request actually end in a sale.</p>
          <div className="cl-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="cl-feature cl-glass">
                <Tile icon={f.icon} color={f.color} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="shops" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">For shopkeepers</p>
          <h2 className="cl-h2">Customers from your own street.</h2>
          <p className="cl-lead">People nearby are already looking for what’s on your shelf. {NAME} makes sure they ask you.</p>
          <div className="cl-steps">
            {SHOP_STEPS.map((s, i) => (
              <article key={s.title} className="cl-step cl-glass"><span className="cl-step-n">{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></article>
            ))}
          </div>
          <div className="fm-shop-cta">
            <a href={`${APP}/login?next=/merchant/onboard`} className="cl-btn cl-btn-dark cl-btn-lg">Add my shop, free</a>
          </div>
        </section>

        <section id="why-now" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Why now</p>
          <h2 className="cl-h2">Shopping got faster. Local shops didn’t.</h2>
          <div className="cl-audience">
            {WHY_NOW.map((w) => (
              <article key={w.title} className="cl-aud cl-glass"><Tile icon={w.icon} color="#e8590c" /><h3 style={{ marginTop: '1rem' }}>{w.title}</h3><p>{w.text}</p></article>
            ))}
          </div>
        </section>

        <section id="different" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Why {NAME}</p>
          <h2 className="cl-h2">Built for the street, on purpose.</h2>
          <div className="cl-grid">
            {DIFFERENT.map((d) => (
              <article key={d.title} className="cl-feature cl-glass"><Tile icon={d.icon} color="#0a84ff" /><h3>{d.title}</h3><p>{d.text}</p></article>
            ))}
          </div>
        </section>

        <section id="live" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Not a mockup</p>
          <h2 className="cl-h2">Already built. Already live.</h2>
          <p className="cl-lead">Everything below is running today in the Pune pilot, with real shops and real customers.</p>
          <ul className="cl-live cl-glass">
            {LIVE.map((l) => <li key={l}><span className="cl-dot" aria-hidden="true" />{l}</li>)}
          </ul>
        </section>

        <section className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Who it’s for</p>
          <h2 className="cl-h2">Everyone on the street.</h2>
          <div className="cl-audience">
            {AUDIENCE.map((a) => <article key={a.title} className="cl-aud cl-glass"><h3>{a.title}</h3><p>{a.text}</p></article>)}
          </div>
        </section>

        <section id="vision" className="cl-section cl-wrap cl-center">
          <div className="cl-vision">
            <p className="cl-kicker" style={{ color: '#ffb4a0' }}>Where this goes</p>
            <h2 className="cl-h2">Every shop on the street, one question away.</h2>
            <p>
              Today it’s chargers, cables and bulbs in Pune. Tomorrow it’s any market in any city: the hardware lane, the medical store, the
              stationery shop near the school. The stock is already there. {NAME} is how people find it, and how the shops that keep it
              win against the warehouse two days away.
            </p>
            <p className="cl-vision-line">Kisi bhi cheez ke liye · पास की दुकान से पूछो</p>
          </div>
        </section>

        <section id="founder" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">The founder</p>
          <h2 className="cl-h2">Built in Pune, for local shops.</h2>
          <div className="cl-founder cl-glass">
            {photo ? <img src={photo} alt={BRAND.founder.name} width={220} height={220} /> : <Mark size={140} />}
            <div>
              <span className="cl-badge-role">{BRAND.founder.title}</span>
              <h3>{BRAND.founder.name}</h3>
              {profile?.role && <p className="cl-note" style={{ fontSize: '1rem', marginTop: '.25rem' }}>{profile.role}</p>}
              <blockquote>
                “Most of what people need in a hurry is already on a shelf a few streets away. {NAME} is one question, sent to every
                counter nearby, in the language the shopkeeper speaks, so the local shop wins the sale.”
              </blockquote>
              <div className="cl-founder-links">
                <Link href="/" className="cl-btn cl-btn-dark">See {firstName}’s portfolio <Icon name="arrowUpRight" size={15} /></Link>
                {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer" className="cl-btn cl-btn-glass"><Icon name="linkedin" size={15} /> LinkedIn</a>}
              </div>
            </div>
          </div>
        </section>

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

        <section id="get-started" className="cl-section cl-wrap cl-center">
          <p className="cl-kicker">Get started</p>
          <h2 className="cl-h2">Try it on your phone, now.</h2>
          <div className="fm-start">
            <article className="cl-cta cl-glass fm-start-card">
              <div>
                <Tile icon="search" color="#e8590c" />
                <h3>I need something</h3>
                <ul>
                  {['Ask every shop within 2, 5 or 10 km', 'Compare prices and stock live', 'Pick up with a code, or get it delivered'].map((item) => (
                    <li key={item}><Icon name="check" size={18} />{item}</li>
                  ))}
                </ul>
              </div>
              <a href={`${APP}/request/new`} className="cl-btn cl-btn-dark cl-btn-lg">Ask nearby shops</a>
            </article>
            <article className="cl-cta cl-glass fm-start-card">
              <div>
                <Tile icon="building" color="#0a84ff" />
                <h3>I own a shop</h3>
                <ul>
                  {['Sign up in about ten seconds', 'Hear every nearby request in your category', 'Free during the pilot, no commission'].map((item) => (
                    <li key={item}><Icon name="check" size={18} />{item}</li>
                  ))}
                </ul>
              </div>
              <a href={`${APP}/login?next=/merchant/onboard`} className="cl-btn cl-btn-glass cl-btn-lg">Add my shop <Icon name="arrowUpRight" size={16} /></a>
            </article>
          </div>
        </section>
      </main>

      <footer className="cl-footer">
        <div className="cl-wrap cl-footer-row">
          <span className="cl-brand" style={{ fontSize: '.95rem' }}><Mark size={20} /><span>{NAME}</span></span>
          <nav aria-label="Footer">
            <a href="#what">What we’re building</a><a href="#shops">For shops</a><a href="#faq">FAQ</a><a href={APP}>Open the app</a><Link href="/">{firstName}’s portfolio</Link>
          </nav>
          <span>© {new Date().getFullYear()} {NAME}. Built by {BRAND.founder.name}.</span>
        </div>
      </footer>
    </div>
  );
}
