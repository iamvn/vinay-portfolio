'use client';

export type ApiIssue = { path: string; message: string };

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: ApiIssue[]) {
    super(message);
  }
}

// How many API calls are running right now: the admin panel shows a progress bar while it's above 0.
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
export const pendingRequests = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => pending,
};

/**
 * Browser cache for GET calls, so switching tabs (Profile → Experience → Profile) shows the data at once
 * instead of asking the server again. It only lives in this browser tab's memory and stays correct because:
 *   - any change made from this browser (POST/PUT/PATCH/DELETE) clears it, in every open admin tab;
 *   - entries expire after a few minutes (or sooner for live numbers), in case someone else edits;
 *   - coming back to the tab after a while clears it too.
 * Pass { fresh: true } to always ask the server (exports, restores).
 */
type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL = 5 * 60_000;
// Numbers that change on their own (visits, AI usage): kept only briefly.
const SHORT_TTL: [RegExp, number][] = [[/^\/api\/(insights|ask|platform\/activity)(\?|$)/, 30_000]];
const ttlFor = (path: string) => SHORT_TTL.find(([pattern]) => pattern.test(path))?.[1] ?? DEFAULT_TTL;
const copy = <T,>(data: T): T => (data === null || typeof data !== 'object' ? data : structuredClone(data));

const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('admin-api-cache') : null;
channel?.addEventListener('message', () => cache.clear());

/** Forget every cached GET (here and in other open admin tabs). Called after any change. */
export function invalidateApiCache() {
  cache.clear();
  channel?.postMessage('invalidate');
}

if (typeof document !== 'undefined') {
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 60_000) cache.clear(); // back after a while: re-check the server
  });
}

/** Calls one of the portfolio API routes and returns the parsed JSON (or null for 204). */
export async function api<T = unknown>(method: string, path: string, body?: unknown, options: { fresh?: boolean } = {}): Promise<T> {
  const isRead = method.toUpperCase() === 'GET';
  if (isRead && !options.fresh) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < ttlFor(path)) return copy(hit.data as T);
    const running = inFlight.get(path); // the same data already on its way (e.g. two tabs asking at once)
    if (running) return copy((await running) as T);
  }
  pending += 1;
  emit();
  const call = request<T>(method, path, body);
  if (isRead) inFlight.set(path, call);
  try {
    const data = await call;
    if (isRead) cache.set(path, { at: Date.now(), data: copy(data) });
    else invalidateApiCache(); // something changed: every cached read may be out of date
    return isRead ? copy(data) : data;
  } catch (error) {
    if (!isRead) invalidateApiCache(); // a failed change may still have changed something
    throw error;
  } finally {
    if (isRead && inFlight.get(path) === call) inFlight.delete(path);
    pending -= 1;
    emit();
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (response.status === 401) cache.clear();
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
