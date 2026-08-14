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

/**
 * How a pool's matches are played (STEP F). Chosen at setup, per pool, and
 * locked the moment that pool records a result.
 *
 * Nothing hard-codes a score alphabet: a best-of-N win needs ⌈N/2⌉ games, so
 * the entry buttons and the log notation are GENERATED from `sets`.
 */
export type MatchFormat =
  | { kind: "bestOf"; sets: 3 | 5 }
  | { kind: "singleGame"; targetPoints: number };

/** Best-of-N: only the games the LOSERS took are recorded — the winner's
    total is implied by the format (⌈N/2⌉). Differential = won − lost. */
export interface BestOfResult {
  winner: "A" | "B";
  setsLost: number;
}

/** Single game to T: the loser's score. Differential = ±(T − loserPoints). */
export interface SingleGameResult {
  winner: "A" | "B";
  loserPoints: number;
}

export type AmericanoResult = BestOfResult | SingleGameResult;

export const isSingleGameResult = (r: AmericanoResult): r is SingleGameResult =>
  "loserPoints" in r;

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
  result: null | AmericanoResult;
  /** Set only when this match is played in a format OTHER than its pool's —
      a playoff bracket may override the format it was created with, and the
      log must keep rendering it in the notation it was recorded in. */
  format?: MatchFormat;
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

export type AmericanoPoolStatus =
  | "setup"
  | "round_robin"
  /** Playoff triggered, but a round-robin match is still on court. It finishes
      and counts; seeds lock only from the final standings (STEP 7). */
  | "playoff_pending"
  | "playoff"
  | "complete";

/** One visible coin flip that happened — an entry in a group's audit trail. */
export interface CoinFlipResolution {
  a: string;
  b: string;
  /** Whichever of a/b the flip landed on. */
  winner: string;
  at: number;
}

/** The tied signature that justified a group resolution. If any of these
    move, the circumstances the coins were tossed under are gone. */
export interface GroupFlipLine {
  w: number;
  l: number;
  diff: number;
  sos: number;
}

/**
 * A coin-decided TOTAL ORDER over an exact set of tied players (STEP 6.2).
 *
 * Replaces the pairwise resolutions, which could only be consulted between
 * adjacent rows: once a third player sorted between a flipped pair, the
 * verdict went inert and the table contradicted the coin the room watched.
 * A group record cannot do that — it names its whole membership, so it is
 * either live and authoritative for the entire group, or it is gone.
 * Cyclic verdicts (A>B, B>C, C>A) are unrepresentable by construction.
 *
 * The ONLY standings-related state that is ever persisted; the table itself
 * is always recomputed.
 */
export interface GroupFlipRecord {
  /** The exact tied set this order belongs to, canonically sorted. */
  members: string[];
  /** The tied signature at creation. */
  line: GroupFlipLine;
  /** Placed players, best first. COMPLETE when it holds every member. */
  order: string[];
  /** The visible coins, in the sequence they were tossed. */
  flips: CoinFlipResolution[];
}

/** One seeded player, with the annotation that placed them there — the audit
    trail of who was seeded where and why (STEP 7). */
export interface PlayoffSeed {
  playerId: string;
  seed: number;
  tiebreakApplied: StandingsRow["tiebreakApplied"];
}

/** A bracket pair. Pairing is LOCKED by the brief: 1+3, 2+4, 5+7, 6+8. */
export interface PlayoffPair {
  seeds: [number, number];
  playerIds: [string, string];
}

/**
 * What was true at the moment seeds locked. Persisted rather than recomputed,
 * because the round robin can still be corrected afterwards and the bracket
 * must not silently reshuffle underneath the people playing it.
 */
export interface PlayoffSnapshot {
  mode: "top8" | "top4";
  lockedAt: number;
  seeds: PlayoffSeed[];
  pairs: PlayoffPair[];
  /** Named on the confirm screen, with the leader−1 rule stated plainly. */
  excluded: { playerId: string; matchesPlayed: number }[];
  /** Bracket format — the pool's unless the confirm screen overrode it. */
  format: MatchFormat;
  /** The leader's match count the eligibility rule was measured against. */
  leaderMatches: number;
}

