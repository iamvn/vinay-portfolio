import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Reads a job post from its link (Job analyzer). The server fetches the page, so it guards against being
 * pointed at private addresses (localhost, 10.x, 169.254.x metadata…): only public http(s) hosts, every
 * redirect re-checked, 10 s and 3 MB limits. Many sites publish the job as JSON-LD ("JobPosting"), which
 * gives clean fields; otherwise the page's main text is used.
 */

export type FetchedJob = {
  url: string;
  text: string;
  title?: string;
  company?: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  source: 'structured' | 'page';
};

export class JobFetchError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;
// Only for local tests against a mock job board (never in production builds).
const allowPrivate = () => process.env.NODE_ENV !== 'production' && process.env.JOB_FETCH_ALLOW_PRIVATE === '1';

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('ff');
}

async function checkUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new JobFetchError('That doesn’t look like a link. Paste the full address (https://…).'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new JobFetchError('Only http(s) links can be read.');
  if (url.username || url.password) throw new JobFetchError('Links with a username or password can’t be read.');
  if (url.port && !['80', '443'].includes(url.port) && !allowPrivate()) throw new JobFetchError('Links to unusual ports can’t be read.');
  if (allowPrivate()) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new JobFetchError('That address isn’t a public website.');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new JobFetchError('That website could not be found. Check the link.'); });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new JobFetchError('That address isn’t a public website.');
  return url;
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); break; }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

// ---------- HTML → text ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·' };
export const decodeEntities = (text: string) => text
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);

/** Readable text with line breaks from HTML (lists become "- " lines). */
export function htmlToText(html: string) {
  return decodeEntities(html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|section|article|ul|ol|h[1-6]|tr|table|header|footer|blockquote|dd|dt)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const meta = (html: string, name: string) => {
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'));
  return match ? decodeEntities(match[1]).trim() : undefined;
};

type JsonLd = Record<string, unknown>;
function findJobPosting(node: unknown): JsonLd | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const item of node) { const found = findJobPosting(item); if (found) return found; } return null; }
  const record = node as JsonLd;
  const type = record['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return record;
  return findJobPosting(record['@graph']);
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);
function placeOf(location: unknown): string | undefined {
  const list = Array.isArray(location) ? location : [location];
  const places = list.map((item) => {
    const address = (item as JsonLd | undefined)?.address as JsonLd | string | undefined;
    if (typeof address === 'string') return address;
    return [address?.addressLocality, address?.addressRegion, typeof address?.addressCountry === 'string' ? address.addressCountry : (address?.addressCountry as JsonLd | undefined)?.name]
      .filter((part): part is string => typeof part === 'string' && Boolean(part.trim())).join(', ');
  }).filter(Boolean);
  return places.length ? [...new Set(places)].slice(0, 3).join(' / ') : undefined;
}

/** The job from a page's HTML: JSON-LD JobPosting if present, otherwise the page's main text. */
export function parseJobPage(html: string, url: string): FetchedJob {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let json: unknown;
    try { json = JSON.parse(match[1].trim()); } catch { continue; }
    const job = findJobPosting(json);
    if (!job) continue;
    const description = htmlToText(decodeEntities(str(job.description) ?? ''));
    const extra = [str(job.qualifications), str(job.experienceRequirements), str(job.skills), str(job.responsibilities)].filter(Boolean).map((part) => htmlToText(part!));
    const org = job.hiringOrganization as JsonLd | string | undefined;
    const title = str(job.title);
    const text = [title, ...extra.length ? [description, ...extra] : [description]].filter(Boolean).join('\n\n');
    if (text.length < 80) continue;
    return {
      url, source: 'structured', text: text.slice(0, 20_000), title,
      company: typeof org === 'string' ? org : str(org?.name),
      location: placeOf(job.jobLocation),
      remote: job.jobLocationType === 'TELECOMMUTE' || undefined,
      employmentType: Array.isArray(job.employmentType) ? job.employmentType.join(', ') : str(job.employmentType),
    };
  }
  // No structured data: the main part of the page.
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article[\s\S]*?<\/article>/i)?.[0]
    ?? html.replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ');
  const body = main.match(/<body[\s\S]*<\/body>/i)?.[0] ?? main;
  const text = htmlToText(body);
  const pageTitle = meta(html, 'og:title') ?? decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  return { url, source: 'page', text: text.slice(0, 20_000), title: pageTitle || undefined, company: meta(html, 'og:site_name') };
}

/** Fetches a job post (public http(s) pages only) and returns its text and any structured fields. */
export async function fetchJob(rawUrl: string): Promise<FetchedJob> {
  let url = await checkUrl(rawUrl);
  for (let hop = 0; hop < 5; hop++) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; PortfolioJobReader/1.0)', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en' },
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new JobFetchError(timedOut ? 'The job site took too long to answer. Paste the job text instead.' : 'Could not reach that website. Paste the job text instead.', 502);
    }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      if (!next) break;
      url = await checkUrl(new URL(next, url).toString());
      continue;
    }
    if (response.status === 999 || response.status === 401 || response.status === 403 || response.status === 429) {
      throw new JobFetchError('This site doesn’t allow automatic reading (LinkedIn and some job boards block it). Open the post, copy the text and paste it instead.', 422);
    }
    if (!response.ok) throw new JobFetchError(`The job site answered “${response.status}”. Check the link, or paste the job text instead.`, 422);
    const type = response.headers.get('content-type') ?? '';
    if (!/html|xml|text\/plain|json/i.test(type)) throw new JobFetchError('That link isn’t a web page (maybe a PDF). Paste the job text instead.', 422);
    const body = await readLimited(response);
    const job = /text\/plain/i.test(type) ? { url: url.toString(), source: 'page' as const, text: body.slice(0, 20_000) } : parseJobPage(body, url.toString());
    if (job.text.replace(/\s+/g, ' ').length < 200) {
      throw new JobFetchError('The page had almost no text (it probably loads the job with JavaScript). Paste the job text instead.', 422);
    }
    return job;
  }
  throw new JobFetchError('Too many redirects. Paste the job text instead.', 422);
}
