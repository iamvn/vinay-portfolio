# Vinay Bharti — Gaming-Inspired Engineering Portfolio

A performance-first portfolio built with Next.js App Router, Server Components, Client Components and Tailwind CSS.

## Architecture

- `app/page.tsx` — Server Component homepage that loads portfolio data through the API.
- `lib/portfolio-api.ts` — server-side API client used by the homepage and project routes.
- `lib/portfolio.ts` — data loader from `data/portfolio.json`, used exclusively by the API route.
- `app/api/portfolio/route.ts` — JSON API route that supplies server-rendered homepage and project-page data.
- `app/api/contact/route.ts` — demo POST endpoint for contact form integration.
- `components/portfolio-home.tsx` — client boundary for keyboard/game interactions, modals and progressive enhancement.
- `app/projects/[slug]/page.tsx` — statically generated project case-study routes.

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

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Replace before production

1. Put the real resume at `public/resume.pdf`.
2. Replace `#` GitHub/LinkedIn links.
3. Add real project screenshots using `next/image` with explicit dimensions.
4. Replace the demo contact endpoint with your email provider.
5. Replace any placeholder metrics with verified metrics.
6. Add your real profile photo if desired.
