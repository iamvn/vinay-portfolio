import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { databaseConfig } from './lib/db-config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: databaseConfig().url },
});
