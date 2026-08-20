// Who plays next.
//
// The frames state the rule in one line: "Whoever is owed a game is at the
// top." Everything here is that sentence made precise.
//
// A player is OWED the difference between the court's target and the games
// they have actually had. That framing matters more than "least played":
// someone who arrives at match 9 is owed as much as everyone else, so the
// queue pulls them in immediately rather than making them wait out the
// backlog they were never part of. It is also what makes an extended target
// (frame 15) work without special-casing. Raise the target and everyone is
// owed one more.
//
// On top of that sits the balance rule (frame 11), which is about WHO is on
// together rather than who is on at all. Two rules, one deliberate priority
// between them, both documented at the point they are enforced.
//
// Pure. No clock, no randomness, no IO: the same court in the same state
// always produces the same next four, which is what makes a mis-tap
// recoverable and the whole thing testable.

import type { Match, Player, PlayerTier, QueueEntry } from "../types";
import {
  canFieldACMatch, chooseFour, designateB, tierOf as tierOfPlayer,
  type LawContext,
} from "./tiers";

const isPlayable = (p: Player, court: number) =>
  p.courtNumber === court && !p.away;

/** Completed matches only. A match on court has not been "had" yet. */
const countsAsPlayed = (m: Match) => m.status === "played";

export function matchesPlayedBy(matches: readonly Match[], playerId: string): number {
  return matches.filter(
    (m) => countsAsPlayed(m) && [...m.teamA, ...m.teamB].includes(playerId),
  ).length;
}

/**
 * The court's queue, most-owed first. Ties break on the player's position in
 * the roster so the order never wobbles between renders, because a queue
 * that reshuffles itself while someone reads it is worse than a wrong queue.
 */
export function buildQueue(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
): QueueEntry[] {
  return players
    .filter((p) => isPlayable(p, court))
    .map((p, i) => {
      const played = matchesPlayedBy(matches, p.id);
      return {
        playerId: p.id,
        name: p.name,
        matchesPlayed: played,
        owed: Math.max(0, targetMatches - played),
        _seat: i,
      };
    })
    .sort((a, b) => b.owed - a.owed || a.matchesPlayed - b.matchesPlayed || a._seat - b._seat)
    .map(({ _seat, ...entry }) => entry);
}

/* ── the balance rule, and the words the screen puts around it ───── */

/** A name and the count frame 11 prints beside it. */
export interface ReasonPlayer {
  playerId: string;
  name: string;
  matchesPlayed: number;
}

/** A C-tier player in the match, and which side of the net they are on. */
export interface BalanceMember {
  playerId: string;
  name: string;
  side: "A" | "B";
}

/**
 * What the balance rule managed to do for this particular match.
 *
 * These name situations, not verdicts, so a screen can never print a sentence
 * the match does not support. "alongside" exists because explainMatch is
 * allowed to describe a match this module did not choose, and describing a
 * hand-arranged match as balanced would be a lie told in the operator's own
 * voice.
 */
export type BalanceKind =
  /** Nobody in this match carries a C chip, so there is nothing to balance. */
  | "noAssessedC"
  /** Exactly one C, with no counterpart available. See balanceFour. */
  | "loneC"
  /** Two or more Cs, at least one on each side. The rule, satisfied. */
  | "acrossTheNet"
  /** Two or more Cs, all on the same team. Only reachable by hand. */
  | "alongside";

export interface BalanceNote {
  kind: BalanceKind;
  /** The C-tier players in this match, in queue order. */
  cPlayers: BalanceMember[];
  /**
   * Who was pulled forward to give a lone C a counterpart, and who stepped
   * back a round to make room. Null when nothing was swapped, and also null
   * when the reason was reconstructed from a match already on court: the
   * displaced player is a counterfactual, and a match on its own cannot know
   * one.
   */
  swap: { inPlayerId: string; inName: string; outPlayerId: string; outName: string } | null;
}

/**
 * Everything frame 11 needs to justify the four on court.
 *
 * The screen is a real screen an operator reads out to a player who asked why
 * they are sitting. It gets structured data rather than a sentence, so the
 * copy stays in the frame's voice and the engine stays the only thing that
 * knows the rules.
 */
export interface MatchReason {
  /** The four on court, in queue order. Frame 11 lists these names. */
  leastPlayed: ReasonPlayer[];
  /** Widest gap in played counts across the court, right now. */
  courtSpread: number;
  /** Frame 11's "never more than one game behind", as fact rather than promise. */
  withinOneGame: boolean;
  balance: BalanceNote;
}

