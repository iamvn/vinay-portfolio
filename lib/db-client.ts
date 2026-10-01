import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@/generated/prisma/client';
import { databaseConfig } from './db-config';

/** A Prisma client for one database (each site has its own; see lib/sites). */
export function makeClient(url: string, authToken?: string) {
  return new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });
}

const globalForPrisma = globalThis as unknown as { mainPrisma?: PrismaClient };

/**
 * The main site's database (DATABASE_URL). It also holds the list of sites (the Site table).
 *   - local:  file:./prisma/dev.db
 *   - Vercel: libsql://<db>.turso.io (+ DATABASE_AUTH_TOKEN), or TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 */
export const mainClient: PrismaClient = globalForPrisma.mainPrisma ?? (() => {
  const { url, authToken } = databaseConfig();
  return makeClient(url, authToken);
})();
if (process.env.NODE_ENV !== 'production') globalForPrisma.mainPrisma = mainClient;
