// The domain the wireframes describe.
//
// Deliberately narrower than the old engine's model. The frames only ever ask
// for: who is here, which court they are on, what has been played, and what is
// owed. Everything the screens do is derived from that, so anything not on a
// frame is not modelled here.

export type CourtNumber = number;

export interface Player {
  id: string;
  name: string;
  /** A walk-in plays tonight only and never joins the permanent roster. */
  walkIn: boolean;
  /** Null until they are put on a court; players stay on one court all night. */
  courtNumber: CourtNumber | null;
  /** Marked away mid-night; keeps their results, takes no new games. */
  away: boolean;
  /** Set when someone joins after the night started (frame 14). */
  joinedAtMatchIndex: number | null;
}

export type MatchStatus = "onCourt" | "played" | "voided";

export interface Match {
  id: string;
  courtNumber: CourtNumber;
  /** 1-based, per court, in the order the court played them. */
  matchIndex: number;
  teamA: [string, string];
  teamB: [string, string];
  /** Games won by each side. Null until a score is recorded. */
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  startedAt: number | null;
  completedAt: number | null;
  /** Playoff matches carry a stage; group matches do not. */
  stage: PlayoffStage | null;
}

export type PlayoffStage = "semi" | "final";

export interface Court {
  number: CourtNumber;
  /** How many matches each player on this court should get. */
  targetMatches: number;
  /** Set once the bracket is seeded. */
  playoffSeeded: boolean;
  /** Set when the final has a recorded score. */
  champion: [string, string] | null;
}

export type SessionStatus = "setup" | "running" | "ended";

export interface Session {
  id: string;
  /** "Wednesday night" — shown on every screen and in the summary. */
  dayLabel: string;
  date: string;
  status: SessionStatus;
  players: Player[];
  courts: Court[];
  matches: Match[];
  startedAt: number | null;
  endedAt: number | null;
}

/* ── derived shapes the screens consume ──────────────────────────── */

export interface QueueEntry {
  playerId: string;
  name: string;
  matchesPlayed: number;
  /** Whoever is owed a game sorts to the top (frame 13). */
  owed: number;
}

export interface PendingWrite {
  courtNumber: CourtNumber;
  matchIndex: number;
  scoreA: number;
  scoreB: number;
}

/** Everything frame 25a needs to explain an offline queue without lying. */
export interface SyncState {
  online: boolean;
  pending: PendingWrite[];
}
