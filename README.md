# Club PTO

A padel social club in Toronto. Two nights a week, Wednesdays and Sundays.

This repo holds two things that share a build but almost nothing else:

- **The public site** — `/`, `/about`, `/play`, `/community`, `/partners`,
  `/faq`, plus the members-only clubhouse at `/club`.
- **Court Manager** — the courtside tool that runs a live night, at
  `/manage` (v3) and `/manage4` (Americano v4).

## Live

| | |
| --- | --- |
| Site | https://clubpto.com |
| Hosting | Vercel, project `clubpto-site`, auto-deploys from `main` |
| Bookings | Acuity (the site never owns checkout) |

`dab458f` and `VERCEL-MIGRATION.md` record the move from GitHub Pages to
Vercel and the cache headers that came with it.

## Running it

Node 18+ and npm.

```sh
npm install
npm run dev          # http://localhost:8080
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :8080 |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint |
| `npx vitest run` | The test suite |
| `npx tsc --noEmit -p tsconfig.app.json` | The real typecheck (not `tsc --noEmit`) |
| `npx tsx src/court-manager/sim/run.ts` | Scheduler simulation |

Environment: copy `.env.example` to `.env`. Every variable is a `VITE_` one,
which means it ships to the browser — none of them is a secret, and Supabase
Row Level Security is what actually protects the data.

## Layout

```
src/
├── components/home/     public homepage sections
├── components/layout/   header, footer, page wrapper
├── clubhouse/           members area: publish transform, derived stats, /club UI
├── court-manager/       Court Manager v3 engine (pure, simulated, tested)
├── lib/americano/       Americano v4 engine
├── pages/               routes
└── site/__tests__/      guards that fail the build on content regressions
```

## House rules

- **Facts only** in public copy. No invented times, counts, or formats. The
  facts live in `src/lib/constants.ts`.
- **The two nights are the same thing.** No copy may rank Wednesday against
  Sunday or describe one as harder or softer.
  `src/site/__tests__/nights-are-equal.test.ts` fails the build if it does.
- **No service worker.** One precached `index.html` pinned a retired design
  on real devices for months. `src/lib/killStaleCaches.ts` exists to heal
  devices that still carry it, and `no-ghost-design.test.ts` fails if a
  registration reappears.
- **The clubhouse publishes no tier data, ever.** Skill tiers exist in the
  engine and are structurally absent from every published type. See
  `docs/CLUBHOUSE-REQUIREMENTS.md`.
