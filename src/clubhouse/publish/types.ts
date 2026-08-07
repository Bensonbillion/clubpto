// Clubhouse publish pipeline — domain types (requirements v1.0, PRIV-6 resolved).
// Pure data, no React, no Supabase (same law as the court-manager engine).
//
// PRIVACY ARCHITECTURE (PIPE-1): tier exists ONLY on the input side, and the
// transform never reads it. No divisions are published, ever. Champions carry
// court/title names; season hierarchy lives in PTO Points where TITLES openly
// carry different values — events are weighted, players never are (LB-4).
// Every output type is structurally incapable of carrying tier or skill data.

export type Tier = "A" | "B" | "C";

// ---------------------------------------------------------------------------
// Champion titles & PTO Points (LB-4 / CHW-1 / PRIV-6)
// ---------------------------------------------------------------------------

/** The standing title vocabulary. Free strings are allowed for special events. */
export const TITLES = {
  /** Wednesday's unified bracket winner. */
  CHAMPION_OF_THE_WEEK: "Champion of the Week",
  /** Sunday Court 3 — the premier Sunday title. */
  PTO_CHAMPION_OF_THE_WEEK: "PTO Champion of the Week",
  COURT_1_CHAMPIONS: "Court 1 Champions",
  COURT_2_CHAMPIONS: "Court 2 Champions",
} as const;

/**
 * Openly-published CHAMPION point value per title — identical for every
 * player. Owner-set once as publish config (LB-4). Hidden per-player or
 * per-tier multipliers are prohibited by design; there is nowhere to put one.
 */
export type PointsConfig = Record<string, number>;

/**
 * Canonical v1 values (owner decision, 2026-08-07). Premier titles at parity;
 * the slope down to Court 1 is deliberate. Per player, never split across
 * the pair.
 */
export const PTO_POINTS_V1: PointsConfig = {
  [TITLES.CHAMPION_OF_THE_WEEK]: 100,
  [TITLES.PTO_CHAMPION_OF_THE_WEEK]: 100,
  [TITLES.COURT_2_CHAMPIONS]: 60,
  [TITLES.COURT_1_CHAMPIONS]: 40,
};

/** The whole finalist system in three words: half the title. */
export function finalistPoints(championPoints: number): number {
  return Math.floor(championPoints / 2);
}

// ---------------------------------------------------------------------------
// Input side (from Court Manager at publish time)
// ---------------------------------------------------------------------------

export interface PublishPlayerInput {
  id: string;
  name: string;
  lastName?: string;
  /** Present because engine data carries it; the transform NEVER reads it. */
  tier?: Tier;
}

export interface PublishPairInput {
  id: string;
  playerIds: [string, string];
  tier?: Tier; // ignored by the transform, see above
}

export interface PublishResultInput {
  gameId: string;
  winnerPairId: string;
  loserPairId: string;
  completedAt: number; // epoch ms
}

export interface PublishChampionInput {
  /** Court/title name, e.g. TITLES.CHAMPION_OF_THE_WEEK. Never a division. */
  title: string;
  pairId: string;
}

export interface PublishSessionInput {
  sessionId: string;
  /** ISO date of the session, e.g. "2026-08-05" (America/Toronto). */
  date: string;
  venue: string;
  /** Practice sessions never publish results/records (PIPE-3). */
  isPractice?: boolean;
  players: PublishPlayerInput[];
  pairs: PublishPairInput[];
  results: PublishResultInput[];
  champions: PublishChampionInput[];
  /**
   * Runners-up per title (half points). Covers the Sunday winner-stays-on
   * edge: crown the leader as champion and the runner-up by wins here.
   */
  finalists?: PublishChampionInput[];
}

/** Per-player privacy controls, applied at copy time (PROF-3 / PRIV-3). */
export interface PrivacyOptions {
  /** Players who must vanish from all named surfaces. */
  hiddenPlayerIds?: string[];
  /** Display-name overrides (pseudonyms). */
  pseudonyms?: Record<string, string>;
  /** Players who consented to everything EXCEPT public champion naming (PRIV-2). */
  championOptOutIds?: string[];
}

export interface PublishOptions {
  /** Title → points. Titles missing from the config publish with 0 points. */
  pointsConfig: PointsConfig;
  privacy?: PrivacyOptions;
  /** Admin-authored 3-4 sentence note (REC-3). */
  recapNote?: string;
  /** Optional contribution shout-outs (REC-4). */
  shoutouts?: string[];
}

// ---------------------------------------------------------------------------
// Output side (the only shapes the site ever reads) — NO TIER, NO DIVISIONS.
// ---------------------------------------------------------------------------

/** A player reference as it may appear on the site. Hidden players carry no id. */
export interface PublishedPlayerRef {
  id?: string;
  displayName: string;
}

export interface PublishedPair {
  pairId: string;
  players: [PublishedPlayerRef, PublishedPlayerRef];
}

export interface PublishedResult {
  gameId: string;
  winnerPairId: string;
  loserPairId: string;
  completedAt: number;
}

export interface PublishedChampion {
  /** Court/title name only. */
  title: string;
  /** Openly-published event value (LB-4). Same for whoever wins it. */
  points: number;
  pair: PublishedPair;
}

export interface PublishedSession {
  sessionId: string;
  date: string;
  venue: string;
  attendanceCount: number;
  recapNote?: string;
  shoutouts?: string[];
}

/** Everything one publish writes. Upsert by sessionId (PIPE-4). */
export interface PublishBundle {
  session: PublishedSession;
  players: PublishedPlayerRef[]; // visible players only
  pairs: PublishedPair[];
  results: PublishedResult[];
  champions: PublishedChampion[];
  /** Finalist honors: same shape, half the title's points (LB-4 one-rule). */
  finalists: PublishedChampion[];
  /** True when results/champions were withheld (practice session). */
  practiceOnly: boolean;
}
