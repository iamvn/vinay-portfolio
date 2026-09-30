import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encrypts provider API keys before they are stored (AES-256-GCM). The encryption key is derived
 * from AUTH_SECRET, so a copy of the database alone doesn't reveal the API keys.
 * If AUTH_SECRET changes, stored keys can't be decrypted and must be entered again.
 */
function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET is missing or shorter than 32 characters.');
  return createHash('sha256').update(`ai-provider-keys:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

/** The plain key, or null when it can't be decrypted (e.g. AUTH_SECRET changed). */
export function decryptSecret(stored: string): string | null {
  const [version, iv, tag, data] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** "••••1a2b": enough to recognise a key without revealing it. */
export const keyHint = (key: string) => (key.length >= 8 ? `••••${key.slice(-4)}` : '••••');
