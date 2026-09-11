// The oracle behind the third law: how many second B games do the seats
// force? Every number here is one the owner would recognise from a night,
// and the brute force at the bottom is the real judge() dealing every
// lawful sequence of games, so the counting in mixing.ts is never trusted
// on its own word.

import { describe, expect, it } from "vitest";
import { judge, type LawContext, type Lineup, type Tier } from "../tiers";
import { deficit, slackFor, stateOf, type MixingState, type Seat } from "../mixing";

/* ── building states ─────────────────────────────────────────────── */

/** A fresh court: everyone owed the target, nobody has met the B's yet. */
const fresh = (nA: number, nB: number, target: number, nC = 0): MixingState => {
  const seats: Seat[] = [];
  for (let i = 0; i < nA; i++) seats.push({ tier: "A", owed: target, bGames: 0 });
  for (let i = 0; i < nB; i++) seats.push({ tier: "B", owed: target, bridge: nC >= 3 && i === 0 });
  for (let i = 0; i < nC; i++) seats.push({ tier: "C", owed: target });
  const free = nA >= 1 && nB >= 1 && (nA < 2 || nB < 2);
  return stateOf(seats, free ? "free" : "bound", nC < 3);
};

/** One member of a candidate four, by tier and row. */
interface Pick { tier: Tier; at: number }

/**
 * The after-state rule from the brief: owed players come down one, an
 * at-target player spends a slack seat, and an A in a four with a B has
 * had a B game. The charge for that game is the picker's business, not the
 * oracle's, so it is not added here.
 */
const after = (state: MixingState, picks: readonly Pick[]): MixingState => {
  const as = state.as.map((a) => ({ ...a }));
  const bs = state.bs.map((b) => ({ ...b }));
  const cs = state.cs.map((c) => ({ ...c }));
  let slack = state.slack;
  const hasB = picks.some((p) => p.tier === "B");
  for (const p of picks) {
    const row = p.tier === "A" ? as[p.at] : p.tier === "B" ? bs[p.at] : cs[p.at];
    if (row.owed > 0) row.owed -= 1;
    else slack -= 1;
    if (p.tier === "A" && hasB) as[p.at].bGames += 1;
  }
  return { ...state, as, bs, cs, slack };
};

/* ── the brute force ─────────────────────────────────────────────── */

interface Sim { id: string; tier: Tier; owed: number; bGames: number; bridge: boolean }

const SPLITS: readonly (readonly [number, number, number, number])[] = [
  [0, 3, 1, 2], [0, 1, 2, 3], [0, 2, 1, 3],
];

/**
 * The law lawfulFour applies at a draw: free by headcount, else strict
 * while the A's and the B's both owe an even number of games, else soft.
 */
const lawFor = (ps: readonly Sim[], free: boolean): "free" | "strict" | "soft" => {
  const owedA = ps.filter((p) => p.tier === "A").reduce((n, p) => n + p.owed, 0);
  const owedB = ps.filter((p) => p.tier === "B").reduce((n, p) => n + p.owed, 0);
  return free ? "free" : owedA % 2 === 0 && owedB % 2 === 0 ? "strict" : "soft";
};

const ctxFor = (ps: readonly Sim[], free: boolean, relaxed: boolean): LawContext => {
  const tierById = new Map(ps.map((p) => [p.id, p.tier]));
  return {
    tierById: (id) => tierById.get(id) ?? "B",
    // No bridge on the court means no B may join the C's, so the
    // designated B is somebody who is not here rather than null, which
    // judge() reads as "anyone".
    designatedB: ps.find((p) => p.tier === "B" && p.bridge)?.id ?? "nobody",
    relaxed,
    cCount: ps.filter((p) => p.tier === "C").length,
    abLaw: lawFor(ps, free),
  };
};

/** Is there any split of these four the real judge allows? */
const legal = (four: readonly Sim[], ctx: LawContext): boolean =>
  SPLITS.some(([x, y, z, w]) => {
    const lineup: Lineup = { teamA: [four[x].id, four[y].id], teamB: [four[z].id, four[w].id] };
    return judge(lineup, ctx) === null;
  });

