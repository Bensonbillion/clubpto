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

## Gating decisions (Benson, before anything publishes)
1. ~~Division names~~ RESOLVED: no divisions ever; court/title naming +
   PTO Points carry the hierarchy. Remaining follow-on: set the point
   VALUES per title (one-time pointsConfig) and confirm whether the Win%
   board ships alongside the points board or moves to profiles only.
2. Consent + privacy-note language (PRIV-1/5).
3. Minors check (PRIV-4) — default-hidden policy if any.
4. Transactional email provider for auth (AUTH-2) — account + keys needed.
5. Founding-24 status for the join page (PUB-4).

## Wave order (per requirements §20)
1. ✅ Publish transform + derived stats (this commit) → 2. Auth (blocked on
   email provider) → 3. Core pages → 4. Public teaser → 5. Consent capture →
   6. Seasons/awards.
