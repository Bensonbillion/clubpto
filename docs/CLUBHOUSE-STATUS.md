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