/** The court after these four play: owed comes down, an A with a B has had a B game. */
const dealt = (ps: readonly Sim[], four: readonly Sim[]): Sim[] => {
  const hasB = four.some((p) => p.tier === "B");
  return ps.map((p) => (four.includes(p)
    ? { ...p, owed: Math.max(0, p.owed - 1), bGames: p.bGames + (hasB && p.tier === "A" ? 1 : 0) }
    : p));
};

const keyOf = (ps: readonly Sim[], s: number) =>
  ps.map((p) => `${p.tier}${p.owed}${p.bGames}${p.bridge ? "!" : ""}`).sort().join(",") + "|" + s;

/**
 * The cheapest lawful finish, found by dealing every game the real judge()
 * allows under the law of the moment. A player at owed 0 in a four spends
 * a slack seat, and every A in a four with a B is charged their count.
 * Memoised on the multiset of (tier, owed, bGames, bridge) plus slack, and
 * a four is only followed once per distinct after-state, which is what
 * keeps twelve seats tractable.
 */
function bruteForce(players: readonly Sim[], slack: number, free: boolean, relaxed: boolean): number {
  const memo = new Map<string, number>();
  const rec = (ps: readonly Sim[], s: number): number => {
    const key = keyOf(ps, s);
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    if (ps.every((p) => p.owed === 0) && s === 0) return 0;
    const ctx = ctxFor(ps, free, relaxed);
    let best = Infinity;
    const seen = new Set<string>();
    const n = ps.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) {
      const four = [ps[i], ps[j], ps[k], ps[l]];
      const spent = four.filter((p) => p.owed === 0).length;
      if (spent > s) continue;
      if (!legal(four, ctx)) continue;
      const hasB = four.some((p) => p.tier === "B");
      const charge = hasB ? four.filter((p) => p.tier === "A").reduce((c, p) => c + p.bGames, 0) : 0;
      const next = dealt(ps, four);
      const nextKey = keyOf(next, s - spent);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey);
      best = Math.min(best, charge + rec(next, s - spent));
    }
    memo.set(key, best);
    return best;
  };
  return rec(players, slack);
}

/**
 * The brief's model of slack, dealt by brute force: the extra seats go out
 * by class (an at-target player of the class first, else the least owed),
 * every hand-out is tried, and the live law then plays the padded court
 * with no slack left. Cheapest hand-out wins.
 */
function paddedBruteForce(players: readonly Sim[], slack: number, free: boolean, relaxed: boolean): number {
  const classOf = (p: Sim) => (p.tier === "A" ? `A${p.bGames}` : p.tier === "B" ? `B${p.bridge ? "!" : ""}` : "C");
  const classes = [...new Set(players.map(classOf))];
  let best = Infinity;
  const handOut = (ps: readonly Sim[], left: number, from: number): void => {
    if (left === 0) {
      best = Math.min(best, bruteForce(ps, 0, free, relaxed));
      return;
    }
    for (let c = from; c < classes.length; c++) {
      let pick = -1;
      ps.forEach((p, i) => { if (classOf(p) === classes[c] && (pick < 0 || p.owed < ps[pick].owed)) pick = i; });
      handOut(ps.map((p, i) => (i === pick ? { ...p, owed: p.owed + 1 } : p)), left - 1, c);
    }
  };
  handOut(players, slack, 0);
  return best;
}

/** mulberry32: a seeded generator, so a failing state can be replayed. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface RandomState { players: Sim[]; state: MixingState; free: boolean; relaxed: boolean }

type SlackWanted = "none" | "some";

/**
 * A small court, two ways. Half the time it is anybody at all: up to five
 * A's, six B's, sometimes C's, each owed 0..3, which is mostly courts that
 * cannot be finished and is where Infinity gets its exercise. The other
 * half it is a court that got there: fresh at a target of one to three, a
 * random number of lawful games dealt under the live law, and, when slack
 * is wanted, a walk-in owed a game or two or a leaver with games still
 * owed. The headcount law is free only when the court holds a lone A or a
 * lone B, as abLawFor would say, and on the anybody-at-all courts bound on
 * a coin toss even then, because the rest of the court may hold more of
 * that tier already at target.
 */
