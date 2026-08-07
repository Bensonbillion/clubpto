// Clubhouse publish pipeline — domain types.
// Pure data, no React, no Supabase (same law as the court-manager engine).
//
// PRIVACY ARCHITECTURE (PIPE-1): tier exists ONLY on the input side.
// Every output type in this file is structurally incapable of carrying
// tier or skill data. Divisions are display names mapped at publish time;
// the site reads only output shapes, so it cannot leak what they cannot hold.

export type Tier = "A" | "B" | "C";

/** Division display names, decided by the club (PRIV-6 open decision). */
export interface DivisionNames {
  A: string;
  B: string;
  C: string;
}

// ---------------------------------------------------------------------------
// Input side (from Court Manager at publish time)
// ---------------------------------------------------------------------------

export interface PublishPlayerInput {
  id: string;
  name: string;
  lastName?: string;
  tier: Tier;
}

export interface PublishPairInput {
  id: string;
  playerIds: [string, string];
  tier: Tier;
}

export interface PublishResultInput {
  gameId: string;
  winnerPairId: string;
  loserPairId: string;
  completedAt: number; // epoch ms
}

export interface PublishChampionInput {
  tier: Tier;
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
  divisionNames: DivisionNames;
  privacy?: PrivacyOptions;
  /** Admin-authored 3-4 sentence note (REC-3). */
  recapNote?: string;
  /** Optional contribution shout-outs (REC-4). */
  shoutouts?: string[];
}

// ---------------------------------------------------------------------------
// Output side (the only shapes the site ever reads) — NO TIER FIELDS.
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
  division: string; // display name only
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
  /** True when results/champions were withheld (practice session). */
  practiceOnly: boolean;
}