const tierOf = (players: readonly Player[]): ReadonlyMap<string, PlayerTier | undefined> =>
  new Map(players.map((p) => [p.id, p.tier]));


export interface NextMatch {
  teamA: [string, string];
  teamB: [string, string];
  /** Why these four, and why on these sides. Frame 11 renders it verbatim. */
  reason: MatchReason;
}

/**
 * Pick the four, honouring the balance rule as far as the queue allows.
 *
 * ORDERING WINS. Least-played-first is the hard guarantee the spec states out
 * loud, "played counts can never drift more than one game apart", and a
 * fairness rule that starves someone of games is not fairness. So a
 * substitution is only ever made INSIDE a tie band: the player pulled in must
 * have played exactly as many games as the player they replace. That leaves
 * the multiset of played counts among the chosen four untouched, so the four
 * are still a valid least-played four, only tie-broken differently. Reaching
 * one row further down the queue than that would let one player finish a game
 * ahead of somebody who has been waiting longer, which is the exact failure
 * the spec says is structurally impossible here.
 *
 * WHEN EXACTLY ONE C IS IN THE FOUR we pull a second C forward rather than
 * defer the lone one. Deferring is the tempting fix, and it is wrong: the C is
 * the player the rule exists to protect, so pushing them off court to satisfy
 * it turns their protection into their punishment, and on a court whose Cs are
 * spread thin it would push the same person back round after round. Pulling a
 * counterpart in costs nobody a game. The player who steps back is the
 * next-most-owed on the court, so they sort straight to the top of the queue
 * and go on in the following round, still inside frame 11's promise that
 * "nobody on this court is ever more than one game behind".
 *
 * When no substitute shares the band, the lone C plays. The rule did what it
 * could, the reason says so honestly with kind "loneC", and the ordering
 * guarantee survives intact.
 */
/**
 * The four who play next, and which side of the net each stands on.
 *
 * This used to be two local helpers: one that swapped a lone C for a second C,
 * and one that checked a pairing kept the Cs apart. Both encoded a softer rule
 * than the club actually runs. The real laws live in ./tiers and are stricter
 * in two ways that matter: an A is never in a match with a C under any
 * circumstances, and a C match is only ever four Cs or three Cs plus the one
 * designated B who rides with the group all night.
 *
 * The ordering guarantee is unchanged and still comes first. chooseFour walks
 * combinations in queue order and takes the lowest total queue position that
 * the laws allow, so the laws decide who MAY play together and never who is
 * owed a game.
 */
/**
 * The laws as they apply to one court tonight.
 *
 * `relaxed` is not a setting, it is a fact about who turned up. Below three Cs
 * no legal C match can be formed at all, so those Cs play among the Bs for the
 * night. The setup screen says so before the night starts rather than letting
 * it be discovered in round two. The wall between A and C is not part of what
 * relaxes.
 */
export function lawContextFor(players: readonly Player[], court: number): LawContext {
  const onCourt = players.filter((p) => p.courtNumber === court && !p.away);
  const byId = new Map(onCourt.map((p) => [p.id, tierOfPlayer(p)]));
  return {
    tierById: (id) => byId.get(id) ?? "B",
    designatedB: designateB(players, court),
    relaxed: !canFieldACMatch(onCourt.map(tierOfPlayer)),
    cCount: onCourt.filter((p) => tierOfPlayer(p) === "C").length,
  };
}

function lawfulFour(
  queue: readonly QueueEntry[],
  ctx: LawContext,
): { four: QueueEntry[]; teamA: [string, string]; teamB: [string, string];
     swap: BalanceNote["swap"] } | null {
  const byId = new Map(queue.map((e) => [e.playerId, e]));
  const played = new Map(queue.map((e) => [e.playerId, e.matchesPlayed]));
  const chosen = chooseFour(queue.map((e) => e.playerId), ctx,
    { playedBy: (id) => played.get(id) ?? 0 });
  if (!chosen) return null;

  const ids = [...chosen.lineup.teamA, ...chosen.lineup.teamB];
  const four = ids.map((id) => byId.get(id)!);

  // Who was passed over, for frame A11's explanation. Anyone ahead in the
  // queue who is not in the chosen four was skipped to satisfy a law, and the
  // first of them is the one worth naming.
  const chosenSet = new Set(ids);
  const head = queue.slice(0, 4).find((e) => !chosenSet.has(e.playerId));
  const pulled = four.find((e) => queue.indexOf(e) >= 4);
  const swap = head && pulled
    ? { inPlayerId: pulled.playerId, inName: pulled.name,
        outPlayerId: head.playerId, outName: head.name }
    : null;

  return { four, teamA: [...chosen.lineup.teamA] as [string, string],
           teamB: [...chosen.lineup.teamB] as [string, string], swap };
}

