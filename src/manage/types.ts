// The domain the wireframes describe.
//
// Deliberately narrower than the old engine's model. The frames only ever ask
// for: who is here, which court they are on, what has been played, and what is
// owed. Everything the screens do is derived from that, so anything not on a
// frame is not modelled here.

export type CourtNumber = number;

// An assessment someone actually made, not a guess the app filled in.
//
// Absence is the default and the common case: frame 07 shows two chips across
// a sixteen-player night and reads "Not assessed" for everyone else, because
// that is the truth of the data. A tier is only ever written when a human
// judged a player, so `undefined` here means nobody has judged them, never
// "average". Code that needs a tier must handle its absence rather than
// substituting a middle value, which would invent an assessment that does not
// exist and quietly hand it to the balance rule.
export type PlayerTier = "A" | "B" | "C";

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
  /** Assessed tier. Optional, and unset for most of the real roster. */
  tier?: PlayerTier;
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

// The stages a playoff match can belong to.
//
// This was a single member, "final", and the comment here used to explain that
// a one-member union made it impossible to tag a match one thing and read it
// back as another. That bug was real: a seeded match was written as "semi"
// while the bracket looked its tie up as "final", so a recorded score never
// landed on its row and no champion could be crowned.
//
// The union has to widen, because the bracket is no longer one match. Every
// player on the court is seeded, pairs split adjacent seeds, and a full court
// plays a play-in, two semi-finals and a final. What replaces the one-spelling
// guarantee is narrower and stronger: engine/playoff.ts is the ONLY place that
// mints a playoff match, it reads the stage off the tie it was handed, and the
// same tie identity reads that match back. The tag is never typed twice.
export type PlayoffStage = "playIn" | "semi" | "final";

export interface Court {
  number: CourtNumber;
  /** How many matches each player on this court should get. */
  targetMatches: number;
  /** Set once the bracket is seeded. */
  playoffSeeded: boolean;
  /** Set when the final has a recorded score. */
  /**
   * The winning side. An array rather than a pair, because a court of nine
   * seeds one side as a rotating trio so that nobody sits out the climax, and
   * a trio can win.
   */
  champion: string[] | null;
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
