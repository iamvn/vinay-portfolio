import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@/generated/prisma/client';
import { databaseConfig } from './db-config';

/**
 * DATABASE_URL:
 *   - local:  file:./prisma/dev.db           (plain SQLite file)
 *   - Vercel: libsql://<db>.turso.io          (hosted SQLite on Turso, needs DATABASE_AUTH_TOKEN)
 * TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (set by Vercel's Turso integration) work too.
 */
function createClient() {
  const { url, authToken } = databaseConfig();
  const adapter = new PrismaLibSql({ url, authToken });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
