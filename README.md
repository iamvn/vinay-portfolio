# Vinay Bharti — Gaming-Inspired Engineering Portfolio

A performance-first portfolio built with Next.js App Router, Server Components, Client Components and Tailwind CSS.

## Architecture

- `app/page.tsx` — Server Component homepage; reads the database directly through `lib/portfolio-repository.ts`.
- `app/projects/[slug]/page.tsx` — project case-study page, read from the database on each request.
- `lib/prisma.ts` — Prisma 7 client using the libSQL adapter (a local SQLite file in development, Turso in production).
- `lib/portfolio-repository.ts` — assembles the full portfolio payload from the database tables.
- `lib/api-utils.ts` — shared validation, error handling and response helpers for the API routes.
- `app/api/*` — REST API (see below).
- `data/portfolio.json` — seed data; copied into the database by `npm run db:seed`.
- `components/portfolio-home.tsx` / `components/interaction-layer.tsx` — UI; only the interaction layer runs in the browser.

## Performance choices

- Server Components by default; only the interactive shell is client-side.
- No icon/font/image dependency for the core UI.
- Tailwind CSS v4 with zero-runtime CSS generation.
- Local JSON mock data; no client-side waterfall for initial page content.
- Static project routes via `generateStaticParams`.
- Small CSS effects instead of heavy animation libraries.
- `prefers-reduced-motion` support.
- Semantic sections and keyboard focus states.
- API response caching headers.

## Run locally

```bash
cp .env.example .env      # then set AUTH_SECRET (see the comment in the file)
npm install               # also generates the Prisma client (postinstall)
npm run db:setup          # creates tables and seeds from data/portfolio.json (wipes portfolio data!)
npm run admin:create      # create your admin login (asks for email + password)
npm run dev
```

Open http://localhost:3000.

Scripts: `db:generate` (regenerate client), `db:init` (create tables only), `db:seed` (reset data from JSON), `db:setup` (both).

## REST API

All bodies are JSON unless noted. Validation errors return `400 { "error", "details": [{ "path", "message" }] }`;
other errors return `{ "error" }` with 404 (not found), 409 (duplicate), 413 (file too large) or 415 (wrong file type).

| Area | Method & path | Body |
| --- | --- | --- |
| Everything | `GET /api/portfolio` | — |
| | `PUT /api/portfolio` | full portfolio (same shape as `data/portfolio.json`) — **replaces everything** |
| Profile | `GET /api/profile` | — |
| | `PATCH /api/profile` | any profile fields; `socialLinks` merges, `null` removes a link |
| Site text | `GET /api/copy` | — |
| | `PATCH /api/copy` | nested partial, e.g. `{ "hero": { "greeting": "Hi" } }`; arrays replace whole |
| Skills | `GET /api/skills` · `POST /api/skills` | `{ group, items[] }` |
| | `GET/PATCH/DELETE /api/skills/:id` | PATCH: `group` and/or `items[]` |
| | `PUT /api/skills/reorder` | `{ ids: [...] }` every id in the new order |
| Experience | `GET /api/experience` · `POST /api/experience` | `{ role, company, period, current?, bullets[] }` |
| | `GET/PATCH/DELETE /api/experience/:id` | PATCH: any of those fields |
| | `PUT /api/experience/reorder` | `{ ids: [...] }` every id in the new order |
| Projects | `GET /api/projects` · `POST /api/projects` | `{ slug, title, description, stack[] }` + optional fields below |
| | `GET/PATCH/DELETE /api/projects/:slug` | PATCH: any project field (slug can be renamed) |
| | `POST/GET/DELETE /api/projects/:slug/image` | cover image: multipart `file`, `.jpg`/`.png`/`.webp`, max 2 MB |
| Admin panel | `/admin` | web UI for all of the above |
| Resume | `POST /api/resume` | multipart form, field `file`; `.pdf`/`.docx` only, max 4 MB; replaces the old one |
| | `GET /api/resume` | downloads the file; `?meta=1` returns its details |
| | `DELETE /api/resume` | — |
| Profile picture | `POST /api/profile-image` | multipart form, field `file`; `.jpg`/`.jpeg`/`.png`/`.webp`, max 2 MB; also sets `profile.profileImage` |
| | `GET /api/profile-image` | serves the image; `?meta=1` returns its details |
| | `DELETE /api/profile-image` | removes it; the site falls back to your initials |
| Contact | `POST /api/contact` | `{ name, email, message }` (demo, no email sent) |

### Authentication

