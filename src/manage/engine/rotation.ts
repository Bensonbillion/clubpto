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
  abLawFor, canFieldACMatch, chooseFour, designateB, tierOf as tierOfPlayer,
  type LawContext, type Tier,
} from "./tiers";
import {
  deficit, slackFor, stateOf,
  type MixingA, type MixingB, type MixingC, type MixingState, type Seat,
} from "./mixing";

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

/**
 * The bench: the queue with the four on court taken out. The queue itself
 * keeps them, because "owed" is about the whole court and the picker needs
 * everyone, but the card's "Waiting, on next" is the people watching, and on
 * a fresh night the four playing are owed exactly as much as the four
 * watching, so a plain slice of the queue named the players on court as the
 * ones waiting (2026-09-10). A skipped game holds nobody: its four are
 * waiting like anyone else until it comes back on.
 */
export function bench(
  queue: readonly QueueEntry[],
  matches: readonly Match[],
  court: number,
): QueueEntry[] {
  const onCourt = new Set(
    matches
      .filter((m) => m.courtNumber === court && m.status === "onCourt")
      .flatMap((m) => [...m.teamA, ...m.teamB]),
  );
  return queue.filter((e) => !onCourt.has(e.playerId));
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
 * What the third law (one game with the B's, never a second) did for this
 * match, so frame 11 can say why an A is playing A's or why a least-played
 * pair waited a game.
 */
export type MixingKind =
  /** No A in the match, so the law is silent. */
  | "noAs"
  /** A's among A's: they have had their game with the B's, or are keeping it. */
  | "pure"
  /** The A's in it are having their one game with the B's. */
  | "firstBGame"
  /** An A in it is meeting the B's again: the seats forced it. */
  | "secondBGame";

/**
 * An A in the match, with the games they had had with the B's BEFORE this
 * one.
 *
 * The count is the whole reason this is an object rather than a name. A card
 * that reads "for one of them it is a second game" off a bare list is wrong
 * the moment somebody is on their third, and on the courts that bend the law
 * a third happens (2026-09-10). Zero is an A having their one game; one or
 * more is an A meeting the B's again, and the card says which time it is.
 */
export interface MixingMember {
  name: string;
  bGames: number;
}

export interface MixingNote {
  kind: MixingKind;
  /** The A's in the match, in queue order. */
  aPlayers: MixingMember[];
  /**
   * Players who had played fewer games than somebody in this four and were
   * passed over because dealing them would have cost an A a second B game.
   * Empty when the four are the least played the laws allow, and empty when
   * a match already on court could not be matched to a draw, for the same
   * reason BalanceNote.swap is: who was passed over is a counterfactual a
   * match on its own cannot know. explainMatch recovers it by replaying the
   * draw when it is given the court's target; see pickerNote.
   */
  heldBack: { name: string }[];
  /**
   * Why they waited, read only when heldBack has names in it. "secondGame"
   * is the ordinary answer: the four they were in would have charged an A a
   * second game with the B's, this game or later tonight. "unfinished" is
   * the other one: that four priced higher only because the seats it left
   * behind cannot be dealt out into whole lawful games, so somebody would
   * have finished short. Carries the ordinary answer on a draw that held
   * nobody back, where nothing reads it, and is absent on a note read back
   * off the log, where heldBack is empty by design.
   */
  heldBackBy?: "secondGame" | "unfinished";
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
  mixing: MixingNote;
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
    abLaw: abLawFor(onCourt.map(tierOfPlayer)),
    cCount: onCourt.filter((p) => tierOfPlayer(p) === "C").length,
  };
}

/** An unordered pair of players as one map key, the same key both ways round. */
const pairKey = (x: string, y: string) => (x < y ? `${x}\u0000${y}` : `${y}\u0000${x}`);

/** The exact four, in any arrangement, as one map key. */
const fourKey = (ids: readonly string[]) => [...ids].sort().join(",");

const bump = (tally: Map<string, number>, key: string) =>
  tally.set(key, (tally.get(key) ?? 0) + 1);

/**
 * One pass over this court's group matches, tallying everything the picker
 * asks about a four: how often each pair has shared a court (`met`), how
 * often each pair has stood on the same side (`partnered`), how often each
 * exact four has played (`fours`), and how many mixed games each player has
 * had (`mixed`, a game with an A and a B in it, tiers read as they stand
 * now, so a player since moved off this court reads as a B, as they always
 * did here). Voided matches count for nothing.
 */
function countLog(
  matches: readonly Match[],
  court: number,
  ctx: LawContext,
): { met: Map<string, number>; partnered: Map<string, number>;
     fours: Map<string, number>; mixed: Map<string, number> } {
  const met = new Map<string, number>();
  const partnered = new Map<string, number>();
  const fours = new Map<string, number>();
  const mixed = new Map<string, number>();
  for (const m of matches) {
    if (m.courtNumber !== court || m.stage !== null || m.status === "voided") continue;
    const four = [...m.teamA, ...m.teamB];
    // Distinct ids, so a match counts once for a pair however it is written.
    const ids = [...new Set(four)];
    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) bump(met, pairKey(ids[x], ids[y]));
    }
    for (const side of [m.teamA, m.teamB]) {
      if (side[0] !== side[1]) bump(partnered, pairKey(side[0], side[1]));
    }
    bump(fours, fourKey(four));
    const tiers = four.map(ctx.tierById);
    if (tiers.includes("A") && tiers.includes("B")) for (const id of ids) bump(mixed, id);
  }
  return { met, partnered, fours, mixed };
}

