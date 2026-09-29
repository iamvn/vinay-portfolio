// Creates the tables on the database in DATABASE_URL (or TURSO_DATABASE_URL) and adds any
// columns that newer versions of the app need. Safe to run repeatedly: it never deletes data.
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { databaseConfig } from '../lib/db-config';
import { migrate } from '../lib/db-migrate';

const { url, authToken } = databaseConfig();
const db = createClient({ url, authToken });

migrate(db)
  .then(() => console.log('Tables ready.'))
  .finally(() => db.close());
