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
- Roles: **admin** can use every tab and add/remove users and change their roles; **editor** uses only the tabs an
  admin gives them (below) plus their own password, and can't see or manage users or use API tokens (403).
  New users are editors unless you pick Admin.
- **Per-user tab access:** in Admin → Users & security, each editor has an **Access** box with a checkbox per tab
  (Profile, Experience, Skills, Projects, Site text, Design, Resume, Resume builder, Insights, AI assistant, Backup). Ticking or
  unticking saves immediately; **Reset to default** goes back to the editor default (Profile, Experience, Skills,
  Projects, Site text, Resume, Backup). The same checkboxes appear when adding a user. Admins always have every tab,
  and everyone keeps "My account" (their own password). Access is enforced on the server too: `proxy.ts` returns 403
  for API calls to a tab the user doesn't have (reading content stays open; saving needs the tab; Design, Insights,
  AI and Backup are closed entirely), and the design editor page redirects away. Stored in `User.permissions`.
  Tick as many boxes as you like, then press **Save access** (or **Cancel**); nothing is saved until then.
- **Read-only users:** the **Read-only** switch in the same Access box (also when adding a user) lets an editor open
  their tabs and see everything, but not save, add, delete, upload, reorder or publish. Fields and buttons are
  disabled, the design editor opens in view-only mode, and the server refuses every change (403) except signing out
  and changing their own password. Admins are never read-only. Stored in `User.readOnly`.
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
| `GET /api/users` · `POST /api/users` | admins only · POST: `{ email, name?, password, role?, permissions? }` (`"editor"` default, or `"admin"`; `permissions` = list of tab ids) |
| `PATCH /api/users/:id` | admins only · `{ role?, name?, permissions?, readOnly? }` (tab ids, or `null` for the default; not your own role/access, not the owner's role) |
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

## Recruiter features

- **Hiring snapshot**: Admin → Profile → Hiring snapshot (target roles, work mode, availability, notice period).
  Shown under the hero while "Available for opportunities" is on; empty lines are hidden.
- **Contact**: Email me (mailto), Copy email and LinkedIn buttons in the Contact section; X opens email.
- **Drafts**: every project has "Visible on site". Hidden projects are left out of the homepage, sitemap,
  structured data and the assistant; signed-in users can still preview them. Admin → Backup → "Add projects
  from JSON" adds projects (existing slugs are skipped, or updated when "Update projects that already exist" is on).
  `content/portfolio-project.json` is the full case study of this site; case studies can also have a "deep dive" write-up.
- **Insights** (Admin → Insights): anonymous counts of resume downloads (not your own while signed in),
  email/copy/LinkedIn clicks and assistant questions, plus the latest questions. No IPs or cookies are stored.
- **Page views**: Vercel Web Analytics (`@vercel/analytics`). Enable it once in Vercel → Project → Analytics.
  Admin and login pages are not tracked.

### Ask my resume (AI assistant)

A chat on the homepage that answers questions using only the site's own content (published projects,
profile, experience, skills) plus Admin → Profile → "Ask my resume: extra facts". Answers are generated on the
server, so API keys never reach the browser. The button is hidden until at least one provider works.

**Set it up in Admin → AI assistant** (admins, or editors given the AI assistant tab):

- **Providers:** add as many as you like: Anthropic (Claude), OpenAI, Google Gemini, Groq, OpenRouter, Mistral,
  DeepSeek, or any OpenAI-compatible service (base URL + model + API key). Each one has **Test**, **Edit**,
  **Enable/Disable**, **Delete** and **↑/↓**. Visitors' questions go to the first enabled provider; if it fails
  (bad key, out of credit, down), the next one answers.
- **Keys** are encrypted (AES-256-GCM, derived from `AUTH_SECRET`) before they are stored, and only the last
  4 characters are ever shown again. If you change `AUTH_SECRET`, enter the keys again.
- **Settings:** on/off switch, questions per day (all visitors), questions per visitor per 10 minutes, and max
  answer length in tokens (raise it for reasoning models).

Environment fallback: if no provider is added in the admin, `ANTHROPIC_API_KEY` (and optional
`ASSISTANT_MODEL`, default `claude-haiku-4-5-20251001`) from the environment is used. `ASK_DAILY_LIMIT` sets the
default daily limit until you save settings in the admin.

