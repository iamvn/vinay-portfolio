import type { PrismaClient } from '@/generated/prisma/client';
import { createClient } from '@libsql/client';
import { mainClient, makeClient } from './db-client';
import { migrate } from './db-migrate';
import { currentSite } from './sites/context';
import type { Site } from './sites/registry';

/**
 * `prisma` used everywhere in the app. Each site has its own database, so every query is sent to the
 * database of the site the current request is for (worked out from the host name; see lib/sites).
 * Code keeps writing `await prisma.profile.findUnique(…)` exactly as before.
 */
type Op = { model?: string; method: string; args: unknown[] };
const OP = Symbol('prisma-op');

const globalCache = globalThis as unknown as { sitePrisma?: Map<string, { client: PrismaClient; key: string; ready: Promise<void> }> };
const clients = globalCache.sitePrisma ?? new Map<string, { client: PrismaClient; key: string; ready: Promise<void> }>();
globalCache.sitePrisma = clients;

/** Brings a site's tables up to date the first time this server uses it (cheap and safe to repeat). */
async function prepare(site: Site) {
  const db = createClient({ url: site.dbUrl, authToken: site.dbToken });
  try { await migrate(db); } finally { db.close(); }
}

export async function clientForSite(site: Site): Promise<PrismaClient> {
  if (site.isMain) return mainClient;
  // A site deleted and created again under the same address must not reuse the old connection.
  const key = `${site.dbUrl}|${site.createdAt}`;
  let entry = clients.get(site.slug);
  if (!entry || entry.key !== key) {
    if (entry) void entry.client.$disconnect().catch(() => null);
    const preparing = prepare(site).catch((error) => { clients.delete(site.slug); throw error; });
    // On Vercel every deploy already upgrades all sites' databases (scripts/deploy-setup.ts) and new sites are
    // set up when created, so a cold server doesn't make the first visitor wait for it: it runs in the background.
    const ready = process.env.VERCEL ? Promise.resolve(void preparing.catch((error) => console.error(error))) : preparing;
    entry = { client: makeClient(site.dbUrl, site.dbToken), key, ready };
    clients.set(site.slug, entry);
  }
  await entry.ready;
  return entry.client;
}

const currentClient = async () => clientForSite(await currentSite());

/** A query that only runs when awaited, and remembers what it was so $transaction([...]) can rebuild it. */
function lazy(run: () => Promise<unknown>, op?: Op) {
  let promise: Promise<unknown> | null = null;
  const go = () => (promise ??= run());
  return {
    [OP]: op,
    then: (resolve?: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => go().then(resolve, reject),
    catch: (reject?: (reason: unknown) => unknown) => go().catch(reject),
    finally: (callback?: () => void) => go().finally(callback),
    [Symbol.toStringTag]: 'PrismaPromise',
  };
}

const call = (client: PrismaClient, op: Op) => {
  const target = (op.model ? (client as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>)[op.model] : client) as Record<string, (...a: unknown[]) => unknown>;
  return target[op.method](...op.args);
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (typeof prop !== 'string' || prop === 'then') return undefined;
    if (prop === '$transaction') {
      return (arg: unknown, options?: unknown) => lazy(async () => {
        const client = await currentClient();
        if (typeof arg === 'function') return client.$transaction(arg as Parameters<PrismaClient['$transaction']>[0] & ((tx: unknown) => Promise<unknown>), options as never);
        const ops = (arg as { [OP]?: Op }[]).map((item) => {
          const op = item[OP];
          if (!op) throw new Error('$transaction([...]) needs queries made with `prisma.…`.');
          return call(client, op);
        });
        return client.$transaction(ops as never, options as never);
      });
    }
    if (prop === '$disconnect') return async () => { await Promise.all([mainClient.$disconnect(), ...[...clients.values()].map((c) => c.client.$disconnect())]); };
    if (prop === '$connect') return async () => {};
    if (prop.startsWith('$')) return (...args: unknown[]) => lazy(async () => call(await currentClient(), { method: prop, args }) as Promise<unknown>, { method: prop, args });
    return new Proxy({}, {
      get(_model, method) {
        if (typeof method !== 'string') return undefined;
        return (...args: unknown[]) => lazy(async () => call(await currentClient(), { model: prop, method, args }) as Promise<unknown>, { model: prop, method, args });
      },
    });
  },
});
