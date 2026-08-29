// The manager's state, and the only place the screens' callbacks land.
//
// Every screen in src/manage/screens is presentational: props in, callbacks
// out, no fetching. This hook is the other half: it owns the session, derives
// what each screen renders, and is the single writer.
//
// PERSISTENCE reuses src/court-manager/persistence.ts rather than a new store.
// That layer already carries the fix that matters most on a Wednesday: load()
// reconciles local against the server by savedAt and takes whichever is newer,
// so a device that has been away cannot resume a stale night and push it over
// everyone else's. Rewriting that from scratch would have meant rediscovering
// it the hard way.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSessionStore, type SessionStore, type SyncStatus } from "@/court-manager/persistence";
import type { Court, CourtNumber, KnockoutPair, Match, NightFormat, Player, PlayerTier, ScheduleSlot, Session } from "./types";
import { buildQueue, lawContextFor, nextMatch, courtComplete, matchesPlayedBy, totalMatches } from "./engine/rotation";
import { canFieldACMatch, designateB, tierOf as tierOfPlayer } from "./engine/tiers";
import { legalSubstitutes, swapIntoMatch } from "./engine/substitutes";
import { computeStandings, type PlayedMatch, type StandingsRow } from "./engine/standings";
import { buildStages, champion, nextTie, orderedPlayerIds, readiness, seedPairs, seedPlayoffMatch,
  type SeededPair, type Stage } from "./engine/playoff";
import { appearsInAMatch } from "./engine/roster-guard";
import { buildKnockoutStages, buildPlateStages, orphanKnockoutMatchIds, planKnockoutDispatch, playableTies } from "./engine/knockout";
import type { RosterName } from "./roster/names";

export const STORAGE_KEY = "cm_manage_session";
const SCHEMA_VERSION = 1;

/**
 * The localStorage key one manager instance keeps its night under.
 *
 * The club can run /manage and /manage2 at the same time, one court on each,
 * and the only thing that makes them two managers rather than one is that
 * each writes its own key. Instance 1 keeps the bare key, which is the key
 * every phone already has a night under: nothing about /manage changes.
 */
export const storageKeyFor = (instance: number): string =>
  instance <= 1 ? STORAGE_KEY : `${STORAGE_KEY}_${instance}`;

const emptySession = (): Session => ({
  id: `night-${new Date().toISOString().slice(0, 10)}`,
  dayLabel: "",
  date: new Date().toISOString().slice(0, 10),
  status: "setup",
  players: [],
  courts: [],
  matches: [],
  startedAt: null,
  endedAt: null,
});

/**
 * Group matches only, renumbered into the order their results were recorded.
 *
 * Playoff ties never feed the round-robin table, which is the old reason this
 * function exists. The renumbering is the new one. A match's matchIndex is its
 * slot in the card, and the card can be played out of order (frame 12b), so the
 * slot is no longer the sequence the night ran in. The standings' third
 * tie-break is "whoever reached the total first, decided by the order results
 * were recorded", so it is handed exactly that: the played rows sorted by when
 * they were recorded and renumbered 1..n. Feeding it slot numbers instead would
 * let a game scored at nine o'clock rank as though it had been played first
 * because it happened to sit in row two.
 */
/**
 * Who earns a standings row on this court: everyone present, plus anyone who
 * left AFTER playing. A live walk found the gap this closes: a player marked
 * left kept shaping everybody's score difference through the games they had
 * played while their own row vanished from the table and the summary. A row
 * you played for stays. Somebody marked left before ever playing gets no
 * zero row, because there is nothing to show.
 */
export const standingsIds = (
  players: readonly Player[],
  played: readonly PlayedMatch[],
  courtNumber: number,
): string[] =>
  players
    .filter((p) => p.courtNumber === courtNumber
      && (!p.away || played.some((m) => m.teamA.includes(p.id) || m.teamB.includes(p.id))))
    .map((p) => p.id);

const groupPlayed = (matches: readonly Match[], court: number): PlayedMatch[] =>
  matches
    .filter((m) => m.courtNumber === court && m.status === "played" && m.stage === null)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.matchIndex - b.matchIndex)
    .map((m, i) => ({
      matchIndex: i + 1,
      completedAt: m.completedAt,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
    }));

/* ── the schedule ────────────────────────────────────────────────── */

// THE MODEL, and the compromise inside it.
//
// Frames 12b and 30 draw every match of a court's night in one list, from the
// moment the night starts, each row carrying names. Nothing has to happen in
// order: tap a row to jump to it, step past the live one and it waits.
//
// The count is honest up front. engine/rotation.ts knows it exactly: a court
// of N playing T games each plays N*T/4 matches, so the rows exist before
// anybody has played anything.
//
// THE FOUR IN A ROW CANNOT BE. Who plays is chosen least-played-first and
// under the tier laws in engine/tiers.ts, and both read what has already
// happened. Fix all six lineups at eight o'clock and the card is a lie by half
// past: the player who arrives at match nine is owed as many games as everyone
// else and has to be pulled straight in, the player who leaves at half nine
// cannot be left standing in row six, and a tier corrected mid-night has to
// move somebody off the beginners' court.
//
// So the resolution is: STORE WHAT HAPPENED, PROJECT THE REST. Only rows that
// four people have actually stood on are written down. Every other row is
// re-drawn from the current state on every read, by walking the card in slot
// order and asking the same engine that would pick the four live. A row's
// identity, its slot number, never moves.
//
// The tradeoff, stated plainly: the tail of the card can read differently at
// nine than it did at eight. What the operator can rely on is the number of
// rows, the numbers on them, and every row anyone has touched. What they
// cannot rely on is the names on a row nobody has reached, and the alternative
// was worse: freezing those names would mean either turning a late arrival
// away or silently rewriting rows behind the operator's back.
//
// A SKIPPED ROW IS THE EXCEPTION, and it is why MatchStatus grew a member. A
// match that was on court has four real people attached to it, so stepping
// past it parks it rather than re-drawing it, and it keeps its id, its lineup
// and its slot until somebody plays it. Rows nobody ever reached were only a
// projection, so leapfrogging them freezes nothing.

const playableOn = (players: readonly Player[], court: CourtNumber) =>
  players.filter((p) => p.courtNumber === court && !p.away);

/** The group match on court, which is the one frame 10 draws. */
const groupLive = (matches: readonly Match[], court: CourtNumber): Match | null =>
  matches.find(
    (m) => m.courtNumber === court && m.stage === null && m.status === "onCourt",
  ) ?? null;

