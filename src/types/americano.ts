// PTO Americano v4 — schema (docs/PTO_AMERICANO_DESIGN.md, STEP 1).
//
// The PLAYER is the unit of record. Partners rotate every match; pools play
// on two courts labelled ONLY "Court 1" and "Court 2" — tier is a hidden,
// admin-only seeding input and never renders anywhere.
//
// Standings are NEVER stored — always computed from the match log (single
// source of truth, no drift possible).

export type AmericanoTier = "A" | "B" | "C";

export type AmericanoPlayerStatus = "present" | "not_arrived" | "left";

export interface AmericanoPlayer {
  /** Stable ID from the shared roster (multi-week identity). */
  playerId: string;
  displayName: string;
  /** Hidden, admin-only, seeding input only. */
  tier: AmericanoTier;
  status: AmericanoPlayerStatus;
  /** Pool completed-match count when a late arrival walked in; null when
      present from the start. */
  joinedAtMatchIndex: number | null;
  /** Late arrivals get one permitted back-to-back to catch up. */
  catchUpUsed: boolean;
}

export type AmericanoScore = "2-0" | "2-1";

export type AmericanoMatchStatus = "pending" | "active" | "completed" | "voided";

export type AmericanoPhase =
  | "round_robin"
  | "playoff_sf1"
  | "playoff_sf2"
  | "playoff_final";

export interface AmericanoMatch {
  id: string;
  poolId: string;
  /** Per-pool sequence number (1-based; voided matches keep their number). */
  matchIndex: number;
  teamA: [string, string];
  teamB: [string, string];
  result: null | { winner: "A" | "B"; score: AmericanoScore };
  /**
   * Voided matches count for NOTHING — not standings, not matches-played,
   * not partnership history. Players return to the queue as if the match
   * never happened. (Award-instead-of-void is just a normal result entry.)
   */
  status: AmericanoMatchStatus;
  phase: AmericanoPhase;
  startedAt: number | null;
  completedAt: number | null;
  /**
   * Late arrivals whose ONE catch-up back-to-back was spent seating them in
   * THIS match. Recorded so a discard (STEP 5: the match never happened) can
   * hand the exemption back — without it, a discarded match silently costs a
   * rejoiner their catch-up and the generator then pushes them out of the
   * quartet they were owed.
   */
  catchUpGranted?: string[];
}

export type AmericanoPoolLabel = "Court 1" | "Court 2";

export type AmericanoPlayoffMode = "top8" | "top4" | "none" | "undecided";

export type AmericanoPoolStatus = "setup" | "round_robin" | "playoff" | "complete";

/** One visible coin flip that happened. The ONLY standings-related state
    that is ever persisted — the table itself is always recomputed. */
export interface CoinFlipResolution {
  a: string;
  b: string;
  /** Whichever of a/b the flip landed on. */
  winner: string;
  at: number;
}

export interface AmericanoPool {
  id: string;
  /** Court label — NEVER a tier label. */
  label: AmericanoPoolLabel;
  playerIds: string[];
  targetMatches: number;
  playoffMode: AmericanoPlayoffMode;
  status: AmericanoPoolStatus;
  matches: AmericanoMatch[];
  /** Flips run tonight. A resolution lives only while its pair is still tied
      on the whole pre-flip chain; a correction that breaks the tie drops it
      (see lib/americano/flips.ts — old chance never carries into new
      circumstances). */
  coinFlipResolutions?: CoinFlipResolution[];
}

export type AmericanoSessionStatus = "setup" | "active" | "complete";

export interface AmericanoSession {
  id: string;
  /** ISO date of the night (e.g. "2026-07-30"). */
  date: string;
  sessionName: string;
  /** Tonight's players — the AmericanoPlayer records the generator consumes.
      (Step 3 addition: the Step 1 shape carried only ids inside pools, but a
      session must round-trip the player statuses and catch-up flags too.) */
  players: AmericanoPlayer[];
  pools: AmericanoPool[];
  /** Practice sessions run identically and publish nothing. */
  isPractice: boolean;
  status: AmericanoSessionStatus;
  /** Surfaced hard errors from persistence healing (e.g. an orphaned player
      WITH match history, whose membership must never be silently re-seated).
      The admin sees these until resolved; absent when all is well. */
  integrityErrors?: string[];
}

/** Computed, never stored. */
export interface StandingsRow {
  playerId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  /** +2 for a 2-0 win, +1 for 2-1, −1 for 1-2, −2 for 0-2. */
  gameDiff: number;
  /** 1-based position after the full chain. */
  rank: number;
  /** What placed this row above the next, when it wasn't wins. */
  tiebreakApplied: null | "losses" | "diff" | "h2h" | "sos" | "coinflip";
  /** True when only a visible coin flip can order this row against its
      neighbour — the UI resolves it; the library never rolls one. */
  requiresCoinFlip: boolean;
}
