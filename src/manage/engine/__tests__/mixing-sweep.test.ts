// The third law, swept: every court the room can make, dealt to the end.
//
// The nights in rotation.test.ts are the ones the owner watched. This file
// is the rest of them. It walks one A/B court for every headcount the club
// can field, one to twelve of each tier and at most twenty on the court, at
// every target the room divides into, then does it again with beginners on
// the court, and it deals each night out to the last game.
//
// It is slow, so it runs only when MANAGE_SWEEP is set and `npm run
// gauntlet` never waits for it:
//
//   MANAGE_SWEEP=1 npx vitest run src/manage/engine/__tests__/mixing-sweep.test.ts
//
// One block at the foot of the file is NOT gated. It replays the fourteen
// nights that leave a player further past the target than main does, each
// with main's own finish written beside it, and it takes milliseconds. The
// swept tests only ever see that residue as a number, so it is worth a gate
// of its own.
//
// Every court in the range is in it. Two five-player courts used to be
// carved out, two A's with three B's at four each and the same the other way
// round: the draw dealt them six games where five fit, the two of the
// smaller tier finishing on six games while the three finished on four, and
// it had dealt them that way since before the cap existed. The mixing law
// read as parity was the cause, and it now reads as the strictest law the
// seats still owed can be finished under, so the carve-out and the test that
// held it to account came out on 2026-09-11.
//
// Three promises, on every night:
//   1. Everybody finishes EXACTLY on target, in exactly the number of games
//      the card projected. The cap costs nobody a game.
//   2. The cap HOLDS wherever it can be held. When the oracle prices the
//      night's start state at zero, no A meets the B's twice. Where the
//      start price is positive the seats force seconds and how many is the
//      picker's business, not this file's.
//   3. The played counts stay within two of each other all night, the one
//      game the cap is allowed to hold a least-played player back.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../../types";
import { buildQueue, lawContextFor, matchesPlayedBy, nextMatch, totalMatches, validTargets } from "../rotation";
import { judge, lawForOwedSeats, tierOf, type LawContext } from "../tiers";
import { deficit, stateOf, type Seat } from "../mixing";

const skip = !process.env.MANAGE_SWEEP;

const P = (id: string, tier: "A" | "B" | "C"): Player => ({
  id, name: id.toUpperCase(), tier, walkIn: false, courtNumber: 1, away: false,
  joinedAtMatchIndex: null,
});

const roster = (nA: number, nB: number, nC = 0): Player[] => [
  ...Array.from({ length: nA }, (_, i) => P(`a${i + 1}`, "A")),
  ...Array.from({ length: nB }, (_, i) => P(`b${i + 1}`, "B")),
  ...Array.from({ length: nC }, (_, i) => P(`c${i + 1}`, "C")),
];

/**
 * The night's start state, built the way lawfulFour builds it on the first
 * draw: everyone owed the target, no A has met the B's yet, the bridge is
 * whoever the court designates, and the law and the relaxation come off the
 * headcount. A price of zero here is the oracle promising the night can be
 * finished with nobody charged.
 */
const startPrice = (players: readonly Player[], target: number): number => {
  const ctx = lawContextFor(players, 1);
  const seats: Seat[] = players.map((p) => ({
    tier: tierOf(p), owed: target, bGames: 0, bridge: p.id === ctx.designatedB,
  }));
  return deficit(stateOf(seats, ctx.abLaw === "free" ? "free" : "bound", ctx.relaxed));
};

/** Deal the whole night, watching the spread after every game. */
const runNight = (players: readonly Player[], target: number) => {
  const matches: Match[] = [];
  let worstSpread = 0;
  // A court of this size cannot legitimately need more games than this, so
  // a picker that will not stop fails the sweep rather than hanging it.
  const guard = totalMatches(players.length, target) + 8;
  for (let n = 0; n < guard; n++) {
    const next = nextMatch(players, matches, 1, target);
    if (!next) break;
    matches.push({
      id: `s${n}`, courtNumber: 1, matchIndex: n + 1, teamA: next.teamA, teamB: next.teamB,
      scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
    });
    const counts = players.map((p) => matchesPlayedBy(matches, p.id));
    worstSpread = Math.max(worstSpread, Math.max(...counts) - Math.min(...counts));
  }
  return { matches, counts: players.map((p) => matchesPlayedBy(matches, p.id)), worstSpread };
};