`/admin` and every API route require a login, except these public ones: `POST /api/auth/login`, `POST /api/auth/logout`,
`POST /api/contact`, and the file downloads the site itself shows (`GET /api/resume`, `GET /api/profile-image`,
`GET /api/projects/:slug/image`). The check lives in `proxy.ts`.

- Browser: log in at `/login` → an HttpOnly session cookie (7 days).
- curl/scripts (admins only): send `Authorization: Bearer <token>`. Get a token from the login response or
  Admin → Users & security → API token. Editors get no token and any Bearer request from an editor is refused (403).
- There is no sign-up. Create the first admin with `npm run admin:create` (also resets a forgotten password
  and makes that account an admin); add more users in Admin → Users & security.
- Roles: **admin** can edit everything and add/remove users and change their roles; **editor** can edit all
  portfolio content and their own password in the admin panel, but can't see or manage users or use API tokens (403).
  New users are editors unless you pick Admin.
- The **owner** is the first admin account (created at setup). Nobody, including other admins, can remove the
  owner or change its role. Nobody can change their own role.
- Changing your password signs out all other sessions and tokens. Removing an admin signs them out immediately.
- 5 wrong passwords for the same email + IP lock that combination for 15 minutes.

| Method & path | Body |
| --- | --- |
| `POST /api/auth/login` | `{ email, password }` → `{ user, token, expiresAt }` + session cookie |
| `POST /api/auth/logout` | — |
| `GET /api/auth/me` | — |
| `POST /api/auth/password` | `{ currentPassword, newPassword }` (min 10 characters) |
| `POST /api/auth/token` | — → a new Bearer token for the logged-in user |
| `GET /api/users` · `POST /api/users` | admins only · POST: `{ email, name?, password, role? }` (`"editor"` default, or `"admin"`) |
| `PATCH /api/users/:id` | admins only · `{ role?, name? }` (not your own role, not the owner's role) |
| `DELETE /api/users/:id` | admins only · removes a user (not yourself, not the owner) |

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"…"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl http://localhost:3000/api/profile -H "Authorization: Bearer $TOKEN"
```

### Project fields

| Field | Meaning |
| --- | --- |
| `type` | `"case-study"` (default) → page with sections · `"article"` → page with `content` · `"link"` → card opens `externalUrl` directly |
| `featured` | shows a "★ FEATURED" badge on the card |
| `image` | cover image (set by the image upload, or a `/public` path / URL); empty = initials |
| `liveUrl`, `repoUrl` | optional "LIVE ↗" / "GITHUB ↗" buttons |
| `externalUrl` | where a `"link"` project goes (required for that type) |
| `objective`, `approach`, `architecture`, `result` | case-study sections, each hidden when empty |
| `content` | article text: blank line = paragraph, `## ` heading, `- ` bullet |

After pulling new versions, run `npm run db:init` once: it adds new columns to an existing database without touching data.

### Placeholders in site text

Any string in the site copy can use `{years}`, `{level}`, `{xp}`, `{xpMax}`, `{name}`, `{role}` and `{location}`.
They are filled in from the profile when the page renders, so updating `yearsExperience` updates the header everywhere.
`"6+"` gives `LEVEL 06` and `XP 6,000 / 10,000`; `"6.5+"` gives `XP 6,500`. `GET /api/copy` returns the raw text with the placeholders.

## Deploying to Vercel

Vercel's filesystem is read-only, so production uses a hosted SQLite database on Turso.

1. **Database:** connect Turso to the project (Vercel → Storage / Marketplace → Turso), which creates
   `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, or create one with the Turso CLI and add `DATABASE_URL` and
   `DATABASE_AUTH_TOKEN` yourself.
2. **Environment variables** (Production and Preview):
   - `AUTH_SECRET`: 32+ random characters, different from your local one
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: used once to create the first admin; remove `ADMIN_PASSWORD` afterwards
3. **Deploy.** The `vercel-build` script runs `scripts/deploy-setup.ts` before `next build`. It creates or upgrades
   the tables, loads `data/portfolio.json` into an empty database, and creates the first admin. It is safe on every
   deploy and never overwrites existing content. The build stops with a clear message if the database or
   `AUTH_SECRET` is missing.

Uploads are limited to 4 MB (resume) and 2 MB (images) because Vercel functions accept at most 4.5 MB per request.

## Replace before production

1. Upload the real resume with `POST /api/resume`.
2. Replace `#` GitHub/LinkedIn links.
3. Add real project screenshots using `next/image` with explicit dimensions.
4. Replace the demo contact endpoint with your email provider.
5. Replace any placeholder metrics with verified metrics.
6. Add your real profile photo if desired.
