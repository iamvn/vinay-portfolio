/**
 * Optional: adds/removes a site's address on the Vercel project automatically (Vercel REST API).
 * Needs VERCEL_API_TOKEN (vercel.com → Account Settings → Tokens) and VERCEL_PROJECT (project name or id);
 * VERCEL_TEAM_ID only if the project belongs to a team. Without them, add domains in Vercel → Domains yourself.
 */
const API = process.env.VERCEL_API_URL?.trim() || 'https://api.vercel.com'; // override only for tests

export const vercelApiConfigured = () => Boolean(process.env.VERCEL_API_TOKEN?.trim() && process.env.VERCEL_PROJECT?.trim());

function url(path: string) {
  const team = process.env.VERCEL_TEAM_ID?.trim();
  return `${API}${path}${team ? `?teamId=${encodeURIComponent(team)}` : ''}`;
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
  if (response.status === 409) return { ok: false, message: `${domain} is already used by another Vercel project or account. Try another address.` };
  return { ok: false, message: `Vercel: ${message}` };
}

export async function removeProjectDomain(domain: string) {
  await fetch(url(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`), { method: 'DELETE', headers: headers() }).catch(() => null);
}