/** A game with an A and a B in it: one B game for every A on that court. */
const isMixed = (players: readonly Player[], m: Match) => {
  const tiers = [...m.teamA, ...m.teamB].map((id) => players.find((p) => p.id === id)?.tier ?? "B");
  return tiers.includes("A") && tiers.includes("B");
};

/** The most B games any one A was dealt over the night. */
const worstA = (players: readonly Player[], matches: readonly Match[]): number => {
  const mixed = matches.filter((m) => isMixed(players, m));
  let worst = 0;
  for (const p of players) {
    if (p.tier !== "A") continue;
    worst = Math.max(worst, mixed.filter((m) => [...m.teamA, ...m.teamB].includes(p.id)).length);
  }
  return worst;
};

/** One night, judged. Hands back what it found, so the sweep can count. */
const sweepNight = (players: readonly Player[], target: number, label: string) => {
  const want = totalMatches(players.length, target);
  const price = startPrice(players, target);
  const { matches, counts, worstSpread } = runNight(players, target);
  expect(matches.length, `${label}: games`).toBe(want);
  expect(counts.every((c) => c === target), `${label}: counts ${counts.join(",")}`).toBe(true);
  expect(worstSpread, `${label}: spread`).toBeLessThanOrEqual(2);
  const worst = worstA(players, matches);
  if (price === 0) expect(worst, `${label}: B games for one A`).toBeLessThanOrEqual(1);
  return { price, worst, worstSpread };
};

/** Every target between two and five that the room divides into. */
const targetsFor = (size: number) => validTargets(size).filter((t) => t >= 2 && t <= 5);

interface Tally { nights: number; bent: number; spread2: number; worstEver: number }

const tally = (): Tally => ({ nights: 0, bent: 0, spread2: 0, worstEver: 0 });

const record = (t: Tally, r: { price: number; worst: number; worstSpread: number }) => {
  t.nights++;
  if (r.price > 0) t.bent++;
  if (r.worstSpread === 2) t.spread2++;
  t.worstEver = Math.max(t.worstEver, r.worst);
};

const report = (name: string, t: Tally) =>
  `${name}: ${t.nights} nights, ${t.bent} where the seats bend the cap, ` +
  `${t.spread2} touching a spread of two, worst B-game count ${t.worstEver}`;

describe("the sweep: every court the room can field", () => {
  it.skipIf(skip)("A's and B's, one to twelve of each, at every target the room divides into", () => {
    const t = tally();
    for (let nA = 1; nA <= 12; nA++) {
      for (let nB = 1; nB <= 12; nB++) {
        // Four is the smallest court that can field a game at all.
        if (nA + nB < 4 || nA + nB > 20) continue;
        const players = roster(nA, nB);
        for (const target of targetsFor(nA + nB)) {
          record(t, sweepNight(players, target, `${nA}A/${nB}B T${target}`));
        }
      }
    }
    console.log(report("A/B sweep", t));
    expect(t.nights).toBeGreaterThan(0);
  }, 1_800_000);

  it.skipIf(skip)("beginners on the court too, one to five of them", () => {
    const t = tally();
    for (let nA = 4; nA <= 8; nA++) {
      for (let nB = 5; nB <= 8; nB++) {
        for (let nC = 1; nC <= 5; nC++) {
          if (nA + nB + nC > 20) continue;
          const players = roster(nA, nB, nC);
          for (const target of targetsFor(nA + nB + nC)) {
            record(t, sweepNight(players, target, `${nA}A/${nB}B/${nC}C T${target}`));
          }
        }
      }
    }
    console.log(report("C sweep", t));
    expect(t.nights).toBeGreaterThan(0);
  }, 1_800_000);
});

