/** Addresses of uploaded documents (lib/assets.ts). Safe to use in the browser. */

/** Public address of a document. Each upload gets a new id, so an address never changes content. */
export const assetUrl = (asset: { id: string; fileName: string }) => `/api/files/${asset.id}/${encodeURIComponent(asset.fileName)}`;
const ID = /^[a-f0-9-]{36}$/;
export const isAssetId = (id: unknown): id is string => typeof id === 'string' && ID.test(id);
/** "/api/files/<id>/name.pdf" (or a bare id) → the id; anything else → null. */
export function assetIdFrom(value: unknown): string | null {
  if (isAssetId(value)) return value;
  const match = typeof value === 'string' ? /^\/api\/files\/([a-f0-9-]{36})(\/[^/?#]*)?$/.exec(value) : null;
  return match ? match[1] : null;
}
