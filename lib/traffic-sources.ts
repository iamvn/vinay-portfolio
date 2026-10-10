/**
 * Turns a visit's referrer, campaign tags and browser into plain labels for Admin → Insights:
 * where the visitor came from (LinkedIn, Google, ChatGPT, Naukri…), and on what device and browser.
 * Pure functions, safe in the browser and on the server.
 */

export type Medium = 'social' | 'search' | 'ai' | 'jobs' | 'email' | 'chat' | 'code' | 'referral' | 'campaign' | 'direct';

type Rule = { name: string; medium: Medium; hosts: RegExp };

// Order matters: the first match wins (Gemini before Google, LinkedIn's apps, …).
const RULES: Rule[] = [
  { name: 'LinkedIn', medium: 'social', hosts: /(^|\.)linkedin\.(com|cn)$|^lnkd\.in$|^com\.linkedin\.android$/ },
  { name: 'Gemini', medium: 'ai', hosts: /^gemini\.google\.com$|^bard\.google\.com$/ },
  { name: 'ChatGPT', medium: 'ai', hosts: /(^|\.)chatgpt\.com$|^chat\.openai\.com$|^com\.openai\.chatgpt$/ },
  { name: 'Claude', medium: 'ai', hosts: /^claude\.ai$/ },
  { name: 'Perplexity', medium: 'ai', hosts: /(^|\.)perplexity\.ai$/ },
  { name: 'Copilot', medium: 'ai', hosts: /^copilot\.microsoft\.com$/ },
  { name: 'Gmail', medium: 'email', hosts: /^mail\.google\.com$|^com\.google\.android\.gm$/ },
  { name: 'Outlook', medium: 'email', hosts: /^outlook\.(live|office|office365)\.com$/ },
  { name: 'Yahoo Mail', medium: 'email', hosts: /^mail\.yahoo\.com$/ },
  { name: 'Google', medium: 'search', hosts: /(^|\.)google\.[a-z.]+$|^com\.google\.android\.googlequicksearchbox$/ },
  { name: 'Bing', medium: 'search', hosts: /(^|\.)bing\.com$/ },
  { name: 'DuckDuckGo', medium: 'search', hosts: /(^|\.)duckduckgo\.com$/ },
  { name: 'Yahoo', medium: 'search', hosts: /(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/ },
  { name: 'Yandex', medium: 'search', hosts: /(^|\.)yandex\.[a-z.]+$/ },
  { name: 'Baidu', medium: 'search', hosts: /(^|\.)baidu\.com$/ },
  { name: 'Ecosia', medium: 'search', hosts: /(^|\.)ecosia\.org$/ },
  { name: 'Brave Search', medium: 'search', hosts: /^search\.brave\.com$/ },
  { name: 'GitHub', medium: 'code', hosts: /(^|\.)github\.(com|io)$/ },
  { name: 'GitLab', medium: 'code', hosts: /(^|\.)gitlab\.com$/ },
  { name: 'Stack Overflow', medium: 'code', hosts: /(^|\.)stackoverflow\.com$/ },
  { name: 'X (Twitter)', medium: 'social', hosts: /^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/ },
  { name: 'Facebook', medium: 'social', hosts: /(^|\.)facebook\.com$|^fb\.(com|me)$/ },
  { name: 'Instagram', medium: 'social', hosts: /(^|\.)instagram\.com$/ },
  { name: 'Threads', medium: 'social', hosts: /(^|\.)threads\.net$/ },
  { name: 'Reddit', medium: 'social', hosts: /(^|\.)reddit\.com$|^redd\.it$/ },
  { name: 'YouTube', medium: 'social', hosts: /(^|\.)youtube\.com$|^youtu\.be$/ },
  { name: 'Medium', medium: 'social', hosts: /(^|\.)medium\.com$/ },
  { name: 'DEV', medium: 'social', hosts: /^dev\.to$/ },
  { name: 'Hacker News', medium: 'social', hosts: /^news\.ycombinator\.com$/ },
  { name: 'Product Hunt', medium: 'social', hosts: /(^|\.)producthunt\.com$/ },
  { name: 'Pinterest', medium: 'social', hosts: /(^|\.)pinterest\.[a-z.]+$|^pin\.it$/ },
  { name: 'Behance', medium: 'social', hosts: /(^|\.)behance\.net$/ },
  { name: 'Dribbble', medium: 'social', hosts: /(^|\.)dribbble\.com$/ },
  { name: 'WhatsApp', medium: 'chat', hosts: /(^|\.)whatsapp\.com$|^wa\.me$|^com\.whatsapp$/ },
  { name: 'Telegram', medium: 'chat', hosts: /^t\.me$|(^|\.)telegram\.(org|me)$/ },
  { name: 'Slack', medium: 'chat', hosts: /(^|\.)slack\.com$/ },
  { name: 'Discord', medium: 'chat', hosts: /(^|\.)discord(app)?\.com$/ },
  { name: 'Microsoft Teams', medium: 'chat', hosts: /^teams\.(microsoft|live)\.com$/ },
  { name: 'Naukri', medium: 'jobs', hosts: /(^|\.)naukri\.com$/ },
  { name: 'Indeed', medium: 'jobs', hosts: /(^|\.)indeed\.[a-z.]+$/ },
  { name: 'Glassdoor', medium: 'jobs', hosts: /(^|\.)glassdoor\.[a-z.]+$/ },
  { name: 'Wellfound', medium: 'jobs', hosts: /(^|\.)wellfound\.com$|(^|\.)angel\.co$/ },
  { name: 'Foundit', medium: 'jobs', hosts: /(^|\.)foundit\.[a-z.]+$|(^|\.)monsterindia\.com$/ },
  { name: 'Monster', medium: 'jobs', hosts: /(^|\.)monster\.[a-z.]+$/ },
  { name: 'Instahyre', medium: 'jobs', hosts: /(^|\.)instahyre\.com$/ },
  { name: 'Hirist', medium: 'jobs', hosts: /(^|\.)hirist\.(com|tech)$/ },
  { name: 'Cutshort', medium: 'jobs', hosts: /(^|\.)cutshort\.io$/ },
  { name: 'Dice', medium: 'jobs', hosts: /(^|\.)dice\.com$/ },
  { name: 'ZipRecruiter', medium: 'jobs', hosts: /(^|\.)ziprecruiter\.com$/ },
  { name: 'Workday', medium: 'jobs', hosts: /(^|\.)myworkdayjobs\.com$|(^|\.)workday\.com$/ },
  { name: 'Greenhouse', medium: 'jobs', hosts: /(^|\.)greenhouse\.io$/ },
  { name: 'Lever', medium: 'jobs', hosts: /(^|\.)lever\.co$/ },
  { name: 'Ashby', medium: 'jobs', hosts: /(^|\.)ashbyhq\.com$/ },
];

/** utm_source / ?ref= values people type, mapped to the same names (utm_source=linkedin → LinkedIn). */
const ALIASES: Record<string, string> = {
  linkedin: 'LinkedIn', li: 'LinkedIn', lnkd: 'LinkedIn', google: 'Google', bing: 'Bing', chatgpt: 'ChatGPT', openai: 'ChatGPT',
  claude: 'Claude', perplexity: 'Perplexity', gemini: 'Gemini', github: 'GitHub', twitter: 'X (Twitter)', x: 'X (Twitter)',
  facebook: 'Facebook', fb: 'Facebook', instagram: 'Instagram', ig: 'Instagram', reddit: 'Reddit', youtube: 'YouTube',
  whatsapp: 'WhatsApp', wa: 'WhatsApp', telegram: 'Telegram', slack: 'Slack', discord: 'Discord', naukri: 'Naukri',
  indeed: 'Indeed', glassdoor: 'Glassdoor', wellfound: 'Wellfound', email: 'Email', newsletter: 'Email', gmail: 'Gmail',
  resume: 'Resume', cv: 'Resume', qr: 'QR code', medium: 'Medium', devto: 'DEV', hn: 'Hacker News', producthunt: 'Product Hunt',
};

const MEDIUM_OF = new Map<string, Medium>([...RULES.map((r) => [r.name, r.medium] as const), ['Email', 'email'], ['Resume', 'campaign'], ['QR code', 'campaign']]);

export const MEDIUM_LABELS: Record<Medium, string> = {
  social: 'Social', search: 'Search', ai: 'AI assistants', jobs: 'Job sites', email: 'Email', chat: 'Messaging', code: 'Developer sites',
  referral: 'Other websites', campaign: 'Campaigns', direct: 'Direct',
};

/** Host of a referrer URL (also android-app://com.linkedin.android/), without "www.". '' when there is none. */
export function referrerHost(referrer: string): string {
  if (!referrer) return '';
  try {
    const url = new URL(referrer);
    const host = url.protocol === 'android-app:' ? url.host || url.pathname.replace(/^\/+/, '').split('/')[0] : url.hostname;
    return host.toLowerCase().replace(/^www\./, '').replace(/^(m|l|lm|mobile)\.(?=(facebook|linkedin|twitter|reddit)\.)/, '');
  } catch {
    return '';
  }
}

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 80);