/** Anything on court at all, playoff ties included. A court plays one game. */
const anythingLive = (matches: readonly Match[], court: CourtNumber): Match | null =>
  matches.find((m) => m.courtNumber === court && m.status === "onCourt") ?? null;

/**
 * The court's group matches, indexed by the slot they occupy.
 *
 * Voided rows are dropped, because voiding re-opens the slot. All four go back
 * in the queue owed that game (frame 28a), so the card has to offer the row
 * again or the court would finish one match short of its target. The replay is
 * minted into the same slot number, which is why the newest row wins here
 * rather than the first one found.
 */
const bySlot = (matches: readonly Match[], court: CourtNumber): Map<number, Match> => {
  const map = new Map<number, Match>();
  for (const m of matches) {
    if (m.courtNumber !== court || m.stage !== null || m.status === "voided") continue;
    const held = map.get(m.matchIndex);
    if (!held || (m.startedAt ?? 0) >= (held.startedAt ?? 0)) map.set(m.matchIndex, m);
  }
  return map;
};

/**
 * How many rows the card holds.
 *
 * Floored, because a headcount that stops dividing by four (frame 16c, someone
 * leaves at half nine) cannot make a whole last match, and never below the
 * highest slot already used, because a card may not hide a game that happened.
 *
 * And never so few that somebody present finishes short. Found on the live
 * site: a late arrival absorbed mid-flight was owed one more game when the
 * last row was played, the count could not grow, and the court bricked in the
 * readiness hold with a spent button. So the card grows enough PENDING rows
 * for the most owed present player, and the overshoot lands on people who
 * already had their games, the same trade the designated-B rule already
 * makes: nobody finishes short, and nobody exceeds anyone by more than the
 * disruptions explain.
 */
const slotCount = (session: Session, court: Court): number => {
  const present = playableOn(session.players, court.number);
  const whole = Math.floor(totalMatches(present.length, court.targetMatches));
  const held = bySlot(session.matches, court.number);
  const used = [...held.keys()];
  const spentRows = [...held.values()].filter((m) => m.status === "played").length;
  const maxOwed = present.reduce((worst, p) => Math.max(
    worst, court.targetMatches - matchesPlayedBy(session.matches, p.id)), 0);
  return Math.max(whole, ...used, 0, spentRows + maxOwed);
};

/**
 * The whole card for one court: stored rows where they exist, projections
 * everywhere else.
 *
 * The walk is in slot order and carries the night forward with it. A row that
 * is on court or skipped goes into the running log AS PLAYED before the next
 * row is drawn, because the card is a picture of a night in which every row
 * gets played. Without that, the projections would hand the same four their
 * games twice and the last rows would have nobody left to fill them.
 */
export function scheduleFor(session: Session, court: Court): ScheduleSlot[] {
  const held = bySlot(session.matches, court.number);
  const total = slotCount(session, court);

  // Starts as the real results and grows as the walk goes down the card. The
  // synthetic rows never leave this function, so nothing they carry can reach
  // the standings; engine/rotation.ts reads names off them and nothing else.
  const asPlayed: Match[] = session.matches.filter((m) => m.status === "played");

  const rows: ScheduleSlot[] = [];
  for (let slot = 1; slot <= total; slot += 1) {
    const real = held.get(slot);
    if (real) {
      rows.push({
        slot,
        matchId: real.id,
        rowId: real.id,
        teamA: real.teamA,
        teamB: real.teamB,
        scoreA: real.scoreA,
        scoreB: real.scoreB,
        status: real.status === "played" ? "played" : real.status === "skipped" ? "skipped" : "live",
      });
      if (real.status !== "played") asPlayed.push({ ...real, status: "played" });
      continue;
    }

    const drawn = nextMatch(session.players, asPlayed, court.number, court.targetMatches);
    rows.push({
      slot,
      matchId: null,
      // Stable across re-draws, because it names the slot rather than the four
      // in it. A row the operator is looking at cannot lose its tap target
      // just because a result landed on the court next door.
      rowId: `c${court.number}-s${slot}`,
      teamA: drawn?.teamA ?? null,
      teamB: drawn?.teamB ?? null,
      scoreA: null,
      scoreB: null,
      status: "waiting",
    });
    if (drawn) {
      asPlayed.push({
        id: `projected-${court.number}-${slot}`,
        courtNumber: court.number,
        matchIndex: slot,
        teamA: drawn.teamA,
        teamB: drawn.teamB,
        scoreA: 0,
        scoreB: 0,
        status: "played",
        startedAt: null,
        completedAt: null,
        stage: null,
      });
    }
  }

  // The row that goes on next is the lowest nobody has touched, which is what
  // frame 12b draws: "Up next" sits BELOW the skipped row rather than above
  // it, because stepping past a game does not put it back at the front of the
  // queue. Once every untouched row is gone the lowest skipped one takes the
  // tag, which is how a skipped game "comes back before the table settles":
  // the card holds a fixed number of rows, so the court cannot reach its
  // target without playing it.
  const upNext = rows.find((r) => r.status === "waiting") ?? rows.find((r) => r.status === "skipped");
  if (upNext) upNext.status = "upNext";
  return rows;
}

/**
 * Which game the court is playing, counted the way anybody standing there
 * counts it.
 *
 * The FEWEST games anyone has had, plus one. Not the most: a court halfway
 * through round two has players on one game and players on two, and the round
 * is the one the people still waiting are about to have. Capped at the target
 * so a finished court reads as its last round rather than one past the end.
 */
const roundOf = (session: Session, court: Court): number => {
  const counts = playableOn(session.players, court.number)
    .map((p) => matchesPlayedBy(session.matches, p.id));
  if (counts.length === 0) return 1;
  return Math.min(court.targetMatches, Math.min(...counts) + 1);
};

/**
 * Take the group match off court without losing it.
 *
 * Frame 12b's promise in one function. The four who were standing there are
 * still owed that game, so the row goes to "skipped" and waits to be returned
 * to, rather than being deleted or quietly re-drawn under different names.
 */
const parkLive = (session: Session, court: CourtNumber): Session => ({
  ...session,
  matches: session.matches.map((m) =>
    m.courtNumber === court && m.stage === null && m.status === "onCourt"
      ? { ...m, status: "skipped" as const }
      : m),
});

// The transforms below are pure and exported, and the hook's callbacks are
// thin wrappers over them that supply the clock. The screens' contract is the
// callbacks; these exist so the night's rules can be exercised without a DOM,
// because the test suite runs in node with no renderer in it.