/* ── the same courts, changed mid-night ──────────────────────────── */

/**
 * The law this court runs a draw under, rebuilt from the queue the way
 * lawfulFour builds it: free by headcount, the ladder on a court with no
 * beginners, the parity reading where the C games spend B seats.
 */
const lawAtDraw = (players: readonly Player[], matches: readonly Match[], target: number) => {
  const ctx = lawContextFor(players, 1);
  if (ctx.abLaw === "free") return ctx;
  const queue = buildQueue(players, matches, 1, target);
  const owed = (tier: "A" | "B") => queue
    .filter((e) => ctx.tierById(e.playerId) === tier).reduce((n, e) => n + e.owed, 0);
  const count = (tier: "A" | "B") => queue
    .filter((e) => ctx.tierById(e.playerId) === tier).length;
  const abLaw = ctx.cCount === 0
    ? lawForOwedSeats(owed("A"), owed("B"), count("A"), count("B"))
    : owed("A") % 2 === 0 && owed("B") % 2 === 0 ? "strict" : "soft";
  return { ...ctx, abLaw } as LawContext;
};

/**
 * A night with somebody arriving or leaving partway through, dealt to its
 * end, judging every four as it is dealt.
 *
 * Two verdicts on every game. It is legal under the law the court was
 * actually running at that draw, and it is legal under the FREE law, which
 * is the loosest the engine can ever apply: free adds the lone B among A's
 * and adds nothing else, so a game that fails there is a game with a side
 * holding no B while two B's are on court, which is the shape law one was
 * written to prevent.
 */
const runChanged = (
  base: readonly Player[],
  target: number,
  at: number,
  change: (ps: readonly Player[]) => Player[],
) => {
  let players = [...base] as Player[];
  const matches: Match[] = [];
  let applied = false;
  let need = 0;
  // Two shapes worth counting as they are dealt, because neither shows in
  // the finishing counts. `hunted` is the game law one exists to prevent,
  // two A's standing against two B's, and it must never be dealt at all.
  // `loneB` is one B among three A's on a court whose HEADCOUNT law is soft
  // or strict, the shape the free rung brought in: lawful, useful, and
  // nothing pins how far it travels but this.
  let hunted = 0;
  let loneB = 0;
  const guard = totalMatches(base.length + 1, target) + 12;
  for (let n = 0; n < guard; n++) {
    if (!applied && matches.length === at) {
      players = change(players);
      applied = true;
      // The fewest games the rest of the night can take: the seats still
      // owed come in fours, and nobody plays twice in one game, so a player
      // owed four games needs four of them however many seats there are.
      const owed = players.filter((p) => !p.away)
        .map((p) => Math.max(0, target - matchesPlayedBy(matches, p.id)));
      const seats = owed.reduce((sum, o) => sum + o, 0);
      need = at + Math.max(Math.ceil(seats / 4), ...owed);
    }
    const ctx = lawAtDraw(players, matches, target);
    const next = nextMatch(players, matches, 1, target);
    if (!next) break;
    const lineup = { teamA: next.teamA, teamB: next.teamB };
    expect(judge(lineup, ctx), `law of the draw: ${next.teamA.join("+")} v ${next.teamB.join("+")}`).toBeNull();
    expect(judge(lineup, { ...ctx, abLaw: "free" }),
      `every team has a B: ${next.teamA.join("+")} v ${next.teamB.join("+")}`).toBeNull();
    // The same two verdicts read off the tiers rather than off judge(), so
    // a law that loosened again could not quietly take the count with it.
    const side = (ids: readonly string[]) => ids.map(ctx.tierById).sort().join("");
    const tiers = [...next.teamA, ...next.teamB].map(ctx.tierById);
    const as = tiers.filter((t) => t === "A").length;
    const bs = tiers.filter((t) => t === "B").length;
    if (as === 2 && bs === 2 && side(next.teamA) !== side(next.teamB)) hunted++;
    if (as === 3 && bs === 1 && lawContextFor(players, 1).abLaw !== "free") loneB++;
    matches.push({
      id: `c${n}`, courtNumber: 1, matchIndex: n + 1, teamA: next.teamA, teamB: next.teamB,
      scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
    });
  }
  const live = players.filter((p) => !p.away);
  return { applied, need, games: matches.length, players: live, hunted, loneB,
           counts: live.map((p) => matchesPlayedBy(matches, p.id)) };
};

