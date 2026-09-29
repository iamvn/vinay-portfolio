'use client';

export type ApiIssue = { path: string; message: string };

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: ApiIssue[]) {
    super(message);
  }
}

/** Calls one of the portfolio API routes and returns the parsed JSON (or null for 204). */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth/password')) {
    // Session expired or was revoked (e.g. password changed elsewhere). A full page load is
    // intended here so the server re-checks the (now missing) session cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.hash)}`);
  }
  if (response.status === 204) return null as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error ?? `Request failed (${response.status}).`, response.status, data?.details);
  }
  return data as T;
}

/** Human-readable text for an error thrown by `api`. */
export function describeError(error: unknown) {
  if (error instanceof ApiError) {
    const details = error.details?.map((issue) => `${issue.path}: ${issue.message}`).join(' · ');
    return details ? `${error.message} ${details}` : error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Textarea "one item per line" ⇄ string[] */
export const toLines = (items: string[]) => items.join('\n');
export const fromLines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);