function randomState(rng: () => number, maxOwed: number, minOwed: number, slack: SlackWanted): RandomState {
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const fits = (players: readonly Sim[]) => {
    const owed = players.reduce((n, p) => n + p.owed, 0);
    if (owed < minOwed || owed > maxOwed) return false;
    const residue = slackFor(owed);
    return residue <= 2 && (slack === "none" ? residue === 0 : residue > 0);
  };
  const isFree = (players: readonly Sim[]) => {
    const nA = players.filter((p) => p.tier === "A").length;
    const nB = players.filter((p) => p.tier === "B").length;
    return nA >= 1 && nB >= 1 && (nA < 2 || nB < 2);
  };
  for (;;) {
    let id = 0;
    if (rng() < 0.5) {
      const nA = int(0, 5);
      const nB = int(0, 6);
      const nC = rng() < 0.35 ? int(1, 4) : 0;
      const players: Sim[] = [];
      const add = (tier: Tier) => players.push({
        id: `${tier}${id++}`, tier,
        owed: rng() < 0.2 ? 0 : int(1, 3),
        bGames: tier === "A" ? int(0, 2) : 0,
        bridge: false,
      });
      for (let i = 0; i < nA; i++) add("A");
      for (let i = 0; i < nB; i++) add("B");
      for (let i = 0; i < nC; i++) add("C");
      if (!fits(players)) continue;
      const relaxed = nC < 3;
      if (!relaxed && nB > 0 && rng() < 0.8) players[nA + int(0, nB - 1)].bridge = true;
      const free = isFree(players) && rng() < 0.7;
      return { players, state: stateOf(players, free ? "free" : "bound", relaxed), free, relaxed };
    }

    const nA = int(0, 6);
    const nB = int(0, 7);
    const nC = rng() < 0.3 ? int(1, 4) : 0;
    const N = nA + nB + nC;
    const targets = [1, 2, 3].filter((t) => (N * t) % 4 === 0);
    if (N < 4 || targets.length === 0) continue;
    const target = targets[int(0, targets.length - 1)];
    let players: Sim[] = [];
    const add = (tier: Tier) => players.push({ id: `${tier}${id++}`, tier, owed: target, bGames: 0, bridge: false });
    for (let i = 0; i < nA; i++) add("A");
    for (let i = 0; i < nB; i++) add("B");
    for (let i = 0; i < nC; i++) add("C");
    const relaxed = nC < 3;
    if (!relaxed && nB > 0) players[nA + int(0, nB - 1)].bridge = true;
    const free = isFree(players);
    const games = int(0, (N * target) / 4);
    let stuck = false;
    for (let g = 0; g < games && !stuck; g++) {
      const ctx = ctxFor(players, free, relaxed);
      const owed = players.filter((p) => p.owed > 0);
      const fours: Sim[][] = [];
      const n = owed.length;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) {
        const four = [owed[i], owed[j], owed[k], owed[l]];
        if (legal(four, ctx)) fours.push(four);
      }
      if (fours.length === 0) stuck = true;
      else players = dealt(players, fours[int(0, fours.length - 1)]);
    }
    if (stuck) continue;
    if (slack === "some") {
      if (rng() < 0.5 && players.some((p) => p.owed > 0)) {
        const leavers = players.filter((p) => p.owed > 0);
        const leaver = leavers[int(0, leavers.length - 1)];
        players = players.filter((p) => p !== leaver);
      } else {
        const tier: Tier = (["A", "B", "B", "C"] as const)[int(0, 3)];
        // A C walking in cannot cross the relaxed line: two C's stay
        // relaxed, three or more stay a C court.
        if (tier === "C" && ((relaxed && nC >= 2) || (!relaxed && nC === 0))) continue;
        players.push({ id: `w${id++}`, tier, owed: int(1, target), bGames: 0, bridge: false });
      }
    }
    if (!fits(players)) continue;
    // A leaver can take the bridge with them; the C's then need a new one,
    // chosen the way designateB would, first B in seat order.
    if (!relaxed && !players.some((p) => p.bridge)) {
      const b = players.find((p) => p.tier === "B");
      if (b) b.bridge = true;
    }
    const freeNow = isFree(players);
    return { players, state: stateOf(players, freeNow ? "free" : "bound", relaxed), free: freeNow, relaxed };
  }
}