/** A pool's terminal state. Step 9 consumes this shape. */
export interface PoolChampion {
  kind: "pair" | "individual";
  playerIds: string[];
  /** "PTO Champion of the Week" (Court 2) or "Court 1 Champions" — the
      vocabulary comes from TITLES in src/clubhouse/publish/types.ts, which is
      what prices it. See championTitle(). */
  title: string;
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
  /** How this pool's matches are played (STEP F). Locked once a result is
      recorded — a format mistake caught later means void, change, replay. */
  matchFormat: MatchFormat;
  /** Coin-decided orders for tonight's tied groups. A record lives only while
      its members are exactly a current tied group AND its line still matches;
      anything else drops the whole record, partial progress included (see
      lib/americano/flips.ts — old chance never carries into new
      circumstances). */
  groupFlipResolutions?: GroupFlipRecord[];
  /** Seeds, pairs and bracket structure, frozen at lock time (STEP 7). */
  playoff?: PlayoffSnapshot;
  /** Set when the bracket (or the no-playoff path) has crowned someone. */
  champion?: PoolChampion;
  /** LEGACY (schema <= 7): pairwise resolutions. Read once by migrate, which
      converts each into a two-member group record and deletes this. */
  coinFlipResolutions?: CoinFlipResolution[];
}

/**
 * C6: "complete" used to be here and was never assigned by anything. Two
 * states are written — "setup" at DEFAULTS/migrate and "active" at
 * startSession — so a Publish gated on `status === "complete"` would never
 * have fired, and would have looked like a bug in the button rather than a
 * value nobody sets.
 *
 * It is not replaced by a third state, because the end of a night is not
 * latchable: a court is done when its pool says `status: "complete"` AND it
 * has a champion, and regressBracket can un-crown a court afterwards. A
 * stored session status would go stale the moment an admin corrected a
 * final. Ask isNightComplete() instead — it is derived, so it cannot lie.
 */
export type AmericanoSessionStatus = "setup" | "active";

export interface AmericanoSession {
  id: string;
  /** ISO date of the night (e.g. "2026-07-30"), in Toronto (C6). */
  date: string;
  /**
   * When the night actually started, epoch ms. Null until startSession.
   *
   * C6: `id` is `night-${date}` and two sessions on one date collide against
   * clubhouse_sessions.session_id, which is a primary key — the second night
   * would silently upsert over the first and its child rows would collide on
   * (session_id, pair_id). This is the field the published id is built from:
   * written once at start, never touched again, so the same night publishes
   * the same id on every press while two nights on one date differ.
   */
  startedAtMs?: number | null;
  sessionName: string;
  /** Tonight's players — the AmericanoPlayer records the generator consumes.
      (Step 3 addition: the Step 1 shape carried only ids inside pools, but a
      session must round-trip the player statuses and catch-up flags too.) */
  players: AmericanoPlayer[];
  pools: AmericanoPool[];
  /** Applied to pools as they are created; each pool can override it at
      setup, so the two courts may run different formats on the same night. */
  defaultMatchFormat: MatchFormat;
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
  /** 3 × wins, derived and never stored — there are no draws (STEP 6.3). */
  points: number;
  /** Format-defined: best-of-N is games won − games lost; a single game to
      T is ±(T − the loser's score). Never summed across formats. */
  gameDiff: number;
  /** 1-based position after the full chain. */
  rank: number;
  /** What placed this row above the next, when points did not (STEP 6.3:
      losses, head-to-head and SOS left the chain). */
  tiebreakApplied: null | "diff" | "coinflip";
  /** True when only a visible coin flip can order this row against its
      neighbour — the UI resolves it; the library never rolls one. */
  requiresCoinFlip: boolean;
}
