import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * DATABASE_URL:
 *   - local:  file:./prisma/dev.db           (plain SQLite file)
 *   - Vercel: libsql://<db>.turso.io          (hosted SQLite on Turso, needs DATABASE_AUTH_TOKEN)
 */
function createClient() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
