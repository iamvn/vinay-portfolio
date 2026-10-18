import { cleanImported, type Imported } from './types';

/**
 * Reads a LinkedIn data export (Settings → Data privacy → Get a copy of your data → the .zip LinkedIn emails you)
 * in the browser: Profile.csv, Positions.csv, Skills.csv, Education.csv and Certifications.csv. No AI involved.
 */

/** Minimal ZIP reader (stored and deflated entries) using the browser's own DecompressionStream. */
async function unzip(file: Blob): Promise<Map<string, string>> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('That isn’t a ZIP file. Upload the .zip LinkedIn emailed you, or a resume PDF.');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const base = name.split('/').pop() ?? name;
    if (!/\.csv$/i.test(base)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = buf.subarray(start, start + size);
    if (method === 0) files.set(base, decoder.decode(data));
    else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      files.set(base, await new Response(stream).text());
    }
  }
  return files;
}

/** CSV rows (quoted fields, commas and new lines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}
/** Rows as objects, starting at the header line that has `must` (LinkedIn puts notes above some headers). */
function records(text: string | undefined, must: string): Record<string, string>[] {
  if (!text) return [];
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const h = rows.findIndex((r) => r.some((v) => v.trim().toLowerCase() === must.toLowerCase()));
  if (h < 0) return [];
  const header = rows[h].map((v) => v.trim());
  return rows.slice(h + 1).map((r) => Object.fromEntries(header.map((k, i) => [k, (r[i] ?? '').trim()])));
}
const pick = (rec: Record<string, string>, ...keys: string[]) => keys.map((k) => rec[k]).find((v) => v?.trim()) ?? '';
const year = (d: string) => Number(/(\d{4})/.exec(d)?.[1] ?? NaN);

export async function readLinkedInExport(file: Blob): Promise<Imported> {
  const files = await unzip(file);
  const get = (name: string) => [...files.entries()].find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  if (!get('Positions.csv') && !get('Profile.csv') && !get('Skills.csv')) {
    throw new Error('This ZIP has no LinkedIn profile files (Profile.csv, Positions.csv, Skills.csv). Request "the works" or "Profile, Positions and Skills" when downloading your data.');
  }
  const profileRow = records(get('Profile.csv'), 'First Name')[0] ?? {};
  const positions = records(get('Positions.csv'), 'Company Name');
  const skills = records(get('Skills.csv'), 'Name').map((r) => r.Name).filter(Boolean);
  const education = records(get('Education.csv'), 'School Name');
  const certs = records(get('Certifications.csv'), 'Name');

  const experience = positions.map((p) => {
    const started = pick(p, 'Started On', 'Start Date'), finished = pick(p, 'Finished On', 'End Date');
    const description = pick(p, 'Description');
    const bullets = description.split(/\n+|(?<=[.!?])\s+(?=[A-Z•\-])/).map((b) => b.replace(/^[\s•\-–*]+/, '').trim()).filter((b) => b.length > 3).slice(0, 8);
    return { role: pick(p, 'Title'), company: pick(p, 'Company Name'), period: `${started || '?'} – ${finished || 'Present'}`, current: !finished, bullets };
  });
  const starts = positions.map((p) => year(pick(p, 'Started On', 'Start Date'))).filter((y) => !Number.isNaN(y));
  const years = starts.length ? Math.max(0, new Date().getFullYear() - Math.min(...starts)) : 0;
  const notes = [
    ...education.map((e) => `Education: ${[pick(e, 'Degree Name'), pick(e, 'School Name')].filter(Boolean).join(', ')}${pick(e, 'Start Date') || pick(e, 'End Date') ? ` (${[pick(e, 'Start Date'), pick(e, 'End Date')].filter(Boolean).join(' – ')})` : ''}`),
    ...certs.map((c) => `Certification: ${[pick(c, 'Name'), pick(c, 'Authority')].filter(Boolean).join(', ')}`),
  ].join('\n');
  return cleanImported({
    profile: {
      name: [pick(profileRow, 'First Name'), pick(profileRow, 'Last Name')].filter(Boolean).join(' '),
      role: pick(profileRow, 'Headline'), location: pick(profileRow, 'Geo Location', 'Location'), summary: pick(profileRow, 'Summary'),
      yearsExperience: years ? `${years}+` : '', assistantNotes: notes,
    },
    experience,
    skills: skills.length ? [{ group: 'Skills', items: skills }] : [],
  });
}
