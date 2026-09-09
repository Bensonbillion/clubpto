// The Set teammate branch (frames 35 to 37).

import { describe, expect, it } from "vitest";
import type { KnockoutPair, Match } from "../../types";
import {
  mintTeamMatch, nextTeamTie, pairCounts, pairGameNumber, pairKey, presentPairs, seedByTable,
  suggestTeamTarget, tableShape, teamMatchesTotal, teamStandings, teamsComplete,
  validTeamTargets, waitingPairs,
} from "../teams";

const pairs = (n: number): KnockoutPair[] =>
  Array.from({ length: n }, (_, i) => ({ seed: i + 1, playerIds: [`a${i + 1}`, `b${i + 1}`] }));

let idn = 0;
const played = (a: KnockoutPair, b: KnockoutPair, sa: number, sb: number): Match => ({
  id: `m${++idn}`, courtNumber: 1, matchIndex: idn,
  teamA: [a.playerIds[0], a.playerIds[1]], teamB: [b.playerIds[0], b.playerIds[1]],
  scoreA: sa, scoreB: sb, status: "played", startedAt: 1, completedAt: idn, stage: null,
});

/** A small deterministic generator, so a failing order can be named. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * A whole night, run the way useSession runs it: fill every free court in
 * court order, then finish one live match (whichever the order names) and
 * fill again, until nothing is live and nothing can go on.
 */
function simulate(n: number, target: number, courts: number, seed: number, away = new Set<string>()) {
  const P = pairs(n);
  const next = rng(seed);
  let matches: Match[] = [];
  let index = 0;
  let now = 1000;
  const dispatch = () => {
    const busy = new Set(matches.filter((m) => m.status === "onCourt").map((m) => m.courtNumber));
    for (let c = 1; c <= courts; c++) {
      if (busy.has(c)) continue;
      const tie = nextTeamTie(P, matches, target, away);
      if (!tie) break;
      matches = [...matches, mintTeamMatch(c, tie.a, tie.b, ++index, now++, matches, away)];
    }
  };
  for (let guard = 0; guard < 400; guard++) {
    dispatch();
    const live = matches.filter((m) => m.status === "onCourt");
    if (live.length === 0) break;
    const done = live[Math.floor(next() * live.length)];
    matches = matches.map((m) => m.id === done.id
      ? { ...m, status: "played" as const, scoreA: 7, scoreB: 5, completedAt: now++ }
      : m);
  }
  const counts = pairCounts(P, matches);
  const opponents = (p: KnockoutPair) => new Set(matches
    .filter((m) => m.status === "played")
    .flatMap((m) => {
      const a = P.find((x) => m.teamA.every((id) => x.playerIds.includes(id)))!;
      const b = P.find((x) => m.teamB.every((id) => x.playerIds.includes(id)))!;
      return a === p ? [b.seed] : b === p ? [a.seed] : [];
    }));
  return { P, matches, counts, opponents };
}

