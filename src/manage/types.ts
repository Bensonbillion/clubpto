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

// Where a match sits in the night.
//
// "skipped" is the member the schedule turns on. Frame 12b lets the operator
// step past the four standing on court and play a different row, and the copy
// under the list promises that "a skipped game never disappears: it waits
// until you come back to it". A match that was on court and is no longer on
// court therefore cannot be thrown away and cannot be quietly re-drawn: the
// same four are owed that same game, so the row keeps its id, its lineup and
// its slot until somebody plays it.
//
// It counts for nobody in the meantime. engine/rotation.ts only ever counts
// "played", so the four in a skipped match are still owed their game and the
// queue keeps pulling them forward, which is exactly what makes a skipped row
// come back before the court can finish.
export type MatchStatus = "onCourt" | "played" | "skipped" | "voided";

export interface Match {
  id: string;
  courtNumber: CourtNumber;
  /**
   * The court's schedule slot, 1-based. NOT the order results were recorded.
   *
   * The whole card is drawn up front and nothing has to happen in order
   * (frame 12b), so slot 5 can be played before slot 4 and the numbers stay
   * put. That is the point of them: the row an operator tapped keeps the
   * number it was tapped by, all night. Playoff matches are numbered above
   * every group slot on their court, because they belong to no slot.
   */
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
  /** "Wednesday night". Shown on every screen and in the summary. */
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

/**
 * What a row of frame 12b is doing.
 *
 * "skipped" and "waiting" are both rows nobody has played, and the frame draws
 * them with the same neutral tag on purpose, because to the operator they are
 * the same thing: still owed, still coming. They are separate members here
 * because only one of them holds a promise. A skipped row has already had four
 * people standing on it, so its lineup is fixed; a waiting row has never been
 * reached, so its lineup is a projection and may be re-drawn.
 *
 * "upNext" is the row that goes on when the court next needs a game, which is
 * the lowest row nobody has touched. Frame 12b shows it BELOW a skipped row,
 * which is the rule stated in the drawing: stepping past a game does not put
 * it back at the front of the queue, it leaves it waiting to be returned to.
 */
export type ScheduleSlotStatus = "played" | "live" | "skipped" | "upNext" | "waiting";

/**
 * One row of a court's card.
 *
 * A row is a SLOT, not a match. Slots exist from the moment the night starts
 * and there are exactly as many of them as the court will play, so the operator
 * can see the whole night at once. Whether a slot holds a real match is the
 * difference between the two id fields: `matchId` is null until four people
 * have actually stood on that row.
 */
export interface ScheduleSlot {
  /** 1-based position in the court's card. Stable for the whole night. */
  slot: number;
  /** The match in this slot, or null while the row is still a projection. */
  matchId: string | null;
  /** A stable React key and tap target, whether or not a match exists yet. */
  rowId: string;
  /**
   * The four, as the card draws them. Null when the laws can field no lawful
   * four for this row at all: a court holding one C and three A's has no legal
   * game in it, and an undrawn row is the honest way to say so.
   */
  teamA: [string, string] | null;
  teamB: [string, string] | null;
  /** Both null until the row is played. */
  scoreA: number | null;
  scoreB: number | null;
  status: ScheduleSlotStatus;
}

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