/**
 * How many games with a B in them each A has had THIS SESSION, from the
 * group rows `include` admits on any court.
 *
 * Per session and across courts, because that is the owner's rule: "an A
 * should not get more than one B game throughout the whole session". A
 * player moved between courts (frame 28) keeps their count. Tiers are read
 * off the full roster, not a court's LawContext, whose tierById answers "B"
 * for anyone off that court and would have read every A moved in from
 * elsewhere as a B. A player no longer on the roster reads as B, the way an
 * unassessed player does, so a game with them in it counts against the A's
 * who were in it. Every A in a game with a B is charged, which under the
 * free law (a lone B among A's) is what spreads that B's games across the
 * A's rather than stacking them on one.
 */
function countBGames(
  players: readonly Player[],
  matches: readonly Match[],
  include: (m: Match) => boolean,
): Map<string, number> {
  const tiers = new Map(players.map((p) => [p.id, tierOfPlayer(p)]));
  const tier = (id: string): Tier => tiers.get(id) ?? "B";
  const out = new Map<string, number>();
  for (const m of matches) {
    if (m.stage !== null || !include(m)) continue;
    const ids = [...new Set([...m.teamA, ...m.teamB])];
    if (!ids.some((id) => tier(id) === "B")) continue;
    for (const id of ids) if (tier(id) === "A") bump(out, id);
  }
  return out;
}

/** The queue's played counts for these four, sorted: the fairness key. */
const playedVector = (played: ReadonlyMap<string, number>, ids: readonly string[]) =>
  ids.map((id) => played.get(id) ?? 0).sort((m, n) => m - n);

/** Is the first played vector strictly fairer than the second? */
const fairerThan = (k: readonly number[], b: readonly number[]) => {
  for (let n = 0; n < k.length; n++) if (k[n] !== b[n]) return k[n] < b[n];
  return false;
};

/**
 * The price of a four the oracle cannot finish the seats behind. Large
 * enough that it ranks below any four that can be finished, and small
 * enough that the charge still separates two that cannot: when nothing
 * fits, the second games still spread. The held-back note reads it too, to
 * tell apart the two reasons a fairer four can be passed over.
 */
const NO_FINISH = 1e6;

