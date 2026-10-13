/**
 * Optional: adds/removes a site's address on the Vercel project automatically (Vercel REST API).
 * Needs VERCEL_API_TOKEN (vercel.com → Account Settings → Tokens) and VERCEL_PROJECT (project name or id);
 * VERCEL_TEAM_ID only if the project belongs to a team. Without them, add domains in Vercel → Domains yourself.
 */
const API = process.env.VERCEL_API_URL?.trim() || 'https://api.vercel.com'; // override only for tests

export const vercelApiConfigured = () => Boolean(process.env.VERCEL_API_TOKEN?.trim() && process.env.VERCEL_PROJECT?.trim());

function url(path: string) {
  const team = process.env.VERCEL_TEAM_ID?.trim();
  return `${API}${path}${team ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(team)}` : ''}`;
}
const headers = () => ({ Authorization: `Bearer ${process.env.VERCEL_API_TOKEN!.trim()}`, 'Content-Type': 'application/json' });
const project = () => encodeURIComponent(process.env.VERCEL_PROJECT!.trim());

/** Adds a domain to the project. ok: true also when it's already on this project. */
export async function addProjectDomain(domain: string): Promise<{ ok: boolean; message?: string }> {
  const response = await fetch(url(`/v10/projects/${project()}/domains`), { method: 'POST', headers: headers(), body: JSON.stringify({ name: domain }) });
  if (response.ok) return { ok: true };
  const body = await response.json().catch(() => ({}));
  const message: string = body?.error?.message ?? `Vercel answered ${response.status}`;
  if (response.status === 400 && /already/i.test(message)) return { ok: true }; // already on this project
  // Vercel can also answer 409 "already in use" for a domain that is on THIS project (e.g. a site's address
  // being set again after the list of sites was rebuilt). Only a domain on another project is a real conflict.
  const own = await fetch(url(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`), { headers: headers() }).catch(() => null);
  if (own?.ok) return { ok: true };
  if (response.status === 409) return { ok: false, message: `${domain} is already used by another Vercel project or account. Try another address.` };
  return { ok: false, message: `Vercel: ${message}` };
}

export async function removeProjectDomain(domain: string) {
  await fetch(url(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`), { method: 'DELETE', headers: headers() }).catch(() => null);
}

/** Every domain on the project (names only), e.g. ["vinay-bharti.vercel.app", "harish-c.vercel.app"]. */
export async function listProjectDomains(): Promise<string[]> {
  const names: string[] = [];
  let until: number | undefined;
  for (let page = 0; page < 10; page++) {
    const response = await fetch(url(`/v9/projects/${project()}/domains?limit=100${until ? `&until=${until}` : ''}`), { headers: headers() });
    if (!response.ok) throw new Error(`Vercel: could not list the project's domains (${response.status}).`);
    const body = await response.json().catch(() => ({}));
    for (const d of body?.domains ?? []) if (typeof d?.name === 'string') names.push(d.name.toLowerCase());
    until = body?.pagination?.next ?? undefined;
    if (!until) break;
  }
  return [...new Set(names)];
}