/**
 * Put one slot on court, parking whatever was on it.
 *
 * The ONLY place a group match is minted, so a match can only ever come into
 * existence at a slot the card has already drawn. That is what makes the row
 * the operator tapped and the four who walk on the same thing, which is the
 * whole point of drawing the card up front.
 */
const putOnCourt = (session: Session, court: Court, slot: number, now: number): Session => {
  const busy = anythingLive(session.matches, court.number);
  // A bracket has no card to wait on, so a playoff tie is never parked. The
  // court finishes the tie or voids it; it does not get stepped past.
  if (busy && busy.stage !== null) return session;

  const row = scheduleFor(session, court).find((r) => r.slot === slot);
  if (!row) return session;
  // History. Frame 16 opens on a played row instead of moving the court, and
  // the way back onto a played row is to void the result, which returns all
  // four to the queue at their previous counts.
  if (row.status === "played" || row.status === "live") return session;
  if (!row.teamA || !row.teamB) return session;

  const parked = parkLive(session, court.number);

  // A skipped row keeps its id and its four, because it is the same game the
  // same people were about to play. Nothing about it is drawn again.
  if (row.matchId) {
    return {
      ...parked,
      matches: parked.matches.map((m) =>
        m.id === row.matchId ? { ...m, status: "onCourt" as const, startedAt: m.startedAt ?? now } : m),
    };
  }

  const match: Match = {
    id: `m-${court.number}-${slot}-${now.toString(36)}`,
    courtNumber: court.number,
    matchIndex: slot,
    teamA: row.teamA,
    teamB: row.teamB,
    scoreA: null,
    scoreB: null,
    status: "onCourt",
    startedAt: now,
    completedAt: null,
    stage: null,
  };
  return { ...parked, matches: [...parked.matches, match] };
};

/** Jump a court to one row of its card. See goToMatch for the rules. */
export const putSlotOnCourt = (
  session: Session, courtNumber: CourtNumber, slot: number, now: number,
): Session => {
  const court = session.courts.find((c) => c.number === courtNumber);
  return court ? putOnCourt(session, court, slot, now) : session;
};

/** Put the row that is up next on court, if nothing is playing there. */
export const playNextSlot = (
  session: Session, courtNumber: CourtNumber, now: number,
): Session => {
  const court = session.courts.find((c) => c.number === courtNumber);
  if (!court || anythingLive(session.matches, courtNumber)) return session;
  const upNext = scheduleFor(session, court).find((r) => r.status === "upNext");
  return upNext ? putOnCourt(session, court, upNext.slot, now) : session;
};

/** Step past the game on court and play the next one. See skipMatch. */
export const skipLiveMatch = (
  session: Session, courtNumber: CourtNumber, now: number,
): Session => {
  const court = session.courts.find((c) => c.number === courtNumber);
  if (!court || !groupLive(session.matches, courtNumber)) return session;
  const parked = parkLive(session, courtNumber);
  const upNext = scheduleFor(parked, court).find((r) => r.status === "upNext");
  return upNext ? putOnCourt(parked, court, upNext.slot, now) : parked;
};

/** Record a result. See recordScore for why a draw is refused. */
export const writeScore = (
  session: Session, matchId: string, scoreA: number, scoreB: number, now: number,
): Session =>
  scoreA === scoreB ? session : {
    ...session,
    matches: session.matches.map((m) => m.id !== matchId ? m : {
      ...m, scoreA, scoreB, status: "played" as const, completedAt: now,
      // Numbers and a walkover cannot share a row: whichever lands last wins.
      walkover: null,
    }),
  };

/**
 * Replace one seat in the court's live group match, bench player in, court
 * player out.
 *
 * Every refusal is a no-op rather than a throw, because a mis-tap mid-night
 * must change nothing rather than corrupt a lineup. Refused when the court has
 * no live group match, when the match already carries a score, and when the
 * swap is not one the laws allow. That last gate is a single membership check
 * against engine/substitutes.ts on purpose: legalSubstitutes already returns
 * nobody for an outId that is not in the match and never offers a bench player
 * the next lineup would be illegal with, so re-testing those cases here would
 * be a second copy of the laws waiting to drift.
 *
 * The score refusal exists because a recorded number belongs to the four who
 * played it. Swapping a seat under a score would file the result against
 * somebody who never stood on the court, and the standings would carry that
 * lie all night.
 *
 * The player coming out needs no bookkeeping. Only played matches count
 * anywhere in the engine, so stepping out of a live match leaves their played
 * count where it was and the queue re-offers them the game they are still
 * owed.
 */
export const swapInLive = (
  session: Session, courtNumber: CourtNumber, outId: string, inId: string,
): Session => {
  const live = groupLive(session.matches, courtNumber);
  if (!live) return session;
  if (live.scoreA !== null || live.scoreB !== null) return session;

  const ctx = lawContextFor(session.players, courtNumber);
  if (!legalSubstitutes(live, outId, session.players, ctx).some((p) => p.id === inId)) {
    return session;
  }
  return {
    ...session,
    matches: session.matches.map((m) => (m.id === live.id ? swapIntoMatch(m, outId, inId) : m)),
  };
};

/**
 * Throw the live lineup back and draw the row afresh.
 *
 * DELETED, not voided, and the difference is the point. A voided match is a
 * game that happened and was struck, and its row stays in the log saying so. A
 * redraw says the game never happened at all: the match row goes entirely, the
 * slot reopens as a projection, and the fresh draw is free to pick any legal
 * four instead of being anchored to the four who were standing there.
 *
 * Refused once a score exists, because a scored game is history and the way
 * back through history is to void the result (frame 16), not to erase it.
 * Refused for a playoff row, because a bracket's lineups are seeded off the
 * standings and are not the queue's to re-deal.
 *
 * The fresh draw reuses playNextSlot rather than minting a match here, so
 * putOnCourt stays the only place a group match comes into existence and the
 * redraw cannot invent a lineup the card would never have offered.
 */
export const redrawLive = (
  session: Session, courtNumber: CourtNumber, now: number,
): Session => {
  const live = anythingLive(session.matches, courtNumber);
  if (!live || live.stage !== null) return session;
  if (live.scoreA !== null || live.scoreB !== null) return session;

  const without: Session = {
    ...session,
    matches: session.matches.filter((m) => m.id !== live.id),
  };
  return playNextSlot(without, courtNumber, now);
};