/* ── named nights ────────────────────────────────────────────────── */

describe("deficit: the nights the rule was written for", () => {
  it("the Wednesday roster, twelve A's and eight B's at three, needs no second game", () => {
    // 36 A-seats and 24 B-seats: four mixed games, seven pure A games,
    // four pure B games, and every A meets the B's at most once.
    expect(deficit(fresh(12, 8, 3))).toBe(0);
  });

  it("six A's and two B's at four force exactly two second games", () => {
    // The B's need eight A-seats across the net and there are six A's. The
    // cheapest way is two A's taking a second game at one each, never one
    // A taking a second and a third (1 + 2).
    expect(deficit(fresh(6, 2, 4))).toBe(2);
  });

  it("seven A's and one B at three: the lone B's games spread to nine A-seats, two of them seconds", () => {
    // Free law by headcount. The B plays three games of three A's each
    // (a mixed shape needs the B in every game, so nothing else fits):
    // nine A-seats over seven A's, two of them second games at 1 each.
    expect(deficit(fresh(7, 1, 3))).toBe(2);
  });

  it("four A's, four B's and three C's at four finish with no second game", () => {
    // The C's play four games of three C's plus the bridge, which flips
    // the B parity each time, so the A's meet the B's one at a time in
    // four (1,3) games and play three pure games. A fixed "at most one
    // (1,3) game" said 8 here, and the greedy dealt four needless seconds.
    expect(deficit(fresh(4, 4, 4, 3))).toBe(0);
  });

  it("a lone A among seven B's at three pays for every game past the first", () => {
    // Every game the A plays has B's in it: 0 + 1 + 2.
    expect(deficit(fresh(1, 7, 3))).toBe(3);
  });

  it("the other rosters the brief names all start clean", () => {
    expect(deficit(fresh(6, 6, 4))).toBe(0);
    expect(deficit(fresh(8, 8, 3))).toBe(0);
    expect(deficit(fresh(5, 4, 3, 3))).toBe(0);
    expect(deficit(fresh(5, 4, 2, 3))).toBe(0);
  });

  it("no composition fits: three players owed four seats", () => {
    const state = stateOf([
      { tier: "A", owed: 2 }, { tier: "B", owed: 1 }, { tier: "B", owed: 1 },
    ], "bound", true);
    expect(state.slack).toBe(0);
    expect(deficit(state)).toBe(Infinity);
  });
});

