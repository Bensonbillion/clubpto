# Clubhouse Build Status

Requirements: Benson's "Digital Clubhouse Requirements v1.0" (2026-08-07 session).
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
3. RESOLVED (drafted) — consent checkbox + privacy note live in the
   requirements doc Appendix A (owner's copy); implement at Wave 5.
4. DECIDED — Resend for transactional email (free tier: 3k/mo but
   100/day cap — stagger launch announcement or pay $20 for launch
   month). BLOCKED on Benson: create account, verify domain, paste SMTP
   creds into Supabase Auth. Postmark is the fallback provider.
5. OPEN — minors question: has anyone under 18 ever attended? If no:
   one line ("Club PTO is an 18+ community") closes PRIV-4. If yes:
   default-hidden. One-word answer unblocks.
6. OPEN — founding-24 status for the join page (PUB-4).

## Wave order (per requirements §20)
1. ✅ Publish transform + derived stats (this commit) → 2. Auth (blocked on
   email provider) → 3. Core pages → 4. Public teaser → 5. Consent capture →
   6. Seasons/awards.
