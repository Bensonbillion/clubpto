# Vercel migration checklist

Written during the public-site cleanup (the "ghost design" purge). Lovable
gives us no control over response headers, so the items below are the part of
that fix we could not ship yet. They are not nice-to-haves: without them, the
browser HTTP cache can do a milder version of exactly what the service worker
did — serve a stale `index.html` that points at asset hashes which no longer
exist.

## 1. Cache headers (the actual reason this file exists)

Vite already fingerprints every asset (`index-B07dSRCg.js`), so the two rules
are opposites and both are safe:

| Path | Header |
| --- | --- |
| `/index.html` (and any HTML entry) | `Cache-Control: no-store, must-revalidate` |
| `/assets/*` (hashed JS, CSS, images) | `Cache-Control: public, max-age=31536000, immutable` |
| `/manifest.webmanifest` | `Cache-Control: no-cache` |
| `/robots.txt`, `/og-image.jpg` | `Cache-Control: public, max-age=3600` |

`vercel.json`:

```json
{
  "headers": [
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "no-store, must-revalidate" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    }
  ]
}
```

The rule of thumb: **the document that names the hashes must never be cached;
anything whose name contains a hash can be cached forever.**

## 2. SPA rewrite

React Router owns the routes, so every unknown path must serve `index.html` or
a deep link (`/manage4`, `/book`) 404s on hard refresh:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Keep this BELOW the headers block in the same `vercel.json`.

## 3. Service worker — deliberately absent

There is no service worker, and re-adding one is a decision, not a default.
`vite-plugin-pwa` (`registerType: "autoUpdate"`, precaching every HTML/JS/CSS)
is what pinned the retired pre-RALLY site on returning devices for months. If
offline support is wanted later:

- do NOT precache `index.html` — use `NetworkFirst` for navigations;
- ship a visible "new version available — reload" prompt rather than silent
  `autoUpdate`;
- delete the corresponding assertion in
  `src/site/__tests__/no-ghost-design.test.ts` in the same commit, so the
  choice shows up in review.

`src/lib/killStaleCaches.ts` must stay regardless — devices that acquired the
old worker only heal when they run it.

## 4. Redirects that currently live in the SPA

These are `<Navigate replace>` inside `src/App.tsx`. They work, but they cost a
JS boot to perform. Consider promoting them to platform 301/302s on Vercel:

| From | To | Why |
| --- | --- | --- |
| `/membership` | `/` | page parked |
| `/events` | `/` | folded into the homepage |
| `/leaderboard` | `/` | privacy — real names were public; returns in clubhouse Wave 3 behind login |
| `/profile/:playerId` | `/` | same as above; `/manage` still links here, so it must resolve |

If these become platform redirects, keep `/profile/*` resolving (the court
manager links to it) and keep the `robots.txt` disallow entries either way.

## 5. Verify after the first Vercel deploy

- `curl -I https://<domain>/` → `cache-control: no-store`
- `curl -I https://<domain>/assets/<some-hash>.js` → `immutable`
- `curl -s https://<domain>/ | grep -c registerSW` → `0`
- Hard-refresh `/manage4` → loads (rewrite works), passcode gate appears.

---

## DONE — migrated and launched 2026-08-14

The site is live on **https://clubpto.com**, served by Vercel (project
`clubpto-site`, auto-deploying from `main`). What was actually done:

- **DNS at GoDaddy**: the apex `A` record pointed at "WebsiteBuilder Site" —
  GoDaddy's own parked landing page, which is what kept appearing at
  clubpto.com. It now points at `216.198.79.1` (Vercel). `www` was already a
  CNAME to the apex and is registered in Vercel as a 307 to the apex, so
  clubpto.com is canonical and www follows.
- **Vercel env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  and `VITE_SUPABASE_PROJECT_ID` are set on the project. Before this the
  build only worked because `.env` is committed — worth knowing before anyone
  untracks it.
- **Supabase auth**: Site URL is now `https://clubpto.com` and
  `https://clubpto.com/*` is in the redirect allow-list, so the `/club`
  sign-in link lands on the real domain.
- **Headers verified live**: hashed assets return
  `cache-control: public, max-age=31536000, immutable` and `content-encoding: br`;
  the document returns `no-store, must-revalidate`. On GitHub Pages every
  response was `max-age=600` and gzip, so returning visitors re-downloaded
  the whole bundle every ten minutes. That is the win this file was written
  for, and it does NOT show up in a cold-load Lighthouse run.
- SPA deep links (`/club`, `/about`, `/faq`, `/partners`, `/community`) all
  return 200; `/membership` 307s to `/`.

Cold-load Lighthouse mobile on the live domain is ~80 (median of 3), LCP
~4.5s — essentially the same as Pages, because the remaining cost is not
hosting: it is ~1.6s of render delay waiting for the main bundle to parse
before React paints the hero. Getting under 2.5s means taking the hero off
the JS critical path, not another hosting change.

Still on GitHub Pages: nothing. The gh-pages branch can stay as a fallback
but is no longer the live site.
