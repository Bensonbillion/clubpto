# Clubhouse Build Status

Requirements: CLUBHOUSE-REQUIREMENTS.md (canonical v1.0, in this folder).
This file tracks what exists in-repo and what gates the next waves.

## Built (Wave 1 core, pure + tested)
- `src/clubhouse/publish/` — publish transform (PIPE-1..4, PRIV-6 RESOLVED):
  tier structurally excluded from all output types and never read; champions
  carry court/title names (Champion of the Week, PTO Champion of the Week,
  Court 1/2 Champions) with openly-published event points from a pointsConfig
  (LB-4: weight events, never players; hidden multipliers impossible by
  construction). Hide/pseudonym/champion-opt-out handling, practice-session
  guard, deterministic output (republish idempotent). Leak guard:
  `assertNoTierLeak` rejects tier AND division keys.
- `src/clubhouse/derive/stats.ts` — milestone clubs (10/25/50/100, Parkrun
  model), weekly ISO streaks (current + best, no shame states), rivalry
  detection (3+ meetings), player totals + longest win streak, `topN` capped
  ranked view (LB-1: top-10 only, no full table anywhere).
- `src/clubhouse/schema.sql` — reference DDL for clubhouse_* tables + RLS
  sketch. NOT applied; apply with Wave 2 auth.