Admin API (admin session or token): `GET/POST /api/ai/providers`, `PATCH/DELETE /api/ai/providers/:id`,
`POST /api/ai/providers/:id/test`, `PUT /api/ai/providers/reorder` `{ ids }`, `GET/PATCH /api/ai/settings`.
Public: `GET /api/ask` (status) and `POST /api/ask` `{ messages: [{ role, content }] }` → `{ answer }`.

## Site design (visual editor)

Admins can redesign the homepage without code in **Admin → Design**, using the open-source
[Puck](https://puckeditor.com) visual editor (`@puckeditor/core`, MIT).

- **Templates:** **Classic** (your original site rebuilt from blocks, pixel-identical to the built-in homepage
  but fully editable), **Arcade**, **Minimal**, **Studio**, and **Blank**. Starting from a template replaces
  the draft only. With no draft, the editor starts from Classic.
- **Editor** (`/admin/design`, best on a laptop): drag blocks from the left, click a block to edit it on the
  right, switch phone/tablet/desktop previews at the top. Click empty page space for the **Page** settings:
  color theme (7 presets), every palette color (background, cards, soft background, text, secondary text,
  borders, three accents) with color pickers, heading/body fonts, text size, heading weight and case, corners,
  button shape and style, page width, text direction (LTR/RTL), background effect, and the "Ask AI" button.
- **Style on every block** (like a Shopify section): background color, background image with overlay, text /
  accent / card colors, padding on all four sides (with a separate phone value), margin on all four sides,
  max width with left / center / right position, min height, content width, text align, corners, border,
  shadow, show on all / desktop / phone, and an anchor id.
- **Revert to live** (editor header, and Design tab → "Revert draft to live") throws away draft changes and
  goes back to what visitors see now.
- **Build anything by drag and drop.** Blocks come in four groups:
  - **Containers:** Section, Row / Stack (flex: direction, gap, alignment, distribution, wrap, stack on phones),
    Grid (1–6 columns with separate tablet and phone counts, gap), Columns and Card. Any block can go inside any
    container, and containers nest.
  - **Elements:** Heading, Text, Button, Image, Tags, Status badge, Contact buttons, Social links, Resume
    download, List, Spacer, Divider. Heading, Text, Badge and Image can show **live data** (name, role, summary,
    location, greeting, stats, hiring details, site text, profile photo); Buttons have actions (email, LinkedIn,
    GitHub, Instagram, resume, jump to a section, or any link). Typography per block: size or exact px, weight,
    font (heading, body, mono), letter spacing, uppercase.
  - **Ready-made sections:** navigation bar, hero, hiring snapshot, stats, skills, projects, experience,
    contact, footer. The hero and contact have a drop area for your own blocks under their buttons.
  - **Classic:** the original site section by section. The Classic layout has settings for the main panel
    (width, padding on desktop and on phones, space between sections) and can hide the sidebar or top bar;
    the Classic hero and contact have drop areas for your own blocks.
  Empty text settings in ready-made sections use the site text, and `-` hides that line.
- **Draft → Publish:** edits autosave as a draft. **Preview** shows the draft full-page, and **Publish** makes it
  the live homepage immediately (no redeploy). **Use classic design** switches back. The last 5 published
  versions can be loaded back into the draft.
- **Stored** as JSON in the `Setting` table (`design.draft`, `design.published`, `design.history`). The server
  accepts known block types only, limits size and nesting, and filters links and image URLs when rendering.
  Editors only see the tab, the editor and the API when an admin gives them Design access.

API (admin session or token): `GET /api/design`, `PUT /api/design` `{ data }` (save draft),
`POST /api/design/publish` (`{}` = publish draft, or `{ data }`), `DELETE /api/design/publish` (classic),
`POST /api/design/template` `{ id }`, `POST /api/design/restore` `{ index }`, `DELETE /api/design` (revert draft to live).

## Resume builder (ATS-friendly, Overleaf-style)

Admin → **Resume builder** makes PDF resumes from the portfolio content. It's an admin tab like the others
(admins always have it; tick **Resume builder** under a user's Access to give it to an editor).

- **One resume per job.** "New resume" fills name, links, experience, skills and projects from the other tabs;
  each resume then has its own content, template and job description. Duplicate, delete, download from the list.
- **Templates:** Classic (LaTeX look), Modern (Inter, accent headings), Compact (fits more on a page), Minimal.
  All are ATS-safe: one column, real selectable text with embedded fonts, standard section names, dates on the
  job line, simple bullets. A4 or US Letter.
- **Editor** (`/admin/resume-builder/<id>`, autosaves, Undo): Content form on the left, live preview on the right
  (Edit / Preview switch on phones). Sections can be reordered or hidden; "Reload content from portfolio" refreshes it.
- **Code tab (like Overleaf):** the resume is [Typst](https://typst.app/docs) code, generated from the form. Edit it
  for full control (line numbers, errors with line links); the first edit switches the resume to *custom code*, and
  "Regenerate from form" switches back.
- **ATS score:** paste the job description to get a 0–100 score: 60% keyword match (missing / found keywords from the
  posting) + 40% format checks (contact details, quantified bullets, action verbs, weak phrases, bullet length,
  sections, dates, length…), each with a tip. Runs instantly in the browser.
- **Tailor with AI:** suggestions for headline, summary, bullets per role and skill order for that job, shown next
  to the current text and applied one by one or all at once. The model is instructed never to invent experience,
  numbers or skills. Uses the providers from Admin → AI assistant (the public "Ask my resume" switch can stay off).
- **Download:** PDF, LaTeX `.tex` (pdfLaTeX, "Jake's resume" structure), **Open in Overleaf**, or the Typst `.typ` file.
  LaTeX is generated from the form content (custom Typst edits aren't converted).
- **Publish to site:** makes the resume the PDF visitors get from "Download resume" (replaces Admin → Resume's file).

How it works: Typst compiles on the server inside the app (`@myriaddreamin/typst-ts-node-compiler`, Apache-2.0,
typically 10–200 ms), so there's no external service and resume data never leaves your deployment (except the AI
step, which goes to your chosen provider). Fonts: Typst's built-in fonts plus Inter (`assets/fonts`, OFL). Resumes
are stored in the `ResumeDocument` table, created automatically on first use. Code lives in `lib/resume-builder/`
and `components/resume-builder/`.

| Method & path | |
| --- | --- |
| `GET /api/resume-builder` · `POST /api/resume-builder` | list · create `{ name, template?, copyFrom? }` |
| `GET` / `PUT` / `DELETE /api/resume-builder/:id` | one resume · save `{ name?, template?, data?, code?, jobDescription? }` · delete |
| `POST /api/resume-builder/compile` | `{ source }` → `{ ok, pages, svg, warnings }` or `{ ok: false, errors }` |
| `GET /api/resume-builder/:id/download?format=pdf\|tex\|typ` | file download |
| `POST /api/resume-builder/:id/publish` | make it the site's resume PDF |
| `POST /api/resume-builder/tailor` | `{ data, jobDescription }` → AI suggestions |

## Multi-site platform (SaaS)

One deployment serves many portfolios. Your site is the **main site**; in Admin → **Sites** (main site admins only)
you create a site for someone else, e.g. *Savi Bharti* at `savi-bharti.yourdomain.com`. Each site is a full copy of
the product: its own content, design/theme, resume builder, users, login, AI keys and analytics. Nothing one site
does affects another.

- **Addresses:** `ROOT_DOMAIN=yourdomain.com` → main site at `yourdomain.com` / `www.yourdomain.com`, other sites at
  `<address>.yourdomain.com`. A site can also get its own custom domain (Sites → Custom domain). `*.vercel.app`
  and `localhost` always serve the main site; unknown subdomains get a 404 page, paused sites a "paused" page.
- **Data:** every site has its **own database** (Turso in production, `prisma/sites/<address>.db` locally). The list
  of sites lives in the main site's database (`Site` table). Code still uses `prisma` as before: `lib/prisma.ts`
  sends each query to the current request's site (`lib/sites/`). New sites' tables are created and upgraded
  automatically (on first use and on every deploy).
- **New site = copy of the main site:** content, projects, experience, skills, site text and design are copied;
  the name and email become the owner's. Your photo, uploaded resume, social links, private assistant notes, users,
  AI keys, resumes and analytics are not copied. The owner gets an admin account (email + the temporary password you set).
- **Logins are per site:** a session or API token only works on the site it was created on.
- **SEO per site:** canonical URLs, sitemap, robots.txt, share image, favicon initials and structured data use each
  site's own address and name. The `ANTHROPIC_API_KEY` fallback is main-site only (other sites add their own provider).
- **Manage:** pause/resume, set a custom domain, delete (type the address to confirm; deletes its database).
- **Security (per site, main site admins only):** new sites start locked down. Under each site → Security:
  - *Site admins can add users* (off by default): otherwise that site's Users & security has no "Add user" and
    `POST /api/users` is refused there.
  - *Site admins can create sites* (off by default): gives that site's admins their own Sites tab. They only see,
    pause and delete the sites they created (a copy of their site); they can't change any security settings.
  Switching either off applies on the next request. Every user added and site created/deleted by another site's
  admin appears in **Activity on other sites** (who, on which site, and the details), stored in the main
  database (`SiteActivity` table). Sites created that way show "Created by …".
- **Other pages follow the design:** project pages use the published design's theme (colors, background, buttons),
  so they match the homepage.

### Free option (no domain to buy): one `*.vercel.app` address per site

Vercel lets one project have several free `something.vercel.app` addresses (if the name isn't taken), so each
site can live at e.g. `savi-bharti.vercel.app`, saved as that site's **custom domain**. `vinay-bharti.vercel.app`
and any address not assigned to a site keep serving the main site.

- **Automatic:** set `VERCEL_API_TOKEN` (vercel.com → Account Settings → Tokens), `VERCEL_PROJECT` (project name)
  and, for team projects, `VERCEL_TEAM_ID`. Creating a site then claims `<address>.vercel.app` on the project;
  changing or deleting it updates Vercel too. If the name is taken you'll get a note: set another under Custom domain.
- **Manual:** Vercel → Project → Settings → Domains → add `savi-bharti.vercel.app`, then enter the same under the
  site in Admin → Sites → Custom domain.
- Still needed on Vercel: `TURSO_API_TOKEN` + `TURSO_ORG` (each site's database; Turso's free plan includes a number of databases).
- Leave `ROOT_DOMAIN` unset until you buy a domain.

### Deploying on Vercel with your own domain

1. **Domain:** buy one (e.g. `vinaybharti.dev`), add it to the Vercel project together with the wildcard
   `*.vinaybharti.dev` (Project → Settings → Domains). Wildcard domains need the domain to use **Vercel's nameservers**
   (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`); Vercel then issues certificates for every subdomain automatically.
2. **Environment variables** (Production + Preview):
   - `ROOT_DOMAIN=vinaybharti.dev` and `NEXT_PUBLIC_SITE_URL=https://vinaybharti.dev`
   - `TURSO_API_TOKEN` (Turso dashboard → Settings → API Tokens, or `turso auth api-tokens mint platform`),
     `TURSO_ORG` (your organisation slug), optionally `TURSO_GROUP` (default `default`).
   - Keep `DATABASE_URL` / `DATABASE_AUTH_TOKEN` pointing at **your** permanent database (it holds your site + the site list).
3. Redeploy. Create a site in Admin → Sites; it's live at `https://<address>.vinaybharti.dev` within seconds.
4. **Custom domains for a site:** add the domain in Vercel (Domains), ask the owner to point DNS to Vercel
   (`A 76.76.21.21` for the apex or `CNAME cname.vercel-dns.com`), then enter it under that site in Admin → Sites.
5. **Plan:** Vercel's Hobby plan is for personal, non-commercial use; charge users → Vercel Pro. Check Turso's plan
   limits for the number of databases.

Local development: sites open at `http://<address>.localhost:3000` (browsers resolve `*.localhost` automatically).

| Method & path | |
| --- | --- |
| `GET /api/platform/sites` · `POST /api/platform/sites` | main site admins · create `{ slug, name, ownerEmail, ownerPassword }` |
| `PATCH /api/platform/sites/:slug` | `{ name?, status?: "active" \| "suspended", domain? }` |
| `DELETE /api/platform/sites/:slug` | `{ confirm: "<slug>" }` — deletes the site and its database |

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