function lawfulFour(
  queue: readonly QueueEntry[],
  ctx: LawContext,
  matches: readonly Match[],
  court: number,
  players: readonly Player[],
): { four: QueueEntry[]; teamA: [string, string]; teamB: [string, string];
     swap: BalanceNote["swap"]; mixing: MixingNote } | null {
  const byId = new Map(queue.map((e) => [e.playerId, e]));
  const played = new Map(queue.map((e) => [e.playerId, e.matchesPlayed]));
  // The log, counted once a draw. The picker asks four questions of every
  // four in the queue: have these two met, have these two partnered, has
  // this exact four played, and how many mixed games has each had. Until
  // 2026-09-10 every answer was a fresh scan of the match log, and on the
  // Wednesday roster (twenty on one court, 4845 fours a draw, six pairs
  // each) that came to 58 to 89 ms a draw, which scheduleFor paid fifteen
  // to twenty-five times over on every tap. So the log is walked ONCE here
  // into four tallies, and the closures handed to chooseFour read them.
  // The answers are the same to the count, so the tie-breaks are the same.
  //
  // Group matches on this court only, and voided ones count for nothing
  // here the same way they count for nothing everywhere. These tallies
  // include onCourt and skipped rows while buildQueue counts only status
  // "played", so the two only agree on a log whose held rows are already
  // seeded as played. That is what scheduleFor hands in, and it is why
  // anything replaying a draw has to seed the same way (explainMatch does,
  // through asCardDrew); both are read from the one `matches` argument.
  const tallies = countLog(matches, court, ctx);
  // Partnership counts feed the variety preference: who has already stood on
  // the same side of the net tonight.
  const partnered = (x: string, y: string) => tallies.partnered.get(pairKey(x, y)) ?? 0;
  // Who has shared a court at all tonight, either side of the net: the
  // measure that keeps the same four from coming round again.
  const met = (x: string, y: string) => tallies.met.get(pairKey(x, y)) ?? 0;
  const bridgeBusy = queue.some((e) => e.owed > 0 && ctx.tierById(e.playerId) === "C");
  // The mixing law by what is still owed, not by headcount: strict only
  // while the games the A's still owe and the games the B's still owe are
  // both even, because a strict game spends A-slots in twos, and an odd
  // total would leave one player waiting a whole game while others played
  // twice. Found by the review's fuzz: a walk-in or a leaver mid-night can
  // flip the parity of an evenly matched court.
  const owedOf = (tier: "A" | "B") => queue
    .filter((e) => ctx.tierById(e.playerId) === tier)
    .reduce((sum, e) => sum + e.owed, 0);
  const law = ctx.abLaw === "free" ? "free"
    : (owedOf("A") % 2 === 0 && owedOf("B") % 2 === 0) ? "strict" : "soft";
  const lawCtx: LawContext = { ...ctx, abLaw: law };
  // Mixed games had so far: a game with an A and a B on each side.
  const mixed = (id: string) => tallies.mixed.get(id) ?? 0;
  // The whole queue, not a window of twelve: on a court of twenty the twelve
  // most owed can all be one tier, and the lawful fairest four sat past the
  // window's edge while somebody played a fourth game. A few thousand fours
  // a draw is nothing.
  // The exact four, in any arrangement, as it stands in the log tonight.
  const sameFour = (ids: readonly string[]) => tallies.fours.get(fourKey(ids)) ?? 0;
  // The lowest band still owed a game: the picker looks at what a choice
  // leaves in it, because those four play next whatever else is true.
  const stillOwed = queue.filter((e) => e.owed > 0);
  const lowest = Math.min(...stillOwed.map((e) => e.matchesPlayed));
  const band = stillOwed.filter((e) => e.matchesPlayed === lowest);
  const bands: string[][] = [band.map((e) => e.playerId)];

  // THE THIRD LAW, looked ahead (2026-09-10). The B games each A has had
  // are counted per SESSION and across courts, from every non-voided group
  // row on any court, with tiers off the full roster. Two things about that
  // count are worth knowing. It includes onCourt and skipped rows while
  // buildQueue counts only status "played" for what is owed, so the two
  // agree only on a log whose held rows are already seeded as played, which
  // is what scheduleFor hands in and what asCardDrew rebuilds for a replay.
  // Both are read off the one `matches` argument, so a caller who seeds it
  // the same way gets the same answer. And a tier flipped mid-night is read
  // through current tiers on both sides, which is fine: the count follows
  // the assessment as it stands.
  const bGames = countBGames(players, matches, (m) => m.status !== "voided");
  const tierHere = (id: string) => ctx.tierById(id);
  const hasA = queue.some((e) => tierHere(e.playerId) === "A");
  const hasB = queue.some((e) => tierHere(e.playerId) === "B");
  let cost: ((ids: readonly string[]) => number) | undefined;
  let charge: ((ids: readonly string[]) => number) | undefined;
  // The oracle is only worth asking on a court with an A and a B; anywhere
  // else no four can charge anybody and the cost is 0 for every four.
  if (hasA && hasB) {
    // The court as the oracle sees it: everyone playable, at-target players
    // included at owed 0, because the slack seats (a card that grew after a
    // walk-in or a leaver) go to an at-target member of a class when one
    // exists. Each entry is given a class once per draw: tier, games owed,
    // B games had for an A, bridge or not for a B. Two fours of the same
    // classes leave after-states the oracle prices the same, so the memo is
    // keyed on the sorted class ids of a four packed into one number, never
    // a string; on the Wednesday roster there are a dozen classes and a few
    // thousand fours a draw.
    const as: MixingA[] = [];
    const bs: MixingB[] = [];
    const cs: MixingC[] = [];
    const seatOf = new Map<string, { tier: Tier; at: number }>();
    const classIds = new Map<string, number>();
    const classOf = new Map<string, number>();
    let owedSeats = 0;
    for (const e of queue) {
      const tier = tierHere(e.playerId);
      const had = bGames.get(e.playerId) ?? 0;
      const bridge = e.playerId === ctx.designatedB;
      owedSeats += e.owed;
      let at: number;
      if (tier === "A") { at = as.length; as.push({ owed: e.owed, bGames: had }); }
      else if (tier === "B") { at = bs.length; bs.push({ owed: e.owed, bridge }); }
      else { at = cs.length; cs.push({ owed: e.owed }); }
      seatOf.set(e.playerId, { tier, at });
      const cls = `${tier}${e.owed}:${tier === "A" ? had : tier === "B" && bridge ? 1 : 0}`;
      let id = classIds.get(cls);
      if (id === undefined) { id = classIds.size; classIds.set(cls, id); }
      classOf.set(e.playerId, id);
    }
    const state: MixingState = {
      as, bs, cs,
      headcountLaw: ctx.abLaw === "free" ? "free" : "bound",
      relaxed: ctx.relaxed,
      slack: slackFor(owedSeats),
    };
    const base = classIds.size;
    const memo = new Map<number, number>();
    charge = (ids) => {
      if (!ids.some((id) => seatOf.get(id)?.tier === "B")) return 0;
      let sum = 0;
      for (const id of ids) if (seatOf.get(id)?.tier === "A") sum += bGames.get(id) ?? 0;
      return sum;
    };
    cost = (ids) => {
      const cls = ids.map((id) => classOf.get(id)!).sort((m, n) => m - n);
      const key = ((cls[0] * base + cls[1]) * base + cls[2]) * base + cls[3];
      const hit = memo.get(key);
      if (hit !== undefined) return hit;
      // The court after these four play: the owed come down one, an
      // at-target member spends a slack seat, and an A in a four with a B
      // has had a B game. The charge for that game is added here, not in
      // the state, so the oracle prices only what is still to come.
      const after: MixingState = {
        ...state,
        as: as.map((a) => ({ ...a })),
        bs: bs.map((b) => ({ ...b })),
        cs: cs.map((c) => ({ ...c })),
      };
      const mixes = ids.some((id) => seatOf.get(id)?.tier === "B");
      for (const id of ids) {
        const seat = seatOf.get(id)!;
        const row = seat.tier === "A" ? after.as[seat.at] : seat.tier === "B" ? after.bs[seat.at] : after.cs[seat.at];
        if (row.owed > 0) row.owed -= 1;
        else after.slack -= 1;
        if (seat.tier === "A" && mixes) after.as[seat.at].bGames += 1;
      }
      const price = charge!(ids) + Math.min(deficit(after), NO_FINISH);
      memo.set(key, price);
      return price;
    };
  }

  // With the cap on, once every A in the band has had their game with the
  // B's the band splits by tier: the A's play only A's from here and, on a
  // court with no C's, the B's only B's. Each half is then a band in its
  // own right for the picker's look at what a choice leaves. Found on the
  // Wednesday roster: the eight A's at two each were dealt as whichever
  // four had met least and whichever four that left, and the leftover was
  // twice a pair on their third meeting.
  if (cost && band.every((e) => tierHere(e.playerId) !== "A" || (bGames.get(e.playerId) ?? 0) > 0)) {
    bands.push(band.filter((e) => tierHere(e.playerId) === "A").map((e) => e.playerId));
    if (ctx.cCount === 0) bands.push(band.filter((e) => tierHere(e.playerId) === "B").map((e) => e.playerId));
  }
  const options = { windowSize: queue.length, playedBy: (id: string) => played.get(id) ?? 0,
    partnered, met, bridgeBusy, mixed, sameFour, bands };
  const chosen = chooseFour(queue.map((e) => e.playerId), lawCtx, { ...options, cost, charge });
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

  // Who the cap held back. The cost is the only key above fairness, so if
  // a fairer lawful four exists it was priced higher than this one, and
  // the people in it who had played fewer than somebody chosen waited for
  // the third law. Found by asking the picker once more without the cost,
  // and only when this four is not already as fair as the head of the
  // queue, which is the fairest any four can be; that is a handful of
  // draws a night, not every draw.
  const chosenVector = playedVector(played, ids);
  const headVector = playedVector(played, queue.slice(0, 4).map((e) => e.playerId));
  let heldBack: MixingNote["heldBack"] = [];
  let heldBackBy: MixingNote["heldBackBy"] = "secondGame";
  if (cost && fairerThan(headVector, chosenVector)) {
    const fairest = chooseFour(queue.map((e) => e.playerId), lawCtx, options);
    if (fairest) {
      const fairIds = [...fairest.lineup.teamA, ...fairest.lineup.teamB];
      if (fairerThan(playedVector(played, fairIds), chosenVector)) {
        const most = Math.max(...chosenVector);
        heldBack = queue
          .filter((e) => fairIds.includes(e.playerId) && !chosenSet.has(e.playerId) && e.matchesPlayed < most)
          .map((e) => ({ name: e.name }));
        // Which of the two terms in the cost passed that four over. Usually
        // the charge: dealing it puts an A in with the B's a second time,
        // now or later in the night. Sometimes only the lookahead: the four
        // leaves seats that cannot be dealt out at all, and somebody would
        // finish short of their games. Measured on the walk-in and leaver
        // sweep, 47 draws of about five hundred held-back ones, so the
        // frame is given both rather than one sentence for both.
        if (heldBack.length > 0 && cost(fairIds) >= NO_FINISH && cost(ids) < NO_FINISH) {
          heldBackBy = "unfinished";
        }
      }
    }
  }
  // The A's with the count each carried INTO this four, which is what lets
  // the card name the game rather than guess at it. IN QUEUE ORDER, not the
  // order of the lineup: frame 11 lists the same four people twice on one
  // screen, once from `leastPlayed` and once from here, and explainMatch's
  // own fallback reads them off the queue. Built from the lineup until
  // 2026-09-11, so the two lists jumbled the same names differently.
  const inQueue = new Map(queue.map((e, i) => [e.playerId, i]));
  const aPlayers: MixingMember[] = four
    .filter((e) => tierHere(e.playerId) === "A")
    .sort((x, y) => (inQueue.get(x.playerId) ?? 0) - (inQueue.get(y.playerId) ?? 0))
    .map((e) => ({ name: e.name, bGames: bGames.get(e.playerId) ?? 0 }));
  const mixes = four.some((e) => tierHere(e.playerId) === "B");
  const kind: MixingKind = aPlayers.length === 0 ? "noAs"
    : !mixes ? "pure"
      : aPlayers.every((a) => a.bGames === 0) ? "firstBGame"
        : "secondBGame";

  return { four, teamA: [...chosen.lineup.teamA] as [string, string],
           teamB: [...chosen.lineup.teamB] as [string, string], swap,
           mixing: { kind, aPlayers, heldBack, heldBackBy } };
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

  const chosen = lawfulFour(queue, lawContextFor(players, court), matches, court, players);
  // No lawful four exists. A court holding one C and three As has no legal
  // match in it at all, and handing back the least-played four anyway would
  // put that C in a game with three As, which is the one thing the laws never
  // allow. The caller shows the bench rather than an illegal game.
  if (!chosen) return null;

  const { teamA, teamB, swap, mixing } = chosen;
  // The picker's own account of the third law replaces the reconstructed
  // one: it knows who was held back, and it counted B games off the same
  // rows it dealt from.
  const reason = explainMatch(players, matches, court, teamA, teamB);
  return { teamA, teamB, reason: { ...reason, balance: { ...reason.balance, swap }, mixing } };
}

