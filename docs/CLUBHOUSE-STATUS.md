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

## Wave 2 (auth) — built 2026-08-07, pending two dashboard steps
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
Benson dashboard steps to make it fully live:
  1. Paste + run migrations/001_clubhouse.sql (SQL editor).
  2. Auth > Email template "Magic Link": add the code line, e.g.
     "Your code: {{ .Token }}" so one email carries link + OTP (AUTH-1).
  3. Auth settings: session/refresh token lifetime to 90 days (AUTH-3).
  4. Later: Resend SMTP creds (AUTH-2) replace the built-in sender
     (built-in works now for testing, ~few emails/hour limit).
  5. Roster seed: fill clubhouse_roster (publish pipeline or CSV insert)
     so the claim picker has names.

## Wave order (per requirements §20)
1. ✅ Publish transform + derived stats (this commit) → 2. Auth (blocked on
   email provider) → 3. Core pages → 4. Public teaser → 5. Consent capture →
   6. Seasons/awards.

## DES-3 compliance (done 2026-08-07)
robots.txt disallows /manage (prefix also covers /manage2, /manage-classic,
/manage/*), /admin, and additionally /leaderboard, /profile, /login - the
pre-clubhouse pages carrying player names stay off search engines (PUB-3
spirit) until they fold into the login-gated clubhouse at Wave 3.
