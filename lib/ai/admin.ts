import { z } from 'zod';
import { decryptSecret } from './crypto';
import { PROVIDER_KINDS } from './providers';

type ProviderRow = {
  id: number; name: string; kind: string; baseUrl: string; model: string; keyCipher: string; keyHint: string;
  enabled: boolean; order: number; temperature: string; createdAt: string;
};

/** What the admin panel sees: never the key itself. */
export function publicProvider(row: ProviderRow) {
  const keyStatus = !row.keyCipher ? 'missing' : decryptSecret(row.keyCipher) === null ? 'unreadable' : 'ok';
  return {
    id: row.id, name: row.name, kind: row.kind, baseUrl: row.baseUrl, model: row.model,
    keyHint: row.keyHint, keyStatus, enabled: row.enabled, order: row.order,
    temperature: row.temperature === '' ? null : Number(row.temperature), createdAt: row.createdAt,
  };
}

const url = z.string().trim().max(300).refine((value) => value === '' || /^https?:\/\/[^\s]+$/i.test(value), 'must be a full URL starting with https://');
const temperature = z.union([z.number().min(0).max(2), z.null()]);

export const providerCreateSchema = z.object({
  name: z.string().trim().min(1, 'must not be empty').max(60),
  kind: z.enum(PROVIDER_KINDS),
  baseUrl: url,
  model: z.string().trim().min(1, 'must not be empty').max(150),
  apiKey: z.string().trim().min(8, 'looks too short').max(1000),
  enabled: z.boolean().optional().default(true),
  temperature: temperature.optional().default(null),
}).strict().superRefine((value, ctx) => {
  if (value.kind !== 'anthropic' && !value.baseUrl) ctx.addIssue({ code: 'custom', path: ['baseUrl'], message: 'is required for this provider type' });
});

/** PATCH: any subset; send apiKey only to replace the stored key. */
export const providerPatchSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(PROVIDER_KINDS),
  baseUrl: url,
  model: z.string().trim().min(1).max(150),
  apiKey: z.string().trim().min(8, 'looks too short').max(1000),
  enabled: z.boolean(),
  temperature,
}).partial().strict();

export const temperatureToColumn = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));