export type Source = { source: string; medium: Medium; host: string };

/**
 * Where a visit came from. Campaign tags win (?utm_source=linkedin, ?ref=resume), then the referring site,
 * then an in-app browser that hides the referrer (LinkedIn's app), else "Direct".
 */
export function classifySource(input: { referrer: string; utmSource?: string; utmMedium?: string; ownHost?: string; userAgent?: string }): Source {
  const host = referrerHost(input.referrer);
  const own = (input.ownHost ?? '').toLowerCase().replace(/^www\./, '').split(':')[0];
  const external = host && host !== own ? host : '';

  const tagged = tidy(input.utmSource ?? '');
  if (tagged) {
    const name = ALIASES[tagged.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? ruleFor(tagged.toLowerCase())?.name ?? tagged;
    const medium = MEDIUM_OF.get(name) ?? (/mail/i.test(input.utmMedium ?? '') ? 'email' : 'campaign');
    return { source: name, medium, host: external };
  }
  if (external) {
    const rule = ruleFor(external);
    return rule ? { source: rule.name, medium: rule.medium, host: external } : { source: external, medium: 'referral', host: external };
  }
  const app = inAppBrowser(input.userAgent ?? '');
  if (app && MEDIUM_OF.has(app)) return { source: app, medium: MEDIUM_OF.get(app)!, host: '' };
  return { source: 'Direct', medium: 'direct', host: '' };
}

const ruleFor = (host: string) => RULES.find((rule) => rule.hosts.test(host));

/** Apps whose built-in browser often hides the referrer; seeing one tells us where the visitor came from. */
function inAppBrowser(ua: string): string {
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/Twitter/i.test(ua)) return 'X (Twitter)';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/Telegram/i.test(ua)) return 'Telegram';
  return '';
}

export type Device = { device: 'Desktop' | 'Mobile' | 'Tablet'; browser: string; os: string };

export function parseUserAgent(ua: string): Device {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'Tablet' : /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua) ? 'Mobile' : 'Desktop';
  const app = inAppBrowser(ua);
  const browser = app ? `${app} app`
    : /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Brave/.test(ua) ? 'Brave'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome|CriOS/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : 'Other';
  const os = /Windows/.test(ua) ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Other';
  return { device, browser, os };
}

/** Crawlers, link previews and test tools: never counted. */
export const isBot = (ua: string) => !ua || /bot|crawl|spider|slurp|preview|fetch|headless|lighthouse|pagespeed|monitor|uptime|curl|wget|python|axios|node-fetch|go-http|java\/|facebookexternalhit|embedly|quora link|vercel/i.test(ua);
