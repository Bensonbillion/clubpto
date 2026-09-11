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
import { lawContextFor, matchesPlayedBy, nextMatch, totalMatches, validTargets } from "../rotation";
import { tierOf } from "../tiers";
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