/**
 * The next four off the queue, split into pairs.
 *
 * Returns null when fewer than four are available, so the caller shows the
 * bench/empty state rather than inventing a three-player game.
 */
export function nextMatch(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
): NextMatch | null {
  // Nobody owed a game means the round robin is over. Without this the court
  // happily drew a fifth round of a four-round night. The queue always has
  // four names in it, so "are there four people" is not the question. The
  // question is whether anyone is still owed.
  if (courtComplete(players, matches, court, targetMatches)) return null;
  const queue = buildQueue(players, matches, court, targetMatches);
  if (queue.length < 4) return null;

  const chosen = lawfulFour(queue, lawContextFor(players, court));
  // No lawful four exists. A court holding one C and three As has no legal
  // match in it at all, and handing back the least-played four anyway would
  // put that C in a game with three As, which is the one thing the laws never
  // allow. The caller shows the bench rather than an illegal game.
  if (!chosen) return null;

  const { teamA, teamB, swap } = chosen;
  const reason = explainMatch(players, matches, court, teamA, teamB);
  return { teamA, teamB, reason: { ...reason, balance: { ...reason.balance, swap } } };
}

/**
 * Describe a match that already exists, in the same shape nextMatch returns.
 *
 * Frame 11 is reached from a court that is mid-match, so the explanation has
 * to be derivable from the persisted match rather than only from the moment it
 * was drawn. `matches` should be the night's matches; a match on court counts
 * for nobody, so passing the full list and the match's own sides gives the
 * counts as they stood when the four walked on.
 */
export function explainMatch(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  teamA: readonly [string, string],
  teamB: readonly [string, string],
): MatchReason {
  const byId = new Map(players.map((p) => [p.id, p]));
  const seat = new Map(players.map((p, i) => [p.id, i]));

  // Queue order, rebuilt without needing the target: owed is a decreasing
  // function of games played, so sorting on played ascending gives exactly the
  // order buildQueue would, and the roster seat breaks ties the same way.
  const leastPlayed: ReasonPlayer[] = [...teamA, ...teamB]
    .map((id) => ({
      playerId: id,
      name: byId.get(id)?.name ?? id,
      matchesPlayed: matchesPlayedBy(matches, id),
    }))
    .sort(
      (a, b) =>
        a.matchesPlayed - b.matchesPlayed ||
        (seat.get(a.playerId) ?? 0) - (seat.get(b.playerId) ?? 0),
    );

  // Guarded rather than spread straight into Math.max: an empty court would
  // otherwise report a spread of -Infinity and the screen would print it.
  const counts = players.filter((p) => isPlayable(p, court)).map((p) => matchesPlayedBy(matches, p.id));
  const courtSpread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;

  const cPlayers: BalanceMember[] = leastPlayed
    .filter((p) => byId.get(p.playerId)?.tier === "C")
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      side: teamA.includes(p.playerId) ? "A" : "B",
    }));
  const sides = new Set(cPlayers.map((c) => c.side));
  const kind: BalanceKind =
    cPlayers.length === 0 ? "noAssessedC"
      : cPlayers.length === 1 ? "loneC"
        : sides.size === 2 ? "acrossTheNet"
          : "alongside";

  return {
    leastPlayed,
    courtSpread,
    withinOneGame: courtSpread <= 1,
    balance: { kind, cPlayers, swap: null },
  };
}

/** Is every playable player on this court at or past the target? */
export function courtComplete(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
): boolean {
  const playable = players.filter((p) => isPlayable(p, court));
  if (playable.length === 0) return false;
  return playable.every((p) => matchesPlayedBy(matches, p.id) >= targetMatches);
}

/**
 * Targets that divide the room evenly.
 *
 * Every game needs four players, so a court of N running a target of T plays
 * N*T/4 matches, and that has to be a whole number or somebody ends the
 * night one game short. The setup screen (frame 08) offers only these.
 */
export function validTargets(courtSize: number): number[] {
  const out: number[] = [];
  for (let t = 2; t <= 8; t++) if ((courtSize * t) % 4 === 0) out.push(t);
  return out;
}

/** Matches a court will play in total at this size and target. */
export function totalMatches(courtSize: number, targetMatches: number): number {
  return (courtSize * targetMatches) / 4;
}