## Repo-reality deltas from the requirements doc
- DES-1 colors in the doc (#C8D200 / #1A1A1A) are stale: build on Brand Book
  v2 tokens (lime #D9E270 on forest #0A1810) like the rest of the site.
- Existing `/leaderboard` + `/profile/:id` (engine track, full rankings via
  `lib/leaderboard.ts`) conflict with LB-1 (top-10 only). Fold/replace them in
  Wave 3; coordinate with the court-manager track. They are unlinked from the
  public site today.
- PIPE-2's Publish button belongs in Court Manager v3's session summary UI —
  that surface is owned by the engine track; it should call
  `buildPublishBundle` from here.

## Gating decisions — scoreboard (updated 2026-08-07)
1. RESOLVED — no divisions; titles + PTO Points. Point values are canon in
   code as `PTO_POINTS_V1` (100/100/60/40, finalists = half the title,
   per player, floor on halves). Sunday winner-stays-on edge: leader is
   champion (full), runner-up-by-wins goes in `finalists` (half).
   No semifinal/appearance points in v1 (season-2 refresh lever).
2. RESOLVED — Win% board ships beside the points board; 8-game qualifier
   (`WINPCT_MIN_GAMES`); LB-3 opt-out stands.
3. RESOLVED (drafted) — consent checkbox + privacy note language is in
   CLUBHOUSE-REQUIREMENTS.md Appendix A (canonical, in-repo). Privacy
   note page builds at Wave 4; consent checkbox at Wave 5. Contact email
   filled in as clubptobookings@gmail.com. Add the 18+ line once the
   minors question is answered.
4. DECIDED, SOLE REMAINING WAVE-2 BLOCKER — Resend for transactional email (free tier: 3k/mo but
   100/day cap — stagger launch announcement or pay $20 for launch
   month). BLOCKED on Benson: create account, verify domain, paste SMTP
   creds into Supabase Auth. Postmark is the fallback provider.
5. RESOLVED (2026-08-07) — no minors have ever attended; PRIV-4 closed.
   Owner's call: internal fact only, no 18+ messaging on any public
   surface (removed from FAQ same day).
6. OPEN — founding-24 status for the join page (PUB-4).

## Wave 3 (the room) — BUILT 2026-08-13, live at /club behind the door
Sections: dashboard (DASH-1..7), recaps (REC-1..5), champions wall +
records book (CHW-1..3), boards + milestone clubs (LB-1..4, MILE-1),
players + profiles + rivalries (PROF-1..3), mosaic (MOS-1/2).

ARCHITECTURE: one pure function, src/clubhouse/ui/viewmodel.ts, turns
published bundles into every surface. All privacy law lives there and is
unit-tested (44 clubhouse tests) instead of being scattered through JSX.
src/clubhouse/data/reads.ts is the only Supabase caller; sections.tsx is
pure presentation. Dev harness: /club/preview (dev only, fixtures, with an
empty-room toggle) — the room can be designed without a published session.

MIGRATIONS TO APPLY (owner, SQL editor, in order):
  003_prefs.sql   - clubhouse_prefs (LB-3 win-rate opt-out, DASH-7 rank),
                    RLS: read for members, write only your own row.
  004_privacy_hardening.sql - roster.hidden flag (PROF-3); withdraws the
                    anon read on clubhouse_sessions, which exposed EVERY
                    session's recap note and shout-outs (they name
                    members); champions teaser keeps working via a
                    security-definer latest_published_session_id().
  Until 003 is applied the room still works: preferences fail CLOSED, so
  win rates stay hidden for everyone rather than being published.

REVIEW FIXES (21-agent adversarial pass, each with a regression test):
published names beat the roster copy so pseudonyms survive (PRIV-3);
hidden players filtered at the source; LB-3 fails closed; practice nights
off boards/records but still counted for personal attendance and
milestone clubs (PIPE-3); milestone lists alphabetical not ranked (LB-1);
failed preference save reverts and says so; failed reads surface as an
error instead of an empty room; mosaic scales so every attendee has a
square (was silently dropping everyone past the 17th).

STILL OPEN for Wave 3: the room reads only what the publish pipeline
writes, and PIPE-2 (the Publish button in Court Manager) is not built, so
every section shows its empty state until the first publish. That is the
next piece of real work.

DEPLOY GOTCHA (hit 2026-08-13): the GitHub Pages build MUST be
`npx vite build --base=/clubpto/`. A build without it produces
root-relative /assets/ paths and ships a blank page. Verify after every
deploy: `curl -s https://bensonbillion.github.io/clubpto/ | grep assets`
must show /clubpto/assets/. Note the engine track added vercel.json +
VERCEL-MIGRATION.md; a Vercel cutover serves from the root, so the base
flag becomes wrong at that point. One hosting story, not two.

## Wave 2 (auth) — COMPLETE 2026-08-08: first member signed in and claimed
Proven end to end on production (bensonbillion.github.io/clubpto/club):
email -> magic link -> session -> roster claim ("You're in, Benson").
Roster seeded same day: 002_roster_seed.sql, 66 real players derived from
the engine's pair_history (NATO-named test data excluded — all confined to
the 2026-03-01 simulation day; lookalike spellings that co-occurred on the
same session date kept separate as distinct people). Hardening shipped the
same night: main.tsx routes any Supabase auth hash (#access_token/#error)
landing on ANY page to /club, where the clubhouse client consumes it —
without this, Site-URL-fallback landings silently dropped the session
(root cause of the first failed sign-ins, confirmed by a 17-agent audit).
GOTCHA: clubpto.lovable.app is a STALE build until Share -> Publish in
Lovable; never test auth there. Resend remains open (deliverability + the
{{ .Token }} code line in the template, which is SMTP-gated).

- src/clubhouse/migrations/001_clubhouse.sql — ONE paste in the Supabase SQL
  editor creates all clubhouse tables (content + roster + links) with RLS:
  authenticated read, own-link claim with claimable guard + unique conflict
  (AUTH-6), latest-session champions public for the teaser (PRIV-2).
- src/clubhouse/auth/api.ts — signInWithOtp (magic link + code in one email),
  verifyOtp, identity resolution, find-your-name claim stamping PRIV-1
  consent, friendly errors.
- /club (src/pages/Club.tsx) — the door: email -> code/link -> claim (with the
  Appendix A1 consent checkbox gating the button) -> landing. Own shell,
  lazy chunk, robots-blocked during soft launch.
ARCHITECTURE DECISION (2026-08-26): the clubhouse database is Benson's OWN
Supabase project (org "CLUB PTO", ref flahcijysipymafazhxq) - not the
Lovable-managed engine project (ikfbtktofcfkpqxwlfku, which Benson's
dashboard login cannot access). Migration 001 is APPLIED there (all 9
clubhouse tables verified). The site uses a dedicated client
(src/clubhouse/supabaseClient.ts, storageKey "clubhouse-auth"). Publish
pipeline will write cross-project with the clubhouse service key from the
admin context. One more step off Lovable.

Remaining dashboard steps:
  0. DONE - URL configuration fixed after first real link redirected to
     localhost and expired: Site URL = https://bensonbillion.github.io/clubpto,
     redirect allow-list = prod/* + clubpto.lovable.app/* + localhost:8080/*.
     /club now explains expired links (#error_code=otp_expired) with the
     email form ready for a fresh request.
  1. DONE - migration applied to flahcijysipymafazhxq (verified 2026-08-26).
  2. BLOCKED BEHIND SMTP: this project locks template editing until custom
     SMTP is configured. So Resend (AUTH-2) also unlocks the
     "Your code: {{ .Token }}" template line - unless the default template
     already includes the code (E2E email sent 2026-08-26 to check).
  3. Sessions: free-tier default = no time-box, refresh tokens keep
     sessions alive indefinitely; AUTH-3 satisfied without changes.
  4. Resend SMTP creds (AUTH-2): Auth > Emails > SMTP Settings.
  5. Roster seed: fill clubhouse_roster (publish pipeline or CSV insert)
     so the claim picker has names. Claim flow shows a friendly empty
     state until then.

## Wave order (per requirements §20)
1. ✅ Publish transform + derived stats (this commit) → 2. Auth (blocked on
   email provider) → 3. Core pages → 4. Public teaser → 5. Consent capture →
   6. Seasons/awards.

## DES-3 compliance (done 2026-08-07)
robots.txt disallows /manage (prefix also covers /manage2, /manage-classic,
/manage/*), /admin, and additionally /leaderboard, /profile, /login - the
pre-clubhouse pages carrying player names stay off search engines (PUB-3
spirit) until they fold into the login-gated clubhouse at Wave 3.

## Court Manager v4 — pre-live-night checklist (added 2026-08-12, Step 6.2)
Before the first live Wednesday on /manage4:
- [ ] **Two-device check of the coin-flip decline.** Open a tied group's flip
  overlay on device A; on device B, correct or void a result that breaks that
  tie while the ~2s animation runs. Device A must show "Standings changed — no
  flip recorded" and record nothing — it must never crown a name it did not
  store. This is a HUMAN task: agent tool latency exceeds the animation window,
  so it could not be reproduced in automation. The logic is covered
  deterministically by tests (attemptCoinFlip refusals + flipPhase in
  src/lib/americano/__tests__/), but one real-device confirmation is wanted
  before the system decides a real standings position.

## Step 9 (publish pipeline) — match-format items (added 2026-08-12, Step F)
Match format is now a per-pool, setup-time choice (best of N, or a single game
to T). Two things the publish pipeline MUST carry when it is built:
- **Format metadata per pool** on every published session — a session is not
  self-describing without it, because "+3" means a 3–0 best-of-5 on one court
  and a 7–4 game on the other.
- **Never sum differentials across sessions of different formats.** A game to
  7 yields ±7 at the extreme; a best of 3 yields ±2. Season-level aggregation
  has to group by format (or normalise deliberately) — a raw SUM(gameDiff)
  across a season that mixed formats is a meaningless number that will look
  perfectly plausible.