/**
 * The widest gap in games played across a court, as it stands.
 *
 * Frame 11 hangs its "nobody is ever more than one game behind" on this, and
 * since 2026-09-10 so does the roster footer: the third law is allowed to
 * hold a least-played player back a game, so a court can honestly sit two
 * apart. Both screens read the gap from here rather than counting rows
 * themselves, so neither can promise something the other denies.
 */
export function courtSpread(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
): number {
  // Guarded rather than spread straight into Math.max: an empty court would
  // otherwise report a spread of -Infinity and the screen would print it.
  const counts = players.filter((p) => isPlayable(p, court)).map((p) => matchesPlayedBy(matches, p.id));
  return counts.length ? Math.max(...counts) - Math.min(...counts) : 0;
}

/**
 * The log the card drew a four from, rebuilt from the night's raw list.
 *
 * The card seeds every row already on court or stepped past AS PLAYED
 * before it draws the next one (useSession.ts projectCard), because the card
 * is a picture of a night in which every row gets played. Frame 11 hands
 * this module the raw list instead, where a skipped row counts for nothing,
 * so until 2026-09-11 the two disagreed the moment a row was skipped: the
 * picker had already spent those A's one game with the B's, while the frame
 * read their count as zero and offered them a game the night could no longer
 * deal. Stepping past a row is an ordinary night (frame 12b), so the held
 * rows on this court are seeded here the same way.
 *
 * All but the row being explained. That is the game the four are standing
 * in, and it counts for nobody yet: the counts frame 11 prints are the ones
 * that stood when the four walked on. Rows on other courts are left alone,
 * because the card only ever seeds its own court's.
 */