describe("deficit: slack, the walk-in's signature", () => {
  it("one extra seat goes to the at-target player of the class that needs it", () => {
    // Two A's and a B each owed one game: three seats, so the card grows
    // by one, and the one B already at target fills it. Padding an owed B
    // to two games or an A to two cannot be finished, so the oracle has to
    // find the at-target player.
    const withB = stateOf([
      { tier: "A", owed: 1 }, { tier: "A", owed: 1 }, { tier: "B", owed: 1 }, { tier: "B", owed: 0 },
    ], "bound", true);
    expect(withB.slack).toBe(1);
    expect(deficit(withB)).toBe(0);
    // The same seats with nobody at target to take the extra seat.
    const withoutB = stateOf([
      { tier: "A", owed: 1 }, { tier: "A", owed: 1 }, { tier: "B", owed: 1 },
    ], "bound", true);
    expect(withoutB.slack).toBe(1);
    expect(deficit(withoutB)).toBe(Infinity);
  });

  it("a B walking in at three when the A's have had their game with the B's", () => {
    // Four A's and four B's each owed one, all the A's already charged
    // once, and a B walks in owed three: eleven seats, one of slack. The
    // walk-in needs three games and the B's alone cannot give them, so
    // the seats force mixed games and every A in one pays a second game.
    // The brute force agrees on the number.
    const players: Sim[] = [
      ...[0, 1, 2, 3].map((i) => ({ id: `a${i}`, tier: "A" as const, owed: 1, bGames: 1, bridge: false })),
      ...[0, 1, 2, 3].map((i) => ({ id: `b${i}`, tier: "B" as const, owed: 1, bGames: 0, bridge: false })),
      { id: "late", tier: "B", owed: 3, bGames: 0, bridge: false },
    ];
    const state = stateOf(players, "bound", true);
    expect(state.slack).toBe(1);
    expect(deficit(state)).toBe(4);
    expect(bruteForce(players, 1, false, true)).toBe(4);
  });

  it("a four with an at-target player is Infinity when there is no slack to spend", () => {
    const base: Seat[] = [
      { tier: "A", owed: 1 }, { tier: "A", owed: 1 }, { tier: "A", owed: 0 },
      { tier: "B", owed: 1 }, { tier: "B", owed: 1 },
    ];
    const noSlack = stateOf(base, "bound", true);
    expect(noSlack.slack).toBe(0);
    const four: Pick[] = [{ tier: "A", at: 0 }, { tier: "A", at: 2 }, { tier: "B", at: 0 }, { tier: "B", at: 1 }];
    const dealt = after(noSlack, four);
    expect(dealt.slack).toBe(-1);
    expect(deficit(dealt)).toBe(Infinity);
    // Three more B's owed one make seven seats, so the card grows by one:
    // now the A at target spends the slack seat and the rest finish clean
    // as an A with three B's under the soft law.
    const withSlack = stateOf([...base, { tier: "B", owed: 1 }, { tier: "B", owed: 1 }, { tier: "B", owed: 1 }], "bound", true);
    expect(withSlack.slack).toBe(1);
    const dealtWithSlack = after(withSlack, four);
    expect(dealtWithSlack.slack).toBe(0);
    expect(deficit(dealtWithSlack)).toBe(0);
  });
});

/* ── the brute force ─────────────────────────────────────────────── */