/**
 * Start tonight over. "Start over clears every game and bracket. The roster
 * and tiers stay."
 *
 * Every match goes, which takes both cards and both brackets with it, and the
 * courts drop their seeding and their champions. NOTHING ABOUT A PERSON IS
 * TOUCHED: names, walk-ins, who is on which court, who is away, and every tier
 * survive, which is the whole reason the operator would reach for this rather
 * than starting a new night. Re-typing thirty names because the first round ran
 * on the wrong targets is the failure this exists to avoid.
 *
 * joinedAtMatchIndex is the one exception, and it is not roster data: it points
 * into a match log that no longer exists. Nobody arrived late to a night that
 * has not been played yet.
 *
 * Setup is left in setup. The menu is reached from a running night, and a night
 * still being built has nothing to clear, so nothing here should be able to
 * start one by accident.
 */
export const startOverSession = (session: Session, now: number): Session => ({
  ...session,
  status: session.status === "setup" ? "setup" : ("running" as const),
  startedAt: session.status === "setup" ? session.startedAt : now,
  endedAt: null,
  matches: [],
  courts: session.courts.map((c) =>
    ({ ...c, playoffSeeded: false, champion: null, ending: null })),
  players: session.players.map((p) => ({ ...p, joinedAtMatchIndex: null })),
});

/**
 * Back to the setup wizard with tonight's people intact.
 *
 * The middle ground the other two resets refuse to be. startOver stays on a
 * running night, so it cannot reopen the wizard when the courts themselves
 * were dealt wrong. beginNewNight is for an ENDED night and moves the id and
 * the date to today, so reaching for it mid-Wednesday would file tonight's
 * do-over as a different night. This one keeps the night's identity and its
 * whole roster, tiers and court assignments included, deletes every match
 * played or not, group and playoff alike, resets each court's seeding,
 * champion and ending while keeping its number and target, and returns status
 * to "setup" so the wizard reopens at the courts step.
 *
 * joinedAtMatchIndex clears for the same reason it clears in startOverSession:
 * it points into a match log that no longer exists, and nobody arrived late to
 * a night that has not been played yet.
 */
export const restartSetupSession = (session: Session): Session => ({
  ...session,
  status: "setup" as const,
  startedAt: null,
  endedAt: null,
  matches: [],
  courts: session.courts.map((c) =>
    ({ ...c, playoffSeeded: false, champion: null, ending: null })),
  players: session.players.map((p) => ({ ...p, joinedAtMatchIndex: null })),
});

/**
 * How many recorded results a restart would delete, group and playoff alike.
 *
 * The confirm sheet must name this number, because "restart setup" reads as
 * administrative while what it actually destroys is results, and a sheet that
 * cannot say how many is asking the operator to confirm blind. Played rows
 * only: a voided match already counts for nothing, and a live or skipped row
 * without a score is not yet a result anyone recorded.
 */
/**
 * Add a walk-in, idempotently by name.
 *
 * Found on the live site: after an add the search box kept its query, the
 * empty-search branch drew the "Add as a walk-in" offer AGAIN, and a second
 * tap minted a second copy of the same person. Two ids for one human splits
 * their night in two, which is the exact failure the roster dedupe exists to
 * prevent, but that dedupe checks the catalogue and a walk-in is by
 * definition not in it. So the writer refuses: a name already in tonight's
 * session, compared case-insensitively and trimmed, hands back the EXISTING
 * player's id and adds nobody. Matching a person who is already here is what
 * the second tap almost always means.
 */
