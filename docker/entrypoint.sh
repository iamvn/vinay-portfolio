#!/bin/sh
# Container start: check settings, set up the database (safe on every start), then run the site.
set -e

if [ -z "$AUTH_SECRET" ] || [ ${#AUTH_SECRET} -lt 32 ]; then
  echo "✗ AUTH_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example)." >&2
  echo "  Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"" >&2
  exit 1
fi

# Creates missing tables/columns, loads the starter content into an empty database, and creates the
# first admin from ADMIN_EMAIL + ADMIN_PASSWORD when there is none. Never overwrites existing content.
npx tsx scripts/deploy-setup.ts

exec "$@"