describe("deficit against the real judge, every lawful sequence dealt", () => {
  const show = (players: readonly Sim[]) =>
    players.map((p) => `${p.tier}${p.owed}${p.tier === "A" ? `/${p.bGames}` : ""}${p.bridge ? "!" : ""}`).join(" ");

  const compare = (
    seed: number, count: number, maxOwed: number, minOwed: number, slack: SlackWanted,
    truthOf: (players: readonly Sim[], slack: number, free: boolean, relaxed: boolean) => number,
  ) => {
    const rng = seeded(seed);
    const mismatches: string[] = [];
    const tally = { zero: 0, positive: 0, infinite: 0, withC: 0, free: 0 };
    for (let n = 0; n < count; n++) {
      const { players, state, free, relaxed } = randomState(rng, maxOwed, minOwed, slack);
      const truth = truthOf(players, state.slack, free, relaxed);
      const claim = deficit(state);
      if (truth === 0) tally.zero++;
      else if (truth === Infinity) tally.infinite++;
      else tally.positive++;
      if (state.cs.length > 0) tally.withC++;
      if (free) tally.free++;
      if (claim !== truth) {
        mismatches.push(`#${n} oracle ${claim} brute ${truth} slack ${state.slack} ${free ? "free" : "bound"} `
          + `${relaxed ? "relaxed" : "C-law"} ${show(players)}`);
      }
    }
    return { mismatches, tally };
  };

  it("agrees with the live law on 400 seeded courts of up to nine owed seats and no slack, with and without C's", () => {
    const { mismatches, tally } = compare(20260910, 400, 9, 1, "none", bruteForce);
    expect(mismatches).toEqual([]);
    // The sample has to be worth something: clean finishes, forced second
    // games, impossible seats, C's and the free law all present in numbers.
    expect(tally.zero).toBeGreaterThanOrEqual(60);
    expect(tally.positive).toBeGreaterThanOrEqual(30);
    expect(tally.infinite).toBeGreaterThanOrEqual(30);
    expect(tally.withC).toBeGreaterThanOrEqual(60);
    expect(tally.free).toBeGreaterThanOrEqual(20);
  }, 60_000);

  it("and on 150 seeded courts of ten to twelve owed seats, three games deep", () => {
    const { mismatches, tally } = compare(9, 150, 12, 10, "none", bruteForce);
    expect(mismatches).toEqual([]);
    expect(tally.positive).toBeGreaterThanOrEqual(10);
  }, 120_000);

  it("with slack, agrees with the brief's model on 400 seeded courts: seats out by class, then the live law", () => {
    // A walk-in or a leaver leaves one or two seats for people at target.
    // The oracle hands them out by class before counting, and this is that
    // hand-out done the long way: every class multiset, the level hand-out
    // within each class, then the real judge on the padded court.
    const { mismatches, tally } = compare(1, 400, 9, 1, "some", paddedBruteForce);
    expect(mismatches).toEqual([]);
    expect(tally.zero).toBeGreaterThanOrEqual(40);
    expect(tally.positive).toBeGreaterThanOrEqual(25);
    expect(tally.withC).toBeGreaterThanOrEqual(40);
    const deeper = compare(2, 150, 12, 10, "some", paddedBruteForce);
    expect(deeper.mismatches).toEqual([]);
    expect(deeper.tally.zero).toBeGreaterThanOrEqual(20);
    expect(deeper.tally.positive).toBeGreaterThanOrEqual(40);
  }, 120_000);

  it("with slack, the live law dealt seat by seat mostly agrees, and the rest is a known approximation", () => {
    // The padded court counts the slack seats in its parities from the
    // start; the live court in lawfulFour counts a seat only once an
    // at-target player has spent it, so the two can call strict and soft
    // at different moments. Measured with the anybody-at-all courts alone
    // on 2,338 slack states of nine and twelve seats: 47 where the oracle
    // asks more than the live law needs, 2 where it asks less, and none at
    // all where slack is 0. On this batch it is 2 of 400. The brief accepts
    // this (the critics measured the greedy on the Wednesday walk-in and
    // leaver cases with this model), so the test pins the rate rather than
    // pretending it is zero.
    const { mismatches } = compare(1, 400, 9, 1, "some", bruteForce);
    expect(mismatches.length).toBeLessThanOrEqual(400 * 0.05);
  }, 60_000);
});

describe("where the padded model and the live law part ways", () => {
  // Pinned so the approximation is a fact in the suite, not folklore.
  it("a court that owes six seats with a B at target: the oracle asks Infinity, the live law finishes for 1", () => {
    // An A owed two who has not met the B's, B's owed 2, 1, 1, 1 and a B at
    // target. Padded either way the parities come out where one (1,3)
    // game is not enough and two are not allowed; dealt live, the B at
    // target spends the slack seat in the second (1,3) game while the
    // owed totals still read soft.
    const players: Sim[] = [
      { id: "a", tier: "A", owed: 2, bGames: 0, bridge: false },
      { id: "b1", tier: "B", owed: 2, bGames: 0, bridge: false },
      { id: "b2", tier: "B", owed: 1, bGames: 0, bridge: false },
      { id: "b3", tier: "B", owed: 1, bGames: 0, bridge: false },
      { id: "b4", tier: "B", owed: 1, bGames: 0, bridge: false },
      { id: "b5", tier: "B", owed: 0, bGames: 0, bridge: false },
    ];
    const state = stateOf(players, "bound", true);
    expect(state.slack).toBe(1);
    expect(deficit(state)).toBe(Infinity);
    expect(paddedBruteForce(players, 1, false, true)).toBe(Infinity);
    expect(bruteForce(players, 1, false, true)).toBe(1);
  });

  it("four on a court, two at target: the oracle prices the last game at 1, the live law cannot deal it", () => {
    // Two B's owed one, an A and a B at target. Padded, the A's seat and
    // the B's seat make the parities odd and the (1,3) game is soft and
    // lawful. Live, the owed totals are 0 and 2, both even, so lawfulFour
    // calls it strict and the same four is unlawful.
    const players: Sim[] = [
      { id: "a", tier: "A", owed: 0, bGames: 1, bridge: false },
      { id: "b1", tier: "B", owed: 1, bGames: 0, bridge: false },
      { id: "b2", tier: "B", owed: 1, bGames: 0, bridge: false },
      { id: "b3", tier: "B", owed: 0, bGames: 0, bridge: false },
    ];
    const state = stateOf(players, "bound", true);
    expect(state.slack).toBe(2);
    expect(deficit(state)).toBe(1);
    expect(paddedBruteForce(players, 2, false, true)).toBe(1);
    expect(bruteForce(players, 2, false, true)).toBe(Infinity);
  });
});

