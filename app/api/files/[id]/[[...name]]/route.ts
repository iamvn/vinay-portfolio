import { BLOCK_BYTES, getAsset, readRange } from '@/lib/assets';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; name?: string[] }> };

// A response stays well under Vercel's 4.5 MB limit; PDF viewers ask for ranges anyway.
const MAX_RANGE = 16 * BLOCK_BYTES; // 4 MB
const notFound = () => new Response('Document not found.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

/**
 * A document from Admin → Projects / Design, public (like project images). Supports Range requests, which
 * the PDF viewer uses to load only the pages it shows. The file name in the address is cosmetic.
 */
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset || asset.status !== 'ready') return notFound();
  const download = new URL(request.url).searchParams.has('download');
  const base = {
    'Content-Type': asset.mimeType,
    'Accept-Ranges': 'bytes',
    // Each upload has its own id, so the bytes behind an address never change.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${asset.fileName.replace(/"/g, '')}"`,
  };

  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${asset.size}` } });
    let start: number, end: number;
    if (!match[1]) { start = Math.max(0, asset.size - Number(match[2])); end = asset.size - 1; } // last N bytes
    else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), asset.size - 1) : asset.size - 1; }
    if (start >= asset.size || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${asset.size}` } });
    end = Math.min(end, start + MAX_RANGE - 1);
    const bytes = await readRange(asset, start, end);
    return new Response(Buffer.from(bytes), { status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${asset.size}`, 'Content-Length': String(bytes.length) } });
  }

  // The whole file (downloads, browsers' own viewer): streamed block by block.
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= asset.size) { controller.close(); return; }
      const end = Math.min(asset.size - 1, offset + MAX_RANGE - 1);
      controller.enqueue(await readRange(asset, offset, end));
      offset = end + 1;
    },
  });
  return new Response(stream, { headers: { ...base, 'Content-Length': String(asset.size) } });
}