function asCardDrew(
  matches: readonly Match[],
  court: number,
  four: ReadonlySet<string>,
): Match[] {
  let dropped = false;
  const out: Match[] = [];
  for (const m of matches) {
    if (countsAsPlayed(m)) { out.push(m); continue; }
    if (m.courtNumber !== court || m.stage !== null || m.status === "voided") continue;
    const ids = new Set([...m.teamA, ...m.teamB]);
    if (!dropped && ids.size === four.size && [...ids].every((id) => four.has(id))) {
      dropped = true;
      continue;
    }
    out.push({ ...m, status: "played" });
  }
  return out;
}

/**
 * The picker's own account of a match already on court, replayed.
 *
 * Who the third law held back is a counterfactual: it is the fairer four the
 * picker priced higher and passed over, and the match row itself carries no
 * trace of it. Frame 11 opens on a match that is ON COURT, so until
 * 2026-09-11 the frame's first card read a note with an empty heldBack and
 * went on printing "had played the fewest games" over a four the cap had
 * reordered. So the draw is run again from the court as it stood when the
 * four walked on. `matches` has to be that log already, which is what
 * asCardDrew builds; the filter below is only a guard against a caller who
 * hands in the raw list.
 *
 * Null unless the replay deals the SAME four the caller asked about. A four
 * put together by hand, or a card played out of order, is not a draw this
 * module made, and describing it as one would be the lie the frame's whole
 * design avoids. The caller then falls back to what the log alone supports.
 *
 * Only reached when the caller passes the court's target, which nextMatch
 * never does: it already holds the picker's note and a replay there would
 * draw every row of the card twice.
 */
