/**
 * A URL on this site's own address as the visitor opened it. `request.url` can be the server's internal
 * address (e.g. localhost behind the host-based site routing), which would send redirects to the wrong site.
 */
export function urlHere(request: Request, path: string) {
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || new URL(request.url).protocol.replace(':', '');
  return new URL(path, host ? `${proto}://${host}` : request.url);
}