describe("the sweep: a change mid-night, on every court the room can field", () => {
  // THE NIGHTS THE FIXED SWEEP ABOVE CANNOT SEE, and the reason both of
  // 2026-09-11's faults shipped. A fixed roster owes N times its target and
  // drops by four a game, so the seats it owes are a multiple of four all
  // night and every law it ever runs under can finish them. A walk-in, a
  // leaver and an extended target all leave seats no law can finish, and
  // that is where the mixing law's free rung lives. The whole of it was
  // untested: the walk-in and leaver tests in rotation.test.ts ride on
  // twelve A's with eight B's and eight with eight, whose seats stay
  // finishable strict, so they passed unchanged while free was dealing two
  // A's against two B's: 441 games over 379 of the 5,224 nights below. That
  // is the rung as it was first written, measured over this enumeration as
  // it now stands (2026-09-12).
  //
  // THE CHANGE LANDS AT EVERY GAME OF THE NIGHT since 2026-09-12, not just
  // at games two, three and four. Three faults were found by hand that this
  // file walked straight past, and all three arrive late: an A joining a
  // court of three and three before game five, an A joining three and four
  // before game six, and a B leaving a court of three and two at a target
  // of eight. A change at game two is a different night from the same
  // change at game nine, because by game nine the cap has walled the A's
  // off and the card has already grown.
  //
  // AND THE COURT GOES TO TWELVE, where it stopped at ten until 2026-09-12.
  // Five of the fourteen nights that finish further past the target than
  // main does are courts of eleven and twelve, and while the loop stopped
  // at ten no pin in this file could see them. Twelve is where the line is
  // for the clock and nothing else: the walk is 5,224 nights where ten was
  // 2,618, it takes a little over two minutes on this machine, and each
  // further player multiplies the fours a draw scores. The fixed sweep
  // above reaches twenty because a fixed roster is one night per court, not
  // one per game of the night.
  //
  // What every night is held to: every four legal, at the draw and under
  // the loosest law there is, and no game anywhere putting two A's against
  // two B's.
  //
  // What a night in the SETTLED REGIME is held to as well, where both tiers
  // keep two players through the change and the change lands on a night
  // still owing somebody a game: nobody finishes short, and the card does
  // not run more than one game past the fewest the seats can be dealt in.
  // 2,936 of the nights below are in that regime. Of the 1,052 of them
  // whose change lands at game two, three or four, the window this sweep
  // walked before 2026-09-12, four run one game long, none runs two, and
  // three finish somebody short; those two counts are still pinned on their
  // own, so widening the sweep cannot soften what it already promised.
  //
  // The nights outside that regime are older faults with names. A lone tier
  // that arrives LATE cannot be finished at all: the cap has walled every A
  // off from the B's by then, so a single A walking in onto a court of four
  // B's before game three plays one game while the B's play sixteen and
  // seventeen, and the card only stops at this file's guard. That night is
  // the same at d1aa383, and so is its literal mirror, four A's with a B
  // arriving, which runs the same seventeen games in both trees. What the
  // ladder did get better is the court that already holds one of each: a
  // second B onto four A's and a B, before game two, took eighteen games at
  // d1aa383 and left two players on nothing and one game, and the ladder
  // deals it in six with everyone on four. The arriving B is not the lone
  // tier there, the B already on court is, which is why it can be finished. And a player arriving
  // onto a court where everybody has finished needs three at-target players
  // a game to give them theirs.
  //
  // SIX NUMBERS ARE PINNED rather than argued, because each is a thing the
  // engine is allowed to do a little of and must not start doing a lot of.
  // Every one is measured over the enumeration below on 2026-09-12, and
  // main's score on the same enumeration is beside it, so a reader can tell
  // which pins are improvements and which are prices:
  //   - the lone B among three A's, dealt on a court whose HEADCOUNT law is
  //     soft or strict: 49 games, against none at main, where the shape did
  //     not exist. The free rung brought it in and the per-draw ladder lets
  //     it reach courts the headcount would not have given it. 42 of the 44
  //     nights carrying one finish better than main did, none worse, and
  //     the other two finish the same distance off target in the same
  //     number of games. Nothing else says how far the shape may travel;
  //   - nights running one game long: 27, against main's 14. The card is
  //     allowed to miss the fewest games the seats can be dealt in, by one,
  //     and must not start missing it often. This pin is a price;
  //   - nights finishing somebody short: 50, against main's 84. The same
  //     miss in the other direction, and this one is an improvement;
  //   - how far past the target one player may finish. An odd headcount
  //     leaves seats the card cannot avoid dealing, and the question is
  //     never whether they exist but whether they land on different people.
  //     So the gap is what is pinned: the worst single overshoot against
  //     the fewest seats any spread of them could leave that player,
  //     ceil(extra seats / players). It is 0 on a night that shares them
  //     out, and the pin is 3, which main also scores: three A's and eight
  //     B's at four each with an A arriving before game twelve finishes one
  //     player four games past the target where an even share is one. That
  //     is the +A@11 night the residue table below names;
  //   - nights stacking a seat at all, a gap above zero: 266, against
  //     main's 256. A price, and the one the ticket key's repair on
  //     2026-09-12 charged: sixteen nights went from an even share to one
  //     stacked seat, one came back the other way, and one that stacked
  //     two now stacks one, so the worst gap is where it was and fifteen
  //     more nights carry a small one;
  //   - the spread itself, worst overshoot against the target in force: 5,
  //     which main also scores.
  it.skipIf(skip)("a walk-in or a leaver of each tier, at every game of the night", () => {
    let nights = 0;
    let settled = 0;
    let long = 0;
    let short = 0;
    // The same two counts over the window this sweep walked before
    // 2026-09-12, games two, three and four, so the promise it made then is
    // still made.
    let earlyLong = 0;
    let earlyShort = 0;
    let hunted = 0;
    let loneB = 0;
    let stacked = 0;
    let worstGap = 0;
    let worstOver = 0;
    const late = (tier: "A" | "B", at: number): Player =>
      ({ ...P("late", tier), walkIn: true, joinedAtMatchIndex: at });
    for (let size = 4; size <= 12; size++) {
      for (let nA = 0; nA <= size; nA++) {
        const nB = size - nA;
        const base = roster(nA, nB);
        for (const target of targetsFor(size)) {
          for (let at = 1; at <= totalMatches(size, target); at++) {
            for (const tier of ["A", "B"] as const) {
              const changes: { label: string; how: (ps: readonly Player[]) => Player[];
                               tiers: [number, number] }[] = [
                { label: `+${tier}`, how: (ps) => [...ps, late(tier, at)],
                  tiers: tier === "A" ? [nA + 1, nB] : [nA, nB + 1] },
              ];
              const goer = base.find((p) => p.tier === tier);
              if (goer && size >= 5) {
                changes.push({ label: `-${tier}`,
                  how: (ps) => ps.map((p) => (p.id === goer.id ? { ...p, away: true } : p)),
                  tiers: tier === "A" ? [nA - 1, nB] : [nA, nB - 1] });
              }
              for (const { label, how, tiers } of changes) {
                const name = `${nA}A/${nB}B T${target} ${label}@${at}`;
                const r = runChanged(base, target, at, how);
                nights++;
                hunted += r.hunted;
                loneB += r.loneB;
                // The settled regime: both tiers keep two through the
                // change, so every shape the mixing law names can be
                // fielded, and somebody other than the arrival is still
                // owed a game when it lands.
                const bothTiers = Math.min(nA, tiers[0]) >= 2 && Math.min(nB, tiers[1]) >= 2;
                if (!r.applied || !bothTiers || r.need === at) continue;
                settled++;
                const early = at >= 2 && at <= 4;
                if (r.counts.some((c) => c < target)) {
                  short++;
                  if (early) earlyShort++;
                  continue;
                }
                if (r.games > r.need) { long++; if (early) earlyLong++; }
                expect(r.games, `${name}: ${r.games} games, ${r.need} needed, ${r.counts.join(",")}`)
                  .toBeLessThanOrEqual(r.need + 1);
                // The seats the night could not avoid, and where they
                // landed. `floor` is the fewest any one player can be left
                // holding when they are shared out as evenly as people
                // allow, so a gap is somebody carrying a second one while
                // somebody else carries none.
                const over = r.counts.map((c) => c - target);
                const extra = over.reduce((sum, o) => sum + o, 0);
                const floor = Math.ceil(extra / over.length);
                const gap = Math.max(...over) - floor;
                worstOver = Math.max(worstOver, Math.max(...over));
                worstGap = Math.max(worstGap, gap);
                if (gap > 0) stacked++;
              }
            }
          }
        }
      }
    }
    console.log(`mid-night sweep: ${nights} nights, ${settled} of them settled, `
      + `${long} running one game long, ${short} finishing somebody short`);
    console.log(`  at games two to four: ${earlyLong} long, ${earlyShort} short`);
    console.log(`  shapes: ${hunted} games of two A's against two B's, `
      + `${loneB} of one B among three A's on a bound law`);
    console.log(`  past the target: worst overshoot ${worstOver}, `
      + `${stacked} nights stacking a seat, worst gap ${worstGap}`);
    expect(nights).toBeGreaterThan(5_000);
    // The game law one exists to prevent this shape, under every law on the
    // ladder. Not a ceiling, a zero.
    expect(hunted, "two A's against two B's").toBe(0);
    // The promises this sweep made at games two, three and four, unchanged.
    expect(earlyLong).toBeLessThanOrEqual(4);
    expect(earlyShort).toBeLessThanOrEqual(3);
    // And the same two over the whole night, which is a looser hand because
    // a change at the last game of a card is a harder night than a change
    // at the second.
    expect(long, "nights running one game long").toBeLessThanOrEqual(27);
    expect(short, "nights finishing somebody short").toBeLessThanOrEqual(50);
    // The rest of the pinned numbers. Each is measured today, and each is
    // here so it cannot grow without somebody saying why.
    expect(loneB, "lone B among three A's on a bound law").toBeLessThanOrEqual(49);
    expect(worstOver, "worst overshoot").toBeLessThanOrEqual(5);
    expect(worstGap, "worst stacked seat").toBeLessThanOrEqual(3);
    expect(stacked, "nights stacking a seat").toBeLessThanOrEqual(266);
  }, 1_800_000);
});