export const addWalkInSession = (
  session: Session,
  name: string,
  now: number,
): { session: Session; id: string } => {
  const trimmed = name.trim();
  const existing = session.players.find(
    (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return { session, id: existing.id };
  const id = `w-${now.toString(36)}-${session.players.length}`;
  return {
    id,
    session: {
      ...session,
      players: [...session.players, {
        id, name: trimmed, walkIn: true, courtNumber: null, away: false,
        joinedAtMatchIndex: session.status === "running" ? session.matches.length + 1 : null,
      }],
    },
  };
};

export const recordedResultCount = (session: Session): number =>
  session.matches.filter((m) => m.status === "played").length;

/**
 * The number a playoff match is filed under.
 *
 * Above every group slot on the court, because a tie belongs to no slot and
 * must never land in one. engine/playoff.ts also breaks a re-mint tie on
 * matchIndex, taking the highest as the live truth, so these have to keep
 * climbing.
 */
const nextPlayoffIndex = (session: Session, court: Court): number => {
  const used = session.matches
    .filter((m) => m.courtNumber === court.number)
    .map((m) => m.matchIndex);
  return Math.max(slotCount(session, court), ...used, 0) + 1;
};

export interface CourtView {
  court: Court;
  players: Player[];
  /** The group match on court, which is the card frame 10 draws. */
  onCourt: Match | null;
  /** Frame 13: four are on court here. */
  midMatch: boolean;
  /**
   * Frame 13's terracotta dot and "score not in": a match is on court with no
   * number against it.
   *
   * Written against the score, where midMatch is written against the match, so
   * the two say different things even though tonight they always agree. The
   * night has exactly one signal that a game has ended, and it is the score
   * arriving, so nothing in the data separates a court still playing from a
   * court that finished and has not told anybody. Frame 13 draws both
   * sentences because the operator can only score the court they are standing
   * on: the court under the thumb reads "Mid match", the other one reads
   * "score not in".
   */
  scoreDue: boolean;
  /** Every row of this court's night, frames 12b and 30. */
  schedule: ScheduleSlot[];
  /** Rows in the card. Frame 10's "Match 3 of 6" is currentSlot of this. */
  matchesTotal: number;
  /** The row the court is standing on: the live one, or the one up next. */
  currentSlot: number | null;
  /**
   * Where frame 10's arrows go. They wrap rather than clamping, because the
   * list has no required order and a row stepped past has to come round again.
   * Played rows are not offered: that way back is to void the result.
   */
  previousSlot: number | null;
  nextSlot: number | null;
  /** Games everyone on this court has had, plus one. Frames 10 and 13. */
  round: number;
  queue: ReturnType<typeof buildQueue>;
  standings: StandingsRow[];
  complete: boolean;
  /**
   * Assessed C's on this court. Not a count of beginners: engine/tiers.ts
   * treats an unassessed player as B, and this counts only the ones somebody
   * actually judged, which is the number the floor of three is about.
   */
  cCount: number;
  /**
   * False when this court cannot field a legal C match at all, because fewer
   * than three C's turned up. Those C's play among the B's for the night,
   * still walled off from the A's, and the setup screen says so before the
   * night starts rather than letting it be discovered in round two.
   */
  canFieldACMatch: boolean;
  /**
   * The one B who rides with the beginner group all night, so the C's see one
   * consistent stronger face instead of a rotating cast. Null when the court
   * has no C's to protect or no B to spare.
   */
  designatedB: string | null;
  stages: Stage[] | null;
  /** The winning side. An array, because a nine-player court can seed a trio. */
  champion: string[] | null;
  ready: ReturnType<typeof readiness>;
}

export function useManageSession(storageKey: string = STORAGE_KEY) {
  const [session, setSession] = useState<Session>(emptySession);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<SyncStatus>("synced");
  const storeRef = useRef<SessionStore<Session> | null>(null);

  useEffect(() => {
    const store = createSessionStore<Session>({
      storageKey,
      schemaVersion: SCHEMA_VERSION,
      storage: window.localStorage,
      remote: null, // wired to Supabase once the route ships; local-first works today
      defaults: emptySession,
      onSyncStatusChange: setSync,
    });
    storeRef.current = store;
    void store.load().then(({ state }) => {
      setSession(state);
      setLoading(false);
    });
  }, [storageKey]);

  /** Every mutation goes through here, so nothing can write without saving. */
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const commit = useCallback((next: (s: Session) => Session) => {
    setSession((prev) => {
      const updated = next(prev);
      storeRef.current?.save(updated, Date.now());
      return updated;
    });
  }, []);

  /* ── setup ─────────────────────────────────────────────────────── */

  const setDayLabel = useCallback((dayLabel: string) =>
    commit((s) => ({ ...s, dayLabel })), [commit]);

  /**
   * Tick somebody off the club roster into tonight.
   *
   * Their id IS the roster's playerId, which is the whole reason the catalogue
   * has stable ids: the same person carries the same id from one Wednesday to
   * the next, so a night's matches can be read back against a person rather
   * than against whatever spelling got typed that evening.
   *
   * Idempotent by id. A search that lands on somebody already in cannot mint a
   * second copy of them.
   */
  const addRosterPlayer = useCallback((entry: RosterName): string => {
    commit((s) => s.players.some((p) => p.id === entry.playerId) ? s : ({
      ...s,
      players: [...s.players, {
        id: entry.playerId, name: entry.displayName, walkIn: false,
        courtNumber: null, away: false,
        joinedAtMatchIndex: s.status === "running" ? s.matches.length + 1 : null,
      }],
    }));
    return entry.playerId;
  }, [commit]);

  /**
   * A walk-in plays tonight only, so their id is minted for tonight only. The
   * `w-` prefix is not decoration: it lets any reader tell a tonight-only id
   * from a roster id without holding the catalogue.
   *
   * Returns the id because the caller usually has a second thing to do with
   * this person in the same tap. The late-arrival sheet asks which court, and
   * the answer has nowhere to land without it.
   */
  const addWalkIn = useCallback((name: string): string => {
    // The pure transform decides; this only supplies the clock. See
    // addWalkInSession for why a repeated name hands back the existing id.
    const { session: next, id } = addWalkInSession(sessionRef.current, name, Date.now());
    if (next !== sessionRef.current) commit(() => next);
    return id;
  }, [commit]);

  /**
   * Refuses anyone the match log points at, and the refusal is here rather
   * than in a screen because this is the only place a future caller cannot
   * route around.
   *
   * Deleting someone who has played does not undo their games. The match rows
   * keep their id, so the live card and the bracket start rendering that id
   * where a name belongs, and the standings table loses their row while their
   * wins keep moving everybody else's score difference. Marking them away is
   * what that case actually wants, and it is reversible.
   */
  const removePlayer = useCallback((playerId: string) =>
    commit((s) => {
      if (appearsInAMatch(s.matches, playerId)) return s;
      // A removed player leaves the draw too. A pair down to one member is no
      // pair: its remainder returns to the unpaired cloud and the draw closes
      // up, reseeded, so no ghost id can ever be dealt onto a court.
      const pairs = (s.knockoutPairs ?? [])
        .map((p) => ({ ...p, playerIds: p.playerIds.filter((id) => id !== playerId) }))
        .filter((p) => p.playerIds.length >= 2)
        .map((p, i) => ({ seed: i + 1, playerIds: p.playerIds }));
      return {
        ...s,
        players: s.players.filter((p) => p.id !== playerId),
        ...(s.knockoutPairs != null ? { knockoutPairs: pairs } : {}),
      };
    }), [commit]);

  const assignCourt = useCallback((playerId: string, courtNumber: number | null) =>
    commit((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === playerId ? { ...p, courtNumber } : p)),
    })), [commit]);

  /**
   * Tonight's tier for one player (frames 06 and 29).
   *
   * PER NIGHT, and settable at any point in one. Last week's carries over as a
   * default, B this week can be A the next, and nothing already played changes
   * when it moves: a tier decides who may go on together from here, never what
   * a finished game was worth.
   *
   * `null` is frame 29's "Not assessed" and writes the absence back rather
   * than a middle value. Unassessed is a real state with its own meaning
   * everywhere it is read, so a cleared tier has to become undefined again and
   * not "B", even though engine/tiers.ts will treat it as B when it schedules.
   * The difference is between a guess the engine makes and a judgement the
   * chip claims somebody made.
   *
   * The tier itself never reaches the court, the game or the standings. It is
   * a private note for whoever is splitting the courts.
   */
  const setTier = useCallback((playerId: string, tier: PlayerTier | null) =>
    commit((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, tier: tier ?? undefined } : p),
    })), [commit]);

  const setCourts = useCallback((numbers: number[]) =>
    commit((s) => ({
      ...s,
      courts: numbers.map((number) =>
        s.courts.find((c) => c.number === number) ??
        { number, targetMatches: 4, playoffSeeded: false, champion: null }),
    })), [commit]);

  const setTarget = useCallback((courtNumber: number, targetMatches: number) =>
    commit((s) => ({
      ...s,
      courts: s.courts.map((c) => (c.number === courtNumber ? { ...c, targetMatches } : c)),
    })), [commit]);

  /** Frame 15. Raising the target owes everyone one more; no special case. */
  const extend = useCallback((courtNumber: number, by = 1) =>
    commit((s) => ({
      ...s,
      courts: s.courts.map((c) =>
        c.number === courtNumber ? { ...c, targetMatches: c.targetMatches + by } : c),
    })), [commit]);

  const start = useCallback(() =>
    commit((s) => ({ ...s, status: "running", startedAt: Date.now() })), [commit]);

  /* ── play ──────────────────────────────────────────────────────── */

  /** Put the row that is up next on court, if that court has nobody playing. */
  const ensureOnCourt = useCallback((courtNumber: number) =>
    commit((s) => playNextSlot(s, courtNumber, Date.now())), [commit]);

  /**
   * Step past the game on court and play the next one.
   *
   * The skipped game is not cancelled and not re-drawn. Its four are still
   * owed it, the card still holds its row, and the court cannot reach its
   * target without coming back to it, which is frame 12b's "a skipped game
   * never disappears" as a fact about the arithmetic rather than a promise in
   * the copy.
   */
  const skipMatch = useCallback((courtNumber: number) =>
    commit((s) => skipLiveMatch(s, courtNumber, Date.now())), [commit]);

  /**
   * Jump the court straight to one row, from the schedule or from the arrows.
   *
   * One call covers both halves of frame 12b, because they are one mechanic:
   * going to a row nobody has reached and going back to a skipped one differ
   * only in whether the row already has four people attached to it. Whatever
   * was on court is parked on the way past.
   *
   * Keyed on the SLOT rather than a match id, because a row that has never
   * been played has no match to name.
   */
  const goToMatch = useCallback((courtNumber: number, slot: number) =>
    commit((s) => putSlotOnCourt(s, courtNumber, slot, Date.now())), [commit]);

  /**
   * Both numbers, exactly as they were played (frame 12).
   *
   * The higher score takes the 3 points, so 7-6 wins like 7-0 and the margin
   * only ever feeds score difference. Neither is fixed at a target the court
   * plays to: engine/standings.ts reads the winner off the two numbers, so
   * there is nothing here to decide.
   *
   * A DRAW IS REFUSED rather than resolved. Nobody wins an equal score, which
   * is already how engine/standings.ts counts one, so accepting it would file
   * a game that gave three points to nobody and left both sides looking as
   * though they had played a real result. Making it a no-op leaves the match
   * on court where the operator can see the number is wrong and fix it.
   */
  /**
   * A changed knockout feeder can orphan a match already dealt from it: the
   * winner the round advanced is not the winner any more. Every knockout
   * writer runs its result through here, so an orphan is voided in the same
   * commit that made it one, and the dispatcher deals the round as it now
   * stands. A no-op on every round robin.
   */
  const settleKnockout = (s: Session): Session => {
    if (s.format !== "knockout") return s;
    const orphans = orphanKnockoutMatchIds(s.knockoutPairs ?? [], s.matches, s.plate ?? false);
    if (orphans.length === 0) return s;
    return {
      ...s,
      matches: s.matches.map((m) =>
        orphans.includes(m.id) ? { ...m, status: "voided" as const } : m),
    };
  };

  const recordScore = useCallback((matchId: string, scoreA: number, scoreB: number) =>
    commit((s) => settleKnockout(writeScore(s, matchId, scoreA, scoreB, Date.now()))), [commit]);

  /** Frame 16. Refuses a draw for the same reason recordScore does. */
  const correctScore = useCallback((matchId: string, scoreA: number, scoreB: number) =>
    commit((s) => scoreA === scoreB ? s : settleKnockout({
      ...s,
      // Real numbers replace a walkover outright: a row carrying both would
      // let the flag advance one side while the score named the other.
      matches: s.matches.map((m) => m.id !== matchId
        ? m : { ...m, scoreA, scoreB, walkover: null }),
    })), [commit]);

  /** Voided counts for nothing: all four go back in the queue. */
  const voidMatch = useCallback((matchId: string) =>
    commit((s) => settleKnockout({
      ...s,
      matches: s.matches.map((m) => m.id !== matchId ? m : { ...m, status: "voided" as const }),
    })), [commit]);

  /** Swap one seat in the live group match. See swapInLive for the refusals. */
  const swapInLiveMatch = useCallback((courtNumber: number, outId: string, inId: string) =>
    commit((s) => swapInLive(s, courtNumber, outId, inId)), [commit]);

  /** Delete the live unscored group match and draw a fresh legal four. */
  const redrawLiveMatch = useCallback((courtNumber: number) =>
    commit((s) => redrawLive(s, courtNumber, Date.now())), [commit]);

  const setAway = useCallback((playerId: string, away: boolean) =>
    commit((s) => {
      const next: Session = {
        ...s,
        players: s.players.map((p) => (p.id === playerId ? { ...p, away } : p)),
      };
      if (!away) return next;
      // The leaves-early sheet promises "unplayed games rebalance", and a live
      // UNSCORED match holding the leaver is exactly an unplayed game: left
      // alone it sits waiting for a score that can never arrive. Found on the
      // live site with A3 still fielded after being marked left. A scored
      // match is untouched, because a result that happened belongs to the four
      // who played it.
      const live = s.matches.find((m) =>
        m.status === "onCourt" && m.stage === null
        && m.scoreA == null && m.scoreB == null
        && (m.teamA.includes(playerId) || m.teamB.includes(playerId)));
      if (!live) return next;
      return redrawLive(next, live.courtNumber, Date.now());
    }), [commit]);

  /* ── playoffs ──────────────────────────────────────────────────── */

  /**
   * Put the next playable playoff row on court.
   *
   * A bracket is no longer one match. Every player on the court is seeded,
   * pairs split adjacent seeds, and a full court plays a play-in, two
   * semi-finals and a final. So this runs on seeding AND again after every
   * playoff score: whichever row now has both sides resolved goes up next.
   *
   * nextTie returns only rows that are playable, meaning both sides are known,
   * nothing is already live on them and they are not settled. That is what
   * stops a semi-final going on court while the play-in that feeds it is still
   * being played, without this function having to know the bracket's shape.
   */
  const advancePlayoff = useCallback((courtNumber: number) =>
    commit((s) => {
      const ordered = orderedPlayerIds(s.players, s.matches, courtNumber);
      const pairs = seedPairs(ordered);
      if (!pairs) return s;

      const played = s.matches.filter((m) => m.courtNumber === courtNumber && m.stage !== null);
      // Something is already on court. Two playoff rows live at once on one
      // court is not a state the bracket can draw, and it is not a state four
      // people standing on a court can play.
      if (played.some((m) => m.status === "onCourt")) return s;

      const tie = nextTie(buildStages(pairs, played));
      if (!tie) {
        // Nothing playable left. Either the final is done, or the bracket is
        // waiting on a row that has not been scored, and neither wants a match.
        return { ...s, courts: s.courts.map((c) =>
          c.number === courtNumber ? { ...c, playoffSeeded: true } : c) };
      }

      const court = s.courts.find((c) => c.number === courtNumber);
      if (!court) return s;
      // The engine mints it and reads the stage off the tie, so the tag on the
      // match and the tag the bracket looks it up by cannot drift apart.
      const match = seedPlayoffMatch(courtNumber, tie, nextPlayoffIndex(s, court), Date.now(), played);
      return {
        ...s,
        courts: s.courts.map((c) => c.number === courtNumber ? { ...c, playoffSeeded: true } : c),
        matches: [...s.matches, match],
      };
    }), [commit]);

  /** Seeding is just the first advance, so there is one code path, not two. */
  const seedPlayoff = advancePlayoff;

  const deletePlayoff = useCallback((courtNumber: number) =>
    commit((s) => ({
      ...s,
      courts: s.courts.map((c) =>
        // Deleting the bracket un-chooses the ending too: the choice was "run
        // this bracket", and the bracket no longer exists to be run.
        c.number === courtNumber
          ? { ...c, playoffSeeded: false, champion: null, ending: null }
          : c),
      matches: s.matches.filter((m) => !(m.courtNumber === courtNumber && m.stage !== null)),
    })), [commit]);

  /** Record how one court chose to end. The other courts' entries are untouched. */
  const setEnding = useCallback((courtNumber: number, ending: "doublesBracket" | "oneMoreRound") =>
    commit((s) => ({
      ...s,
      courts: s.courts.map((c) => (c.number === courtNumber ? { ...c, ending } : c)),
    })), [commit]);

  /**
   * A fresh night on top of an ended one.
   *
   * endNight only sets status, and nothing on the Start-tonight path cleared
   * the matches, so ending Wednesday and starting the next week handed the
   * wizard a night where every court was already complete with last week's
   * standings. This is startOver with the status put back to setup: games and
   * brackets go, the roster and its tiers stay, and the date moves to today.
   */
  const beginNewNight = useCallback(() =>
    commit((s) => {
      const today = new Date().toISOString().slice(0, 10);
      return {
        ...startOverSession(s, Date.now()),
        id: `night-${today}`,
        date: today,
        status: "setup" as const,
        startedAt: null,
      };
    }), [commit]);

  /* ── the night menu (frame 25b) ────────────────────────────────── */

  /** Clears every game and bracket. The roster and tiers stay. */
  const startOver = useCallback(() =>
    commit((s) => startOverSession(s, Date.now())), [commit]);

  /**
   * Back to the setup wizard, roster intact, every match gone. The confirm
   * sheet should name recordedResultCount(session) before calling this.
   */
  const restartSetup = useCallback(() =>
    commit((s) => restartSetupSession(s)), [commit]);

  /**
   * Back to a blank app: every player, tier, game and bracket goes.
   *
   * Start-over is the reset for a night that went wrong; this is the reset for
   * a DEVICE that has the wrong club on it, a test session to clean off, or a
   * fresh start the operator actually wants to be fresh. It is the one action
   * in the app that loses the roster, which is why the confirm sheet in the
   * shell names exactly that.
   */
  const resetEverything = useCallback(() =>
    commit(() => emptySession()), [commit]);

  /** End the night, from any screen, at any time (frames 25b and 28c). */
  const endNight = useCallback(() =>
    commit((s) => ({ ...s, status: "ended", endedAt: Date.now() })), [commit]);

  /* ── the knockout branch (frames 30 to 33) ─────────────────────── */

  /** Which door the night went through. Set at the Sunday hub. */
  const setFormat = useCallback((format: NightFormat) =>
    commit((s) => ({ ...s, format })), [commit]);

  /** The hand-made draw, whole. Position in the array is the seeding. */
  const setKnockoutPairs = useCallback((knockoutPairs: KnockoutPair[]) =>
    commit((s) => ({ ...s, knockoutPairs })), [commit]);

  const setPlate = useCallback((plate: boolean) =>
    commit((s) => ({ ...s, plate })), [commit]);

  /**
   * Open the courts and start the knockout. Nobody is assigned to a court:
   * one draw feeds them all, and dispatchKnockout puts ties on whichever
   * court is free, in draw order.
   */
  const startKnockout = useCallback((courtCount: number) =>
    commit((s) => ({
      ...s,
      status: "running" as const,
      startedAt: Date.now(),
      // The knockout assigns nobody to a court and starts with no matches:
      // entered over a running round robin ("Start a different night"), stale
      // group matches would block the dispatcher and stale court numbers
      // would feed the round robin's own auto-fill.
      matches: [],
      players: s.players.map((p) => ({ ...p, courtNumber: null })),
      courts: Array.from({ length: Math.max(1, courtCount) }, (_, i) => ({
        number: i + 1, targetMatches: 0, playoffSeeded: true, champion: null,
      })),
    })), [commit]);

  /**
   * Fill every free court with the next playable tie, in draw order. Called
   * after every start, score, walkover and park, so a court is never idle
   * while the draw holds a tie whose sides are known.
   */
  const dispatchKnockout = useCallback(() =>
    commit((s) => {
      if (s.format !== "knockout" || s.status !== "running") return s;
      const plan = planKnockoutDispatch(
        s.knockoutPairs ?? [], s.matches, s.courts.map((c) => c.number), s.plate ?? false);
      if (plan.length === 0) return s;
      const ko = s.matches.filter((m) => m.stage !== null);
      let index = Math.max(0, ...s.matches.map((m) => m.matchIndex)) + 1;
      const minted = plan.map(({ courtNumber, tie }, i) =>
        seedPlayoffMatch(courtNumber, tie, index++, Date.now() + i, ko));
      return { ...s, matches: [...s.matches, ...minted] };
    }), [commit]);

  /**
   * Frame 33's "Opponent advances", after its confirm names the side. The
   * named side takes the tie without playing: scores stay null, the bracket
   * writes Walkover, and the winner moves on exactly as a scored win would.
   */
  const walkoverMatch = useCallback((matchId: string, side: "A" | "B") =>
    commit((s) => ({
      ...s,
      matches: s.matches.map((m) => m.id === matchId && m.status === "onCourt"
        ? { ...m, status: "played" as const, walkover: side, completedAt: Date.now() }
        : m),
    })), [commit]);

  /**
   * Frame 33's "Change this match": this court takes a different waiting tie
   * and the one standing here goes back to the queue for the next free
   * court. Refused (returns unchanged) when the draw holds no other playable
   * tie, and the shell disables the control for the same reason.
   */
  const parkKnockoutTie = useCallback((matchId: string) =>
    commit((s) => {
      const current = s.matches.find((m) => m.id === matchId);
      if (!current || current.status !== "onCourt") return s;
      const voided = s.matches.map((m) => m.id === matchId ? { ...m, status: "voided" as const } : m);
      const ko = voided.filter((m) => m.stage !== null);
      const pairs = s.knockoutPairs ?? [];
      const main = buildKnockoutStages(pairs, ko);
      const plate = s.plate ? buildPlateStages(pairs, ko) : null;
      // The parked tie is playable again the moment its match is voided, so
      // the swap is "everything playable except the tie that was standing
      // here", first in draw order.
      // Membership runs the way binding does: the fielded four are drawn FROM
      // the sides, so the test is team-subset-of-side, which holds for a trio
      // whose third player was resting.
      const queue = playableTies([...main, ...(plate ?? [])]).filter((t) =>
        !(current.teamA.every((id) => t.sideA.playerIds.includes(id))
          && current.teamB.every((id) => t.sideB.playerIds.includes(id))));
      const next = queue[0];
      if (!next) return s;
      const index = Math.max(0, ...voided.map((m) => m.matchIndex)) + 1;
      return { ...s, matches: [...voided, seedPlayoffMatch(current.courtNumber, next, index, Date.now(), ko)] };
    }), [commit]);

  /* ── derived ───────────────────────────────────────────────────── */

  // Every court is derived from its own players and its own matches and from
  // nothing else, which is what lets both courts run at once (frame 13). No
  // field below reads another court's state, so flipping the chips mid match,
  // mid score, mid anything cannot disturb the court being left behind.
  const views: CourtView[] = useMemo(() => session.courts.map((court) => {
    const players = session.players.filter((p) => p.courtNumber === court.number);
    const here = playableOn(session.players, court.number);
    const played = groupPlayed(session.matches, court.number);
    const ids = standingsIds(players, played, court.number);
    const playoffMatches = session.matches.filter(
      (m) => m.courtNumber === court.number && m.stage !== null,
    );
    const pairs = court.playoffSeeded
      ? seedPairs(orderedPlayerIds(session.players, session.matches, court.number))
      : null;
    const stages = pairs ? buildStages(pairs, playoffMatches) : null;

    const schedule = scheduleFor(session, court);
    const live = groupLive(session.matches, court.number);
    const current = schedule.find((r) => r.status === "live")
      ?? schedule.find((r) => r.status === "upNext")
      ?? null;

    // The arrows walk the card and wrap round the ends rather than greying out,
    // because the list has no required order and a row stepped past has to come
    // round again. Played rows are stepped over: the way back onto one of those
    // is to void the result, which is frame 16 rather than an arrow.
    const reachable = schedule.filter((r) => r.status !== "played" && r.slot !== current?.slot);
    const before = current ? reachable.filter((r) => r.slot < current.slot) : [];
    const after = current ? reachable.filter((r) => r.slot > current.slot) : [];
    const previousSlot = current
      ? (before.length ? before[before.length - 1] : reachable[reachable.length - 1])?.slot ?? null
      : null;
    const nextSlot = current
      ? (after.length ? after[0] : reachable[0])?.slot ?? null
      : null;

    const tiers = here.map(tierOfPlayer);
    return {
      court,
      players,
      onCourt: live,
      midMatch: live !== null,
      scoreDue: live !== null && live.scoreA === null && live.scoreB === null,
      schedule,
      matchesTotal: schedule.length,
      currentSlot: current?.slot ?? null,
      previousSlot,
      nextSlot,
      round: roundOf(session, court),
      queue: buildQueue(session.players, session.matches, court.number, court.targetMatches),
      standings: computeStandings(ids, played),
      complete: courtComplete(session.players, session.matches, court.number, court.targetMatches),
      cCount: tiers.filter((t) => t === "C").length,
      canFieldACMatch: canFieldACMatch(tiers),
      designatedB: designateB(session.players, court.number),
      stages,
      champion: stages ? (champion(stages)?.playerIds ?? null) : null,
      ready: readiness(session.players, session.matches, court.number, court.targetMatches),
    };
  }), [session]);

  const playerName = useCallback(
    (id: string) => session.players.find((p) => p.id === id)?.name ?? id,
    [session.players],
  );

  /**
   * The knockout night, derived whole. Null on a round robin, which is every
   * night saved before the branch existed. One object because one draw feeds
   * every court: nothing in it is per-court.
   */
  const knockout = useMemo(() => {
    if (session.format !== "knockout") return null;
    const pairs = session.knockoutPairs ?? [];
    const ko = session.matches.filter((m) => m.stage !== null);
    const main = buildKnockoutStages(pairs, ko);
    const plate = session.plate ? buildPlateStages(pairs, ko) : null;
    const stages = [...main, ...(plate ?? [])];
    const finalTie = main.find((st) => st.key === "final")?.ties[0] ?? null;
    const plateFinalTie = plate?.find((st) => st.key === "plateFinal")?.ties[0] ?? null;
    const w = (t: typeof finalTie) => {
      if (!t || !t.settled) return null;
      if (t.walkover) return t.walkover === "A" ? t.sideA : t.sideB;
      if (t.scoreA == null || t.scoreB == null || t.scoreA === t.scoreB) return null;
      return t.scoreA > t.scoreB ? t.sideA : t.sideB;
    };
    return {
      pairs,
      main,
      plate,
      stages,
      /** Every tie in play order, for the pager. */
      ties: stages.flatMap((st) => st.ties.map((tie) => ({ stage: st, tie }))),
      upNext: playableTies(stages),
      champion: w(finalTie),
      plateChampion: w(plateFinalTie),
      finalTie,
    };
  }, [session]);

  return {
    session, loading, sync, views, playerName, knockout,
    matchesPlayedBy: (id: string) => matchesPlayedBy(session.matches, id),
    setDayLabel, addRosterPlayer, addWalkIn, removePlayer, assignCourt, setTier,
    setCourts, setTarget, extend, start,
    ensureOnCourt, skipMatch, goToMatch, recordScore, correctScore, voidMatch, setAway,
    swapInLiveMatch, redrawLiveMatch,
    seedPlayoff, advancePlayoff, deletePlayoff, setEnding, beginNewNight, startOver,
    setFormat, setKnockoutPairs, setPlate, startKnockout, dispatchKnockout,
    walkoverMatch, parkKnockoutTie,
    restartSetup, resetEverything, endNight,
  };
}

export type UseManageSession = ReturnType<typeof useManageSession>;