function pickerNote(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
  teamA: readonly [string, string],
  teamB: readonly [string, string],
): MixingNote | null {
  const before = matches.filter(countsAsPlayed);
  const queue = buildQueue(players, before, court, targetMatches);
  if (queue.length < 4) return null;
  const drawn = lawfulFour(queue, lawContextFor(players, court), before, court, players);
  if (!drawn) return null;
  const asked = new Set([...teamA, ...teamB]);
  const dealt = drawn.four.map((e) => e.playerId);
  if (dealt.length !== asked.size || !dealt.every((id) => asked.has(id))) return null;
  return drawn.mixing;
}

/**
 * Describe a match that already exists, in the same shape nextMatch returns.
 *
 * Frame 11 is reached from a court that is mid-match, so the explanation has
 * to be derivable from the persisted match rather than only from the moment it
 * was drawn. `matches` should be the night's matches; a match on court counts
 * for nobody, so passing the full list and the match's own sides gives the
 * counts as they stood when the four walked on.
 *
 * `targetMatches` is optional and only the screens pass it. With it the draw
 * is replayed (see pickerNote) so the frame can say who the third law held
 * back; without it the note carries what the log alone supports.
 */
export function explainMatch(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  teamA: readonly [string, string],
  teamB: readonly [string, string],
  targetMatches?: number,
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

  const spread = courtSpread(players, matches, court);

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

  // The third law, read off the log THE CARD DREW FROM: played rows, plus
  // this court's held rows seeded as played the way projectCard seeds them,
  // less the row being explained. Frame 11 is opened on a match that is on
  // court and passes the night's whole list, so counting every non-voided
  // row here would charge the four for the game they are standing in, and
  // counting only played ones would forget the game a skipped row already
  // spent. Both the count below and the replay read the one list, so the
  // fourth card and the first cannot tell an operator different things.
  const asDrawn = asCardDrew(matches, court, new Set([...teamA, ...teamB]));
  const bGames = countBGames(players, asDrawn, countsAsPlayed);
  const tier = (id: string): Tier => {
    const p = byId.get(id);
    return p ? tierOfPlayer(p) : "B";
  };
  const aPlayers: MixingMember[] = leastPlayed
    .filter((p) => tier(p.playerId) === "A")
    .map((p) => ({ name: p.name, bGames: bGames.get(p.playerId) ?? 0 }));
  const mixes = leastPlayed.some((p) => tier(p.playerId) === "B");
  const mixingKind: MixingKind = aPlayers.length === 0 ? "noAs"
    : !mixes ? "pure"
      : aPlayers.every((a) => a.bGames === 0) ? "firstBGame"
        : "secondBGame";

  // The picker's note where the replay recognises this four, so frame 11 can
  // say who waited a round for the third law. The log alone knows the kind
  // and the counts but never the four that was passed over.
  const drawn = targetMatches === undefined
    ? null
    : pickerNote(players, asDrawn, court, targetMatches, teamA, teamB);

  return {
    leastPlayed,
    courtSpread: spread,
    withinOneGame: spread <= 1,
    balance: { kind, cPlayers, swap: null },
    mixing: drawn ?? { kind: mixingKind, aPlayers, heldBack: [] },
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

/**
 * The night this court is about to play, priced by the same oracle the picker
 * uses: the least any finish has to charge the A's in second games with the
 * B's.
 *
 * Null when there is no A or no B on the court, or no target to play for:
 * nobody can be charged there and the oracle is not worth asking, exactly as
 * the picker skips it. Infinity when the seats do not divide into whole
 * lawful games at all.
 */
function nightCharge(
  players: readonly Player[],
  court: number,
  targetMatches: number,
): number | null {
  const onCourt = players.filter((p) => isPlayable(p, court));
  const hasA = onCourt.some((p) => tierOfPlayer(p) === "A");
  const hasB = onCourt.some((p) => tierOfPlayer(p) === "B");
  if (!hasA || !hasB || targetMatches <= 0) return null;
  const ctx = lawContextFor(players, court);
  const seats: Seat[] = onCourt.map((p) => ({
    tier: tierOfPlayer(p),
    owed: targetMatches,
    bGames: 0,
    bridge: p.id === ctx.designatedB,
  }));
  return deficit(stateOf(seats, ctx.abLaw === "free" ? "free" : "bound", ctx.relaxed));
}

/**
 * Can this court give everyone the target at all?
 *
 * validTargets only asks whether N x T divides by four, and strandedPlayers
 * only asks whether each player has one legal foursome. Both pass on a court
 * like two A's, two B's and two C's at four each, where the eight A-seats
 * force four A B against A B games, those consume every seat the B's owe,
 * and the C's are left with nobody the laws allow them on court with. The
 * night then deals lawful fours forever and nobody reaches the target.
 *
 * The oracle already knows: it prices such a court at Infinity, which is its
 * own word for "these seats do not divide into whole games". Until
 * 2026-09-11 that answer was dropped on the floor and a hand-dragged court
 * could pass setup in silence. False for a court the oracle is not worth
 * asking (no A, or no B), because that is the case it has nothing to say
 * about rather than a court that is fine.
 */
export function unfinishableCourt(
  players: readonly Player[],
  court: number,
  targetMatches: number,
): boolean {
  const charge = nightCharge(players, court, targetMatches);
  return charge !== null && !Number.isFinite(charge);
}

/** What the third law costs a court, in the numbers a setup warning needs. */
export interface ForcedMixing {
  /** A's on the court. */
  aCount: number;
  /** Games each of them is owed, which the note names. */
  target: number;
  /** Seats across the net from the B's, over the whole night. */
  seats: number;
  /** How many of those seats are an A's second game with the B's or later. */
  secondGames: number;
}

/**
 * What the third law costs a court, worked out before the night starts.
 *
 * An A plays one game with the B's and never a second, and most nights that
 * holds. Some nights it cannot: on a court of six A's and two B's at four
 * each the two B's owe eight games between them, which is four games across
 * the net, and each of those seats two A's, so eight seats over six A's. The
 * numbers bend the rule, and the operator hears it at setup rather than in
 * round six.
 *
 * Null when nothing bends: no A on the court, no B on the court, or the
 * seats can still be finished with nobody meeting the B's twice. Otherwise
 * `seats` is how many places across the net from the B's the A's have to
 * fill and `secondGames` is how many of those are somebody's second.
 *
 * The rule itself is not worked out here. `deficit` prices the night the
 * same way the picker does, and the seats are read back off its answer:
 * every A on the court is owed the same games and has had the same none of
 * them, so the cheapest finish hands the mixed seats out level, and the
 * level hand-out of `seats` seats over `aCount` A's is the only one that
 * carries that price.
 */
export function forcedMixing(
  players: readonly Player[],
  court: number,
  targetMatches: number,
): ForcedMixing | null {
  const aCount = players
    .filter((p) => isPlayable(p, court) && tierOfPlayer(p) === "A").length;
  // Null is a court with no A or no B on it, or no target: nobody can be
  // charged there and the oracle is not asked, exactly as the picker skips it.
  const charge = nightCharge(players, court, targetMatches);
  // Infinity is a court the laws cannot finish at all. It is its own warning
  // (see unfinishableCourt), not a bend of the third law, so this note stays
  // quiet about it.
  if (charge === null || !Number.isFinite(charge) || charge <= 0) return null;

  // An A's k-th game with the B's costs k-1, so a level hand-out of m seats
  // over n A's carries a price that only goes up as m does. The first m
  // whose price reaches the night's is the number of seats the night needs.
  for (let m = aCount + 1; m <= aCount * targetMatches; m++) {
    if (levelCharge(m, aCount) >= charge) {
      return { aCount, target: targetMatches, seats: m, secondGames: m - aCount };
    }
  }
  return null;
}

/** The price of handing `seats` mixed seats out level over `aCount` A's. */
function levelCharge(seats: number, aCount: number): number {
  const each = Math.floor(seats / aCount);
  const over = seats % aCount;
  const price = (s: number) => (s * (s - 1)) / 2;
  return over * price(each + 1) + (aCount - over) * price(each);
}