/* ── the residue, named ──────────────────────────────────────────── */

/**
 * Every night that leaves a player further past the target than d1aa383
 * leaves them, written out rather than counted, because the sweep above
 * only ever sees these as a number (2026-09-12).
 *
 * The set is the whole of it over the enumeration the sweep walks. It was
 * measured night by night against a run of main at d1aa383, not guessed at
 * and not read off the aggregate pins, which measure against the target
 * rather than against main and so cannot see these at all. Fourteen nights,
 * each dealing exactly the number of games main dealt, and on each of them
 * the player furthest past the target is one game further past it than
 * main's furthest was, never more. What changed is where the seats the card
 * cannot avoid land, not how many of them there are.
 *
 * Thirteen of the fourteen are SETTLED MID-CARD, the regime the sweep holds
 * to finishing level: both tiers keep two players through the change and
 * somebody other than the arrival is still owed a game when it lands. The
 * fourteenth, one A and ten B's with a B leaving before game ten, is
 * outside it, because a court with one A cannot field every shape the
 * mixing law names. That one finishes a single player one game over where
 * main finished everybody level.
 *
 * They were traced rather than guessed at. The night diverges on a BLIND
 * draw, where the oracle cannot price the court and the cost key comes off,
 * and by the closing games the cap itself is what puts the extra seat on a
 * player who already had one: the fairer four gives two A's a second game
 * with the B's, and the cap ranks first by the owner's word. Two ways out
 * were measured on 2026-09-12 and each cost more than it bought. Pricing a
 * blind draw by its charge alone cuts this set to six and leaves 106 nights
 * with somebody short of their games. Keeping the charge while the
 * lookahead stays silent costs nothing in games or short finishes and
 * leaves fifteen nights here rather than fourteen. So these stand, and they
 * stand written down.
 *
 * Keeping the set from growing in silence is what the pins above are for: a
 * night that newly stacks a seat lands in `stacked`, and one that stacks
 * more than any night stacks today lands in `worstGap`.
 */
