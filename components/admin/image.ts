'use client';

/**
 * Shrinks photos in the browser before upload. Phone photos are often 2–6 MB (and iPhones
 * may hand over HEIC); the server accepts JPEG/PNG/WebP up to 2 MB. Anything larger than
 * ~900 KB, or not already JPEG/PNG/WebP, is redrawn at most 1600px wide as a JPEG.
 * If the browser can't decode the file, it's returned unchanged and the server decides.
 */
const MAX_SIDE = 1600;
const KEEP_BELOW = 900 * 1024;
const WEB_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function prepareImage(file: File): Promise<File> {
  if (file.size <= KEEP_BELOW && WEB_TYPES.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#0b1220'; // background for transparent PNGs (JPEG has no transparency)
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** `accept` value that lets phones offer the photo library and the camera. */
export const IMAGE_ACCEPT = 'image/*';