/* ── the memo's claim ────────────────────────────────────────────── */

describe("two fours of the same classes leave the same deficit", () => {
  it("on the Wednesday roster mid-night, swapping like for like changes nothing", () => {
    // Class is (tier, owed, bGames, bridge). Two fours built from the same
    // classes, drawn from different people, must leave after-states the
    // oracle prices the same: that is what lets the picker key its memo on
    // the sorted class ids of a four rather than on the names.
    const seats: Seat[] = [
      { tier: "A", owed: 2, bGames: 0 }, { tier: "A", owed: 2, bGames: 0 },
      { tier: "A", owed: 2, bGames: 1 }, { tier: "A", owed: 2, bGames: 1 },
      { tier: "A", owed: 1, bGames: 1 }, { tier: "A", owed: 1, bGames: 1 },
      { tier: "B", owed: 2 }, { tier: "B", owed: 2 }, { tier: "B", owed: 2 }, { tier: "B", owed: 2 },
      { tier: "B", owed: 1 }, { tier: "B", owed: 1 },
    ];
    const state = stateOf(seats, "bound", true);
    const one = after(state, [{ tier: "A", at: 0 }, { tier: "A", at: 2 }, { tier: "B", at: 0 }, { tier: "B", at: 4 }]);
    const two = after(state, [{ tier: "A", at: 1 }, { tier: "A", at: 3 }, { tier: "B", at: 3 }, { tier: "B", at: 5 }]);
    expect(deficit(one)).toBe(deficit(two));
    expect(deficit(one)).not.toBe(Infinity);
  });

  it("and on 100 seeded random courts", () => {
    const rng = seeded(7);
    let checked = 0;
    for (let n = 0; n < 100; n++) {
      const { state } = randomState(rng, 12, 6, "none");
      const rows: (Pick & { cls: string })[] = [
        ...state.as.map((a, at) => ({ tier: "A" as const, at, cls: `A${a.owed}/${a.bGames}` })),
        ...state.bs.map((b, at) => ({ tier: "B" as const, at, cls: `B${b.owed}${b.bridge ? "!" : ""}` })),
        ...state.cs.map((c, at) => ({ tier: "C" as const, at, cls: `C${c.owed}` })),
      ];
      if (rows.length < 5) continue;
      // Four rows, then a second four that swaps each for another of its
      // class where one exists. Skip when nothing can be swapped.
      const shuffled = [...rows].sort(() => rng() - 0.5);
      const one = shuffled.slice(0, 4);
      const rest = shuffled.slice(4);
      const used = new Set<Pick>();
      const two = one.map((p) => {
        const swap = rest.find((r) => r.cls === p.cls && !used.has(r));
        if (swap) used.add(swap);
        return swap ?? p;
      });
      if (two.every((p, i) => p === one[i])) continue;
      checked++;
      expect(deficit(after(state, one))).toBe(deficit(after(state, two)));
    }
    expect(checked).toBeGreaterThanOrEqual(30);
  });
});