interface Residue {
  /** The sweep's own name for the night. */
  name: string;
  nA: number;
  nB: number;
  target: number;
  /** Games played when the change lands, so `at` 4 is "before game five". */
  at: number;
  change: "+A" | "-B";
  /** What this tree deals: games, then every live player's count. */
  games: number;
  counts: number[];
  /** What d1aa383 dealt on the same night, in the same number of games. */
  main: number[];
}

const RESIDUE: readonly Residue[] = [
  { name: "1A/10B T4 -B@9", nA: 1, nB: 10, target: 4, at: 9, change: "-B",
    games: 11, counts: [4, 5, 4, 4, 4, 4, 4, 4, 4, 4],
    main: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { name: "2A/3B T4 +A@5", nA: 2, nB: 3, target: 4, at: 5, change: "+A",
    games: 9, counts: [5, 5, 8, 7, 7, 4], main: [6, 6, 7, 7, 6, 4] },
  { name: "3A/3B T4 +A@4", nA: 3, nB: 3, target: 4, at: 4, change: "+A",
    games: 8, counts: [6, 5, 5, 4, 4, 4, 4], main: [5, 5, 5, 5, 4, 4, 4] },
  { name: "3A/4B T4 +A@5", nA: 3, nB: 4, target: 4, at: 5, change: "+A",
    games: 9, counts: [6, 5, 5, 4, 4, 4, 4, 4], main: [5, 5, 5, 5, 4, 4, 4, 4] },
  { name: "3A/4B T4 +A@7", nA: 3, nB: 4, target: 4, at: 7, change: "+A",
    games: 11, counts: [7, 7, 8, 5, 5, 4, 4, 4], main: [7, 7, 7, 5, 5, 5, 4, 4] },
  { name: "3A/5B T4 +A@8", nA: 3, nB: 5, target: 4, at: 8, change: "+A",
    games: 12, counts: [7, 7, 8, 5, 4, 4, 5, 4, 4],
    main: [7, 7, 7, 4, 5, 5, 4, 5, 4] },
  { name: "3A/6B T4 +A@7", nA: 3, nB: 6, target: 4, at: 7, change: "+A",
    games: 11, counts: [5, 6, 5, 4, 4, 4, 4, 4, 4, 4],
    main: [5, 5, 5, 5, 4, 4, 4, 4, 4, 4] },
  { name: "3A/6B T4 +A@9", nA: 3, nB: 6, target: 4, at: 9, change: "+A",
    games: 13, counts: [8, 7, 7, 5, 4, 4, 4, 5, 4, 4],
    main: [7, 7, 7, 4, 5, 5, 5, 4, 4, 4] },
  { name: "3A/7B T4 +A@10", nA: 3, nB: 7, target: 4, at: 10, change: "+A",
    games: 14, counts: [7, 8, 7, 4, 4, 5, 5, 4, 4, 4, 4],
    main: [7, 7, 7, 5, 4, 5, 5, 4, 4, 4, 4] },
  { name: "3A/8B T4 +A@11", nA: 3, nB: 8, target: 4, at: 11, change: "+A",
    games: 15, counts: [7, 7, 8, 4, 5, 4, 4, 4, 5, 4, 4, 4],
    main: [7, 7, 7, 5, 4, 4, 5, 4, 5, 4, 4, 4] },
  { name: "3A/9B T4 +A@12", nA: 3, nB: 9, target: 4, at: 12, change: "+A",
    games: 16, counts: [7, 8, 7, 4, 4, 4, 5, 4, 4, 5, 4, 4, 4],
    main: [7, 7, 7, 5, 4, 4, 5, 4, 4, 5, 4, 4, 4] },
  { name: "7A/3B T4 +A@9", nA: 7, nB: 3, target: 4, at: 9, change: "+A",
    games: 13, counts: [6, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4],
    main: [5, 5, 5, 5, 5, 5, 5, 4, 5, 4, 4] },
  { name: "7A/4B T4 +A@10", nA: 7, nB: 4, target: 4, at: 10, change: "+A",
    games: 14, counts: [6, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4],
    main: [5, 5, 5, 5, 5, 5, 5, 4, 4, 5, 4, 4] },
  { name: "7A/5B T4 +A@11", nA: 7, nB: 5, target: 4, at: 11, change: "+A",
    games: 15, counts: [6, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4],
    main: [5, 5, 5, 5, 5, 5, 5, 4, 5, 4, 4, 4, 4] },
];

describe("the nights that finish further off target than main", () => {
  const nightOf = (r: Residue) => {
    const base = roster(r.nA, r.nB);
    if (r.change === "+A") {
      const late: Player = { ...P("late", "A"), walkIn: true, joinedAtMatchIndex: r.at };
      const run = runChanged(base, r.target, r.at, (ps) => [...ps, late]);
      return { games: run.games, counts: run.counts };
    }
    const goer = base.find((p) => p.tier === "B")!;
    const run = runChanged(base, r.target, r.at,
      (ps) => ps.map((p) => (p.id === goer.id ? { ...p, away: true } : p)));
    return { games: run.games, counts: run.counts };
  };

  for (const r of RESIDUE) {
    it(`${r.name}: finishes ${Math.max(...r.counts) - r.target} past the target `
      + `where main finished ${Math.max(...r.main) - r.target}`, () => {
      expect(nightOf(r)).toEqual({ games: r.games, counts: r.counts });
      // The comparison the name makes, read off the two finishes rather
      // than asserted twice: the same games, and one player further out.
      expect(r.main.length).toBe(r.counts.length);
      expect(Math.max(...r.counts)).toBeGreaterThan(Math.max(...r.main));
    });
  }

  it("two and three at four each, an A arriving before game five, is not one of them", () => {
    // The sister of 2A/3B T4 +A@5, a game earlier. It came back to main's
    // finish on 2026-09-12 when the even mixed shape was preferred, and it
    // is kept here so it cannot drift back out again. d1aa383 finished
    // 5,5,6,6,6,4 in the same eight games, the walk-in on four.
    const base = roster(2, 3);
    const late: Player = { ...P("late", "A"), walkIn: true, joinedAtMatchIndex: 4 };
    const run = runChanged(base, 4, 4, (ps) => [...ps, late]);
    expect({ games: run.games, counts: run.counts })
      .toEqual({ games: 8, counts: [5, 5, 6, 6, 6, 4] });
  });
});