describe("frame 35: games per pair", () => {
  it("five pairs: four divides, five does not, six does", () => {
    expect(validTeamTargets(5)).toEqual([2, 4, 6, 8]);
    expect(suggestTeamTarget(5)).toBe(4);
    expect(teamMatchesTotal(5, 4)).toBe(10);
    expect(teamMatchesTotal(5, 6)).toBe(15);
  });

  it("an even number of pairs takes any target", () => {
    expect(validTeamTargets(4)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("who goes on next", () => {
  it("least-played-first over pairs, and opponents vary before any rematch", () => {
    const P = pairs(4);
    const m = [played(P[0], P[1], 7, 5)];
    const tie = nextTeamTie(P, m, 3)!;
    // Least played are pairs 3 and 4 (zero games): they meet each other.
    expect([tie.a.seed, tie.b.seed]).toEqual([3, 4]);
    // With those two on court, the only free pairs are 1 and 2, who have
    // just met, and pairs 3 and 4 are fresher opponents for both: the court
    // holds rather than dealing the rematch.
    const live: Match = { ...played(P[2], P[3], 0, 0), status: "onCourt", scoreA: null, scoreB: null };
    expect(nextTeamTie(P, [...m, live], 3)).toBeNull();
    // Once nobody fresher is on a court, the rematch is the honest next tie.
    const settled = { ...live, status: "played" as const, scoreA: 7, scoreB: 5 };
    const m2 = [...m, settled, played(P[0], P[2], 7, 5), played(P[1], P[3], 7, 5),
      played(P[0], P[3], 7, 5), played(P[1], P[2], 7, 5)];
    const last = nextTeamTie(P, m2, 4)!;
    expect([last.a.seed, last.b.seed]).toEqual([1, 2]);
  });

  it("prefers an unmet opponent over a rematch", () => {
    const P = pairs(3);
    const m = [played(P[0], P[1], 7, 5), played(P[0], P[2], 7, 5)];
    const tie = nextTeamTie(P, m, 4)!;
    expect([tie.a.seed, tie.b.seed].sort()).toEqual([2, 3]);
  });

  it("a pair at its target is done, and the night completes when all are", () => {
    const P = pairs(2);
    const m = [played(P[0], P[1], 7, 5), played(P[1], P[0], 6, 7)];
    expect(nextTeamTie(P, m, 2)).toBeNull();
    expect(teamsComplete(P, m, 2)).toBe(true);
    expect(teamsComplete(P, m, 3)).toBe(false);
    expect(pairCounts(P, m).get("a1+b1")!.played).toBe(2);
  });

  it("refuses the tie that would strand a pair still on a court (the review's five-pair trace)", () => {
    // Five pairs at four on two courts, eight games in: pair 5 stands on
    // court 1 with two games still to come after this one, pairs 1 and 4
    // are free on three each. Dealing 1 against 4 leaves pair 5 with
    // nobody to play. The court waits instead.
    const P = pairs(5);
    const m = [
      played(P[0], P[1], 7, 5), played(P[2], P[3], 7, 5), played(P[1], P[2], 7, 5),
      played(P[3], P[1], 7, 5), played(P[4], P[0], 7, 5), played(P[2], P[3], 7, 5),
      played(P[0], P[2], 7, 5),
    ];
    const live: Match = { ...played(P[4], P[1], 0, 0), status: "onCourt", scoreA: null, scoreB: null };
    expect(nextTeamTie(P, [...m, live], 4)).toBeNull();
    // Pair 2 finishes; pair 5 comes off and is dealt.
    const after = [...m, { ...live, status: "played" as const, scoreA: 7, scoreB: 5 }];
    const tie = nextTeamTie(P, after, 4)!;
    expect([tie.a.seed, tie.b.seed].sort()).toEqual([4, 5]);
  });
});

describe("a whole night, every finishing order", () => {
  const shapes: [number, number, number][] = [
    [5, 4, 2], [6, 4, 2], [6, 4, 3], [4, 4, 2], [4, 3, 2], [3, 4, 1], [3, 2, 1],
    [7, 4, 3], [8, 4, 3], [5, 6, 2], [2, 4, 1], [9, 4, 3], [16, 4, 3], [6, 3, 3], [8, 3, 2],
  ];
  for (const [n, t, c] of shapes) {
    it(`${n} pairs at ${t} on ${c} court${c > 1 ? "s" : ""}: nobody is stranded`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const { P, matches, counts } = simulate(n, t, c, seed);
        for (const p of P) expect(counts.get(pairKey(p))!.played, `seed ${seed} pair ${p.seed}`).toBe(t);
        expect(matches.filter((m) => m.status === "played")).toHaveLength(teamMatchesTotal(n, t));
        expect(teamsComplete(P, matches, t)).toBe(true);
      }
    });
  }

  it("four pairs on two courts meet everyone before anyone twice", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const three = simulate(4, 3, 2, seed);
      for (const p of three.P) expect([...three.opponents(p)].sort(), `seed ${seed}`).toHaveLength(3);
      const four = simulate(4, 4, 2, seed);
      for (const p of four.P) expect([...four.opponents(p)].sort(), `seed ${seed}`).toHaveLength(3);
    }
  });

  it("six pairs on three courts see fresh opponents, not the same pair all night", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { P, opponents } = simulate(6, 4, 3, seed);
      for (const p of P) expect(opponents(p).size, `seed ${seed} pair ${p.seed}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("a pair that leaves", () => {
  it("is dealt no more games, and the night ends without waiting for it", () => {
    const P = pairs(3);
    const m = [played(P[0], P[1], 7, 5), played(P[2], P[0], 7, 5)];
    const away = new Set(["a3"]);
    expect(presentPairs(P, away).map((p) => p.seed)).toEqual([1, 2]);
    // Pair 3 is out. Pair 1 is at two; pair 2 has one and nobody to play.
    expect(nextTeamTie(P, m, 2, away)).toBeNull();
    expect(teamsComplete(P, m, 2, away)).toBe(true);
    expect(waitingPairs(P, m, 2, away).map((p) => p.seed)).toEqual([2]);
    // Marked back, pair 3 is in the pool again.
    expect(nextTeamTie(P, m, 2)).not.toBeNull();
  });

  it("a trio with one away fields its two", () => {
    const trio: KnockoutPair = { seed: 1, playerIds: ["x", "y", "z"] };
    const other: KnockoutPair = { seed: 2, playerIds: ["p", "q"] };
    const away = new Set(["y"]);
    expect(presentPairs([trio, other], away)).toHaveLength(2);
    const m = mintTeamMatch(1, trio, other, 1, 1000, [], away);
    expect(m.teamA.sort()).toEqual(["x", "z"]);
    const later = mintTeamMatch(1, trio, other, 2, 2000, [{ ...m, status: "played", scoreA: 7, scoreB: 5 }], away);
    expect(later.teamA.sort()).toEqual(["x", "z"]);
  });

  it("a whole night with a leaver still finishes", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { P, matches, counts } = simulate(5, 4, 2, seed, new Set(["a5"]));
      expect(counts.get(pairKey(P[4]))!.played).toBe(0);
      expect(teamsComplete(P, matches, 4, new Set(["a5"]))).toBe(true);
      expect(matches.filter((m) => m.status === "onCourt")).toHaveLength(0);
    }
  });
});

describe("the card's chip and the waiting line", () => {
  it("numbers a pair's games, and a live one is the game after everything played", () => {
    const P = pairs(3);
    const first = played(P[0], P[1], 7, 5);
    const second = played(P[0], P[2], 7, 5);
    const live: Match = { ...played(P[0], P[1], 0, 0), status: "onCourt", scoreA: null, scoreB: null };
    const m = [first, second, live];
    expect(pairGameNumber(P, m, P[0], first.id)).toBe(1);
    expect(pairGameNumber(P, m, P[0], second.id)).toBe(2);
    expect(pairGameNumber(P, m, P[0], live.id)).toBe(3);
    expect(pairGameNumber(P, m, P[1], live.id)).toBe(2);
  });

  it("names who waits when only one pair is free", () => {
    const P = pairs(3);
    const live: Match = { ...played(P[0], P[1], 0, 0), status: "onCourt", scoreA: null, scoreB: null };
    expect(nextTeamTie(P, [live], 2)).toBeNull();
    expect(waitingPairs(P, [live], 2).map((p) => p.seed)).toEqual([3]);
  });
});

describe("frame 36: the table over pairs", () => {
  it("ranks pairs on points, then score difference, in the individual engine's own words", () => {
    const P = pairs(3);
    const m = [played(P[0], P[1], 7, 3), played(P[2], P[1], 7, 6), played(P[0], P[2], 5, 7)];
    const rows = teamStandings(P, m);
    expect(rows.map((r) => r.playerId)).toEqual(["a3+b3", "a1+b1", "a2+b2"]);
    expect(rows[0].points).toBe(6);
    expect(rows[1].points).toBe(3);
  });
});

describe("frame 37: seed the bracket from the table", () => {
  it("table position becomes draw position, first against last", () => {
    const P = pairs(3);
    const m = [played(P[2], P[0], 7, 3), played(P[2], P[1], 7, 3), played(P[1], P[0], 7, 3)];
    const rows = teamStandings(P, m);
    const draw = seedByTable(P, rows);
    expect(draw.map((p) => p.playerIds[0])).toEqual(["a3", "a2", "a1"]);
    expect(draw.map((p) => p.seed)).toEqual([1, 2, 3]);
  });

  it("says the shape in table positions", () => {
    expect(tableShape(5)).toBe("With 5 pairs: a play-in between fourth and fifth, byes to the top three.");
    expect(tableShape(4)).toBe("With 4 pairs: semifinals straight away, first against fourth and second against third.");
    expect(tableShape(2)).toBe("With 2 pairs: the final, first against second.");
    expect(tableShape(3)).toBe("With 3 pairs: a play-in between second and third, a bye for the top pair.");
    expect(tableShape(6)).toBe("With 6 pairs: play-ins, third against sixth and fourth against fifth, byes to the top two.");
    expect(tableShape(7)).toBe("With 7 pairs: play-ins, second against seventh down to fourth against fifth, a bye for the top pair.");
    expect(tableShape(8)).toBe("With 8 pairs: quarterfinals straight away, first against eighth down to fourth against fifth.");
    expect(tableShape(1)).toBeNull();
  });
});

describe("minting", () => {
  it("a trio fields two and rotates, like the knockout's trio", () => {
    const trio: KnockoutPair = { seed: 1, playerIds: ["x", "y", "z"] };
    const other: KnockoutPair = { seed: 2, playerIds: ["p", "q"] };
    const first = mintTeamMatch(1, trio, other, 1, 1000, []);
    expect(first.teamA).toHaveLength(2);
    const second = mintTeamMatch(1, trio, other, 2, 2000, [{ ...first, status: "played", scoreA: 7, scoreB: 5 }]);
    expect(second.teamA).not.toEqual(first.teamA);
    expect(first.stage).toBeNull();
  });
});
