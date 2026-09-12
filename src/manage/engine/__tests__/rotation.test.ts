// "Whoever is owed a game is at the top", the queue rule, asserted by name.
//
// The cases that matter are the ones where "owed" and "least played" diverge:
// a late arrival, an extended target, and a player marked away. Those are the
// three things that happen on a real Wednesday and the three that a naive
// least-played sort gets wrong.
//
// The second half of the file is the balance rule (frame 11), and it is
// written the same way: every test names the night it stops going wrong.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../../types";
import {
  bench, buildQueue, courtComplete, explainMatch, lawContextFor, matchesPlayedBy, nextMatch,
  totalMatches, validTargets,
} from "../rotation";
import { designateB, judge, lawForOwedSeats, tierOf } from "../tiers";

const P = (id: string, over: Partial<Player> = {}): Player => ({
  id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
  joinedAtMatchIndex: null, ...over,
});

let seq = 0;
const played = (ids: string[]): Match => ({
  id: `m${++seq}`, courtNumber: 1, matchIndex: seq,
  teamA: [ids[0], ids[1]], teamB: [ids[2], ids[3]],
  scoreA: 2, scoreB: 0, status: "played", startedAt: seq, completedAt: seq, stage: null,
});

const eight = () => ["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => P(x));

/** The same eight, with C chips on the two players named. */
const eightWithCs = (...cs: string[]) =>
  eight().map((p) => (cs.includes(p.id) ? { ...p, tier: "C" as const } : p));

/**
 * Run a court to exhaustion, recording the played-count spread after every
 * match. Nothing here knows the rules; it only replays what nextMatch decides.
 */
const runNight = (roster: Player[], target: number) => {
  const matches: Match[] = [];
  const spreads: number[] = [];
  // A court of this size cannot legitimately need more rounds than this, so
  // the bound turns "the engine never stops" into a failed assertion rather
  // than a hung test run.
  for (let guard = 0; guard < 40; guard++) {
    const next = nextMatch(roster, matches, 1, target);
    if (!next) break;
    matches.push({
      id: `sim${matches.length}`, courtNumber: 1, matchIndex: matches.length + 1,
      teamA: next.teamA, teamB: next.teamB,
      scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
    });
    const counts = roster.map((p) => matchesPlayedBy(matches, p.id));
    spreads.push(Math.max(...counts) - Math.min(...counts));
  }
  return { matches, spreads, counts: roster.map((p) => matchesPlayedBy(matches, p.id)) };
};

const tiersOf = (roster: readonly Player[], m: Match) =>
  [...m.teamA, ...m.teamB].filter((id) => roster.find((p) => p.id === id)?.tier === "C");

describe("the queue puts whoever is owed a game at the top", () => {
  it("with nobody played, everyone is owed the same and roster order holds", () => {
    seq = 0;
    const q = buildQueue(eight(), [], 1, 4);
    expect(q).toHaveLength(8);
    expect(q.every((x) => x.owed === 4)).toBe(true);
    expect(q.map((x) => x.playerId)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("players who have had games drop below those who have not", () => {
    seq = 0;
    const q = buildQueue(eight(), [played(["a", "b", "c", "d"])], 1, 4);
    expect(q.slice(0, 4).map((x) => x.playerId)).toEqual(["e", "f", "g", "h"]);
    expect(q[0].owed).toBe(4);
    expect(q[7].owed).toBe(3);
  });

  it("A LATE ARRIVAL goes straight to the top, because they are owed the most", () => {
    seq = 0;
    // Eight players have each had two games; a ninth walks in at match 5.
    const ms = [
      played(["a", "b", "c", "d"]), played(["e", "f", "g", "h"]),
      played(["a", "b", "c", "d"]), played(["e", "f", "g", "h"]),
    ];
    const roster = [...eight(), P("late", { joinedAtMatchIndex: 5 })];
    const q = buildQueue(roster, ms, 1, 4);
    expect(q[0].playerId).toBe("late");
    expect(q[0].owed).toBe(4);
    // …and they are actually put on court, not left to wait out the backlog.
    expect(nextMatch(roster, ms, 1, 4)!.teamA.concat(nextMatch(roster, ms, 1, 4)!.teamB))
      .toContain("late");
  });

  it("EXTENDING the target owes everyone one more, with no special case", () => {
    seq = 0;
    const ms = [played(["a", "b", "c", "d"]), played(["e", "f", "g", "h"])];
    const before = buildQueue(eight(), ms, 1, 1);
    expect(before.every((x) => x.owed === 0)).toBe(true);
    const after = buildQueue(eight(), ms, 1, 2);
    expect(after.every((x) => x.owed === 1)).toBe(true);
  });

  it("someone marked AWAY leaves the queue but keeps their results", () => {
    seq = 0;
    const roster = eight().map((p) => (p.id === "a" ? { ...p, away: true } : p));
    const q = buildQueue(roster, [played(["a", "b", "c", "d"])], 1, 4);
    expect(q.map((x) => x.playerId)).not.toContain("a");
    expect(q).toHaveLength(7);
  });

  it("the BENCH is the queue without the four on court, even when they have played the same", () => {
    // Match 1 of a fresh night: a, b, c, d are on court and have played
    // nothing, so a plain slice of the queue names them as the four waiting.
    // The four watching are e, f, g, h, and the card must say so.
    seq = 0;
    const onCourt: Match = {
      id: "live", courtNumber: 1, matchIndex: 1, teamA: ["a", "d"], teamB: ["b", "c"],
      scoreA: null, scoreB: null, status: "onCourt", startedAt: 1, completedAt: null, stage: null,
    };
    const q = buildQueue(eight(), [onCourt], 1, 3);
    expect(q.slice(0, 4).map((x) => x.playerId)).toEqual(["a", "b", "c", "d"]);
    expect(bench(q, [onCourt], 1).map((x) => x.playerId)).toEqual(["e", "f", "g", "h"]);
    // Another court's live game keeps nobody off this court's bench.
    const elsewhere: Match = { ...onCourt, id: "other", courtNumber: 2, teamA: ["e", "f"], teamB: ["g", "h"] };
    expect(bench(q, [onCourt, elsewhere], 1).map((x) => x.playerId)).toEqual(["e", "f", "g", "h"]);
    // A skipped game holds nobody: its four are waiting like anyone else.
    const skipped: Match = { ...onCourt, id: "held", status: "skipped", teamA: ["e", "h"], teamB: ["f", "g"] };
    expect(bench(q, [onCourt, skipped], 1).map((x) => x.playerId)).toEqual(["e", "f", "g", "h"]);
  });

  it("players on another court are never queued, they stay put all night", () => {
    seq = 0;
    const roster = [...eight(), P("other", { courtNumber: 2 })];
    expect(buildQueue(roster, [], 1, 4).map((x) => x.playerId)).not.toContain("other");
  });
});

describe("the next four", () => {
  it("splits the top four as 1+4 against 2+3", () => {
    seq = 0;
    const m = nextMatch(eight(), [], 1, 4)!;
    expect(m.teamA).toEqual(["a", "d"]);
    expect(m.teamB).toEqual(["b", "c"]);
  });

  it("returns null rather than inventing a three-player game", () => {
    seq = 0;
    const three = [P("a"), P("b"), P("c")];
    expect(nextMatch(three, [], 1, 4)).toBeNull();
  });

  it("STOPS at the target, so a four-round night never draws a fifth", () => {
    seq = 0;
    // Four players, target 2, both rounds played: everyone is owed nothing.
    const ms = [played(["a", "b", "c", "d"]), played(["a", "c"].concat(["b", "d"]))];
    const four = ["a", "b", "c", "d"].map((x) => P(x));
    expect(courtComplete(four, ms, 1, 2)).toBe(true);
    expect(nextMatch(four, ms, 1, 2)).toBeNull();
    // …and raising the target puts them straight back on.
    expect(nextMatch(four, ms, 1, 3)).not.toBeNull();
  });

  it("STOPS at the target with tiers in play too, so the balance rule cannot mint a round", () => {
    // The balance rule reaches further down the queue than the plain draw does,
    // so it is exactly the kind of change that could resurrect a finished
    // court by finding four names after the target was met. Cs on court, night
    // fully played, still nothing to draw.
    const roster = eightWithCs("a", "f");
    const { matches } = runNight(roster, 3);
    expect(matches).toHaveLength(6);
    expect(courtComplete(roster, matches, 1, 3)).toBe(true);
    expect(nextMatch(roster, matches, 1, 3)).toBeNull();
  });

  it("is deterministic: same court, same state, same four", () => {
    seq = 0;
    const ms = [played(["a", "b", "c", "d"])];
    expect(nextMatch(eight(), ms, 1, 4)).toEqual(nextMatch(eight(), ms, 1, 4));
  });
});

describe("the balance rule: nobody is the only C on court", () => {
  it("PULLS A SECOND C IN rather than leaving one alone against three", () => {
    // Without this the first round of frame 07's Court 1 is Abiola on his own
    // against three unassessed players, which is the "three people hunting the
    // weak fourth" game the rule exists to prevent.
    const roster = eightWithCs("a", "f");
    const m = nextMatch(roster, [], 1, 4)!;
    const four = [...m.teamA, ...m.teamB];
    expect(four).toContain("a");
    expect(four).toContain("f");
    expect(m.reason.balance.kind).toBe("acrossTheNet");
    // The rule names who moved, so the screen can say it out loud.
    expect(m.reason.balance.swap).toEqual({
      inPlayerId: "f", inName: "F", outPlayerId: "d", outName: "D",
    });
  });

  it("puts two Cs ACROSS THE NET when the house pairing would sit them together", () => {
    // 1+4 / 2+3 would make B and C partners here. Pairing them is the failure:
    // one team carries both newcomers and the match is over before it starts.
    const roster = eightWithCs("b", "c");
    const m = nextMatch(roster, [], 1, 4)!;
    expect(m.teamA.includes("b") ? m.teamB : m.teamA).toContain("c");
    expect(m.reason.balance.kind).toBe("acrossTheNet");
    expect(m.reason.balance.cPlayers.map((c) => c.side).sort()).toEqual(["A", "B"]);
  });

  it("splits Cs that the house pairing would put together at the ENDS of the four", () => {
    // The other way the default pairing fails: seats 1 and 4 are teamA, so Cs
    // sitting first and fourth in the queue would be partners.
    const roster = eightWithCs("a", "d");
    const m = nextMatch(roster, [], 1, 4)!;
    expect(m.teamA.includes("a") ? m.teamB : m.teamA).toContain("d");
    expect(m.reason.balance.kind).toBe("acrossTheNet");
  });

  it("never sits two Cs on the same side across a whole night", () => {
    // A single-match assertion would pass on a rule that only works in round
    // one. Every round of a full night has to hold.
    const roster = eightWithCs("a", "f");
    const { matches } = runNight(roster, 3);
    for (const m of matches) {
      const cs = tiersOf(roster, m);
      if (cs.length < 2) continue;
      expect(m.teamA.filter((id) => cs.includes(id))).toHaveLength(1);
      expect(m.teamB.filter((id) => cs.includes(id))).toHaveLength(1);
    }
  });

  it("LEAST PLAYED WINS when the only other C is a game further on", () => {
    // The deliberate limit. Reaching past the played band to fetch a
    // counterpart would put someone a game ahead of a player who has been
    // waiting longer, and the spec makes that impossible by design. So the
    // lone C plays, and the reason says so instead of pretending otherwise.
    seq = 0;
    const roster = eightWithCs("a", "e");
    const ms = [played(["e", "f", "g", "h"])];
    const m = nextMatch(roster, ms, 1, 4)!;
    expect([...m.teamA, ...m.teamB].sort()).toEqual(["a", "b", "c", "d"]);
    expect(m.reason.balance.kind).toBe("loneC");
    expect(m.reason.balance.swap).toBeNull();
  });

  it("a court with ONE C overall still plays them, every round", () => {
    // The documented choice, stated as a test. Deferring the lone C would mean
    // the rule written to protect the newest player is the thing keeping them
    // off court, and with no second C anywhere it would repeat all night.
    const roster = eightWithCs("a");
    const { matches, counts } = runNight(roster, 3);
    expect(matches).toHaveLength(6);
    // Three games, exactly like everyone else. Not deferred, not short-changed.
    expect(counts).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
    const first = nextMatch(roster, [], 1, 3)!;
    expect([...first.teamA, ...first.teamB]).toContain("a");
    expect(first.reason.balance.kind).toBe("loneC");
  });

  it("an ALL-UNASSESSED court is untouched by any of this", () => {
    // Most real courts carry no chips at all, so the balance rule has to be
    // invisible there: same four, same 1+4 / 2+3 pairing, same six matches.
    const roster = eight();
    const m = nextMatch(roster, [], 1, 3)!;
    expect(m.teamA).toEqual(["a", "d"]);
    expect(m.teamB).toEqual(["b", "c"]);
    expect(m.reason.balance.kind).toBe("noAssessedC");
    expect(m.reason.balance.cPlayers).toEqual([]);
    const { matches, counts } = runNight(roster, 3);
    expect(matches).toHaveLength(6);
    expect(counts).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
  });
});

describe("played counts never drift more than one game apart", () => {
  it("holds after EVERY match of a full eight-player, six-match night", () => {
    // The spec's hardest promise, and the failure it replaced: on an earlier
    // test night one player reached three games while another sat on one. The
    // balance rule is the change most likely to bring that back, so the check
    // runs on a court that exercises it.
    const roster = eightWithCs("a", "f");
    const { matches, spreads, counts } = runNight(roster, 3);
    expect(matches).toHaveLength(6);
    expect(counts).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
    expect(Math.max(...spreads)).toBeLessThanOrEqual(1);
  });

  it("holds on courts whose size does not halve cleanly", () => {
    // Six players draw four at a time out of a room that never splits evenly,
    // which is where an off-by-one in the substitution would show. Two Cs here,
    // so the court is relaxed and nothing forces a bloc.
    const roster = Array.from({ length: 6 }, (_, i) =>
      P(`p${i}`, i % 4 === 0 ? { tier: "C" } : {}));
    const { spreads, counts } = runNight(roster, 4);
    expect(Math.max(...spreads)).toBeLessThanOrEqual(1);
    expect(counts.every((c) => c === 4)).toBe(true);
  });

  it("EXACTLY THREE Cs makes the designated B play more games than anyone", () => {
    // Not a bug, and not something to quietly round off. The only legal C
    // shapes are four Cs or three Cs plus the one designated B. With exactly
    // three Cs the first shape is impossible, so every single C match needs
    // that B, and they keep being called back after they have had their own
    // games. Somebody has to absorb it: either the B plays extra, or the Cs
    // finish short of the target they were promised. The B is the volunteer
    // bridge, so the B absorbs it.
    //
    // The setup screen should say this out loud the way it says the
    // fewer-than-three-Cs case, and it does not yet.
    const roster = Array.from({ length: 10 }, (_, i) =>
      P(`p${i}`, i % 4 === 0 ? { tier: "C" } : {}));
    const { counts } = runNight(roster, 4);
    // Nobody falls short. That is the promise being kept.
    expect(counts.every((c) => c >= 4)).toBe(true);
    // And the overshoot is small and lands on the bridge, not on a newcomer.
    expect(Math.max(...counts)).toBeLessThanOrEqual(5);
  });
});

describe("the court can explain itself", () => {
  it("hands frame 11 the four names, in queue order, with their counts", () => {
    // The screen must never re-derive this. Two places computing "who is on
    // and why" is two places to disagree in front of a player who asked.
    seq = 0;
    const roster = eight();
    const ms = [played(["a", "b", "c", "d"])];
    const m = nextMatch(roster, ms, 1, 3)!;
    expect(m.reason.leastPlayed.map((p) => p.playerId)).toEqual(["e", "f", "g", "h"]);
    expect(m.reason.leastPlayed.map((p) => p.name)).toEqual(["E", "F", "G", "H"]);
    expect(m.reason.leastPlayed.every((p) => p.matchesPlayed === 0)).toBe(true);
    expect(m.reason.courtSpread).toBe(1);
    expect(m.reason.withinOneGame).toBe(true);
  });

  it("names the C players and the side each is on", () => {
    // Frame 11's second card is "Chizea is C-tier, so Abiola is across the net
    // rather than alongside", which needs both names and both sides.
    const roster = eightWithCs("a", "f");
    const m = nextMatch(roster, [], 1, 4)!;
    const cs = m.reason.balance.cPlayers;
    expect(cs.map((c) => c.playerId).sort()).toEqual(["a", "f"]);
    expect(new Set(cs.map((c) => c.side)).size).toBe(2);
  });

  it("describes a match it did not choose without flattering it", () => {
    // explainMatch also runs on matches already on court, including any a
    // future hand-swap screen rearranges. Reporting two Cs as partners is the
    // honest answer there; calling it balanced would be a lie in the
    // operator's own voice.
    const roster = eightWithCs("a", "b");
    const r = explainMatch(roster, [], 1, ["a", "b"], ["c", "d"]);
    expect(r.balance.kind).toBe("alongside");
    expect(r.balance.swap).toBeNull();
  });

  it("reports a spread of zero for an empty court rather than -Infinity", () => {
    // Math.max on an empty list is -Infinity, and this number is printed.
    const r = explainMatch([], [], 9, ["a", "b"], ["c", "d"]);
    expect(r.courtSpread).toBe(0);
    expect(r.withinOneGame).toBe(true);
  });
});

describe("targets have to divide the room", () => {
  it("only offers targets where every game has four players", () => {
    expect(validTargets(8)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(validTargets(9)).toEqual([4, 8]);
    expect(validTargets(10)).toEqual([2, 4, 6, 8]);
    expect(validTargets(6)).toEqual([2, 4, 6, 8]);
  });

  it("every offered target yields a whole number of matches", () => {
    for (const size of [4, 6, 8, 9, 10, 11, 12, 16]) {
      for (const t of validTargets(size)) {
        expect(Number.isInteger(totalMatches(size, t))).toBe(true);
      }
    }
  });
});

describe("a court is complete when everyone has had their games", () => {
  it("is false while anyone is short, true when nobody is", () => {
    seq = 0;
    const ms = [played(["a", "b", "c", "d"])];
    expect(courtComplete(eight(), ms, 1, 1)).toBe(false);
    const all = [...ms, played(["e", "f", "g", "h"])];
    expect(courtComplete(eight(), all, 1, 1)).toBe(true);
  });

  it("an empty court is not 'complete', it has not started", () => {
    expect(courtComplete([], [], 1, 4)).toBe(false);
  });
});

describe("partners rotate every round", () => {
  // Found on a live production walk: a court of four re-sorts to seat order
  // after every match, so the house split dealt the IDENTICAL teams three
  // times while the Ready screen promised rotation. The variety preference
  // ranks below fairness and the laws, so it can never cost anyone a game.
  it("a court of four at target three plays three distinct pairings", () => {
    const roster = ["a", "b", "c", "d"].map((id) => P(id));
    const ms: Match[] = [];
    const seen = new Set<string>();
    for (let n = 0; n < 3; n++) {
      const m = nextMatch(roster, ms, 1, 3)!;
      seen.add([...m.teamA].sort().join("+"));
      ms.push({ id: `v${n}`, courtNumber: 1, matchIndex: n + 1,
        teamA: m.teamA, teamB: m.teamB, scoreA: 7, scoreB: 5,
        status: "played", startedAt: n, completedAt: n, stage: null });
    }
    expect(seen.size).toBe(3);
  });

  it("variety never outranks fairness: the least played still go on", () => {
    // Six players. After two matches the two who sat out are most owed, and
    // they go on even though it repeats nothing and proves nothing about
    // variety: the point is the ordering of the ranking keys.
    const roster = ["a", "b", "c", "d", "e", "f"].map((id) => P(id));
    const ms: Match[] = [];
    const m1 = nextMatch(roster, ms, 1, 3)!;
    ms.push({ id: "x1", courtNumber: 1, matchIndex: 1, teamA: m1.teamA, teamB: m1.teamB,
      scoreA: 7, scoreB: 5, status: "played", startedAt: 1, completedAt: 1, stage: null });
    const m2 = nextMatch(roster, ms, 1, 3)!;
    const rested = roster.map((p) => p.id)
      .filter((id) => ![...m1.teamA, ...m1.teamB].includes(id));
    for (const id of rested) expect([...m2.teamA, ...m2.teamB]).toContain(id);
  });
});


describe("the same four do not come round again", () => {
  const fourOf = (m: Match) => [...m.teamA, ...m.teamB].sort().join(",");
  const shapeOf = (roster: readonly Player[], m: Match) =>
    [m.teamA, m.teamB].map((side) =>
      side.map((id) => roster.find((p) => p.id === id)?.tier ?? "B").sort().join("")).join("v");

  it("eight on one court at three each: every four is a different four", () => {
    const { matches, counts } = runNight(eight(), 3);
    expect(counts.every((c) => c === 3)).toBe(true);
    const fours = matches.map(fourOf);
    expect(new Set(fours).size).toBe(fours.length);
  });

  it("last Wednesday's roster, twelve A's and eight B's on one court at three each", () => {
    // The night the owner watched: the first four were the fifteenth four,
    // and three games ran an A and a B against two B's. Neither may happen.
    const roster: Player[] = [
      ...["benson", "tamilore", "david", "folarin", "timi", "ade", "chibuike", "elvis", "fiyin", "sam", "abiola", "martins"]
        .map((x) => P(x, { tier: "A" })),
      ...["albright", "evelyn", "ese", "idara", "goanaer", "kai", "olu", "khalid"].map((x) => P(x, { tier: "B" })),
    ];
    const { matches, counts } = runNight(roster, 3);
    expect(matches).toHaveLength(15);
    expect(counts.every((c) => c === 3)).toBe(true);
    const fours = matches.map(fourOf);
    expect(new Set(fours).size).toBe(fours.length);
    for (const m of matches) expect(["AAvAA", "ABvAB", "BBvBB"]).toContain(shapeOf(roster, m));
    // And nobody shares a court with the same person more than twice.
    const met = new Map<string, number>();
    for (const m of matches) {
      const ids = [...m.teamA, ...m.teamB];
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const k = [ids[i], ids[j]].sort().join("+");
        met.set(k, (met.get(k) ?? 0) + 1);
      }
    }
    expect(Math.max(...met.values())).toBeLessThanOrEqual(2);
  });

  it("a lone A on a court of B's still plays, in the relaxed shape", () => {
    const roster: Player[] = [P("a1", { tier: "A" }), ...["b1", "b2", "b3", "b4", "b5", "b6", "b7"].map((x) => P(x, { tier: "B" }))];
    const { counts } = runNight(roster, 3);
    expect(counts.every((c) => c === 3)).toBe(true);
  });

  it("a lone B on a court of A's plays too, rather than the A's playing forever without them", () => {
    // Found by the review's fuzz: with one B, "a B on each side" cannot be
    // made, so the B never played and the court kept dealing A's past the
    // target. The law falls silent on a court that cannot mix lawfully.
    const roster: Player[] = [...["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map((x) => P(x, { tier: "A" })), P("b1", { tier: "B" })];
    const { matches, counts } = runNight(roster, 3);
    expect(matches).toHaveLength(6);
    expect(counts.every((c) => c === 3)).toBe(true);
  });

  it("three A's and five B's: the odd A out plays with the B's rather than anyone playing twice while somebody waits", () => {
    const roster: Player[] = [...["a1", "a2", "a3"].map((x) => P(x, { tier: "A" })), ...["b1", "b2", "b3", "b4", "b5"].map((x) => P(x, { tier: "B" }))];
    // Three A's cannot pair off, so one game in three has an A among B's,
    // and the spread touches two for a game on the way; what matters is that
    // the night ends in six games with everyone on three.
    const { matches, counts, spreads } = runNight(roster, 3);
    expect(matches).toHaveLength(6);
    expect(counts.every((c) => c === 3)).toBe(true);
    expect(Math.max(...spreads)).toBeLessThanOrEqual(2);
  });
});


/** The night the owner watched: twelve A's and eight B's on one court. */
const wednesday = (): Player[] => [
  ...["benson", "tamilore", "david", "folarin", "timi", "ade", "chibuike", "elvis", "fiyin", "sam", "abiola", "martins"]
    .map((x) => P(x, { tier: "A" })),
  ...["albright", "evelyn", "ese", "idara", "goanaer", "kai", "olu", "khalid"].map((x) => P(x, { tier: "B" })),
];

/**
 * The same night with somebody arriving or leaving partway through, and the
 * seats the change leaves over. Both the walk-in block and the cap block
 * below replay it, because a card that grew mid-night is where the cap is
 * hardest to keep.
 */
const runWith = (roster: Player[], target: number, at: number, change: (r: Player[]) => Player[]) => {
  let players = roster;
  const matches: Match[] = [];
  const spreads: number[] = [];
  let seatsOwedAtChange = 0;
  for (let guard = 0; guard < 40; guard++) {
    if (matches.length === at - 1) {
      players = change(players);
      seatsOwedAtChange = players.filter((p) => !p.away)
        .reduce((sum, p) => sum + Math.max(0, target - matchesPlayedBy(matches, p.id)), 0);
    }
    const next = nextMatch(players, matches, 1, target);
    if (!next) break;
    matches.push({
      id: `sim${matches.length}`, courtNumber: 1, matchIndex: matches.length + 1,
      teamA: next.teamA, teamB: next.teamB,
      scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
    });
    const counts = players.filter((p) => !p.away).map((p) => matchesPlayedBy(matches, p.id));
    spreads.push(Math.max(...counts) - Math.min(...counts));
  }
  // Seats a game cannot fill exactly become one extra game for somebody.
  const extraSeats = (4 - (seatsOwedAtChange % 4)) % 4;
  return { players, matches, spreads, extraSeats, counts: players.filter((p) => !p.away).map((p) => matchesPlayedBy(matches, p.id)) };
};

describe("a walk-in or a leaver on the Wednesday roster", () => {
  it("a B walking in before game nine finishes on three with everyone else, nobody on four", () => {
    const r = runWith(wednesday(), 3, 9, (ps) => [...ps, P("late", { tier: "B", walkIn: true, joinedAtMatchIndex: 9 })]);
    // Twenty-one on three each is sixty-three seats, and a game seats four,
    // so exactly one person plays a fourth: nobody short, one over.
    expect(r.counts.every((c) => c >= 3)).toBe(true);
    expect(r.counts.filter((c) => c > 3)).toHaveLength(r.extraSeats);
    // The night is not perfectly even at the moment the walk-in arrives on
    // zero; from then on nobody is ever more than one game behind.
    expect(Math.max(...r.spreads.slice(9))).toBeLessThanOrEqual(1);
  });

  it("a B leaving before game six leaves everyone else on three", () => {
    const r = runWith(wednesday(), 3, 6, (ps) => ps.map((p) => p.id === "ese" ? { ...p, away: true } : p));
    // The leaver had one game; the seats still owed are fifty-seven minus
    // what was played, and whatever four does not divide is one extra game
    // for somebody. Nobody short, at most one over, never two behind.
    expect(r.counts.every((c) => c >= 3)).toBe(true);
    expect(r.counts.filter((c) => c > 3)).toHaveLength(r.extraSeats);
    expect(Math.max(...r.spreads)).toBeLessThanOrEqual(1);
  });
});


describe("an A has one game with the B's, and never a second", () => {
  // The club's rule, in the owner's words: whether the night is three games,
  // four or five, an A never gets more than one B game. A "B game" for an A
  // is any game with a B in it. Found on the Wednesday of 2026-09-09, where
  // the picker spread the mixed games around but nothing capped them, so an
  // A could be dealt a second, and on eight A's and eight B's every A was.
  const roster = (as: number, bs: number, cs = 0): Player[] => [
    ...Array.from({ length: as }, (_, i) => P(`a${i + 1}`, { tier: "A" })),
    ...Array.from({ length: bs }, (_, i) => P(`b${i + 1}`, { tier: "B" })),
    ...Array.from({ length: cs }, (_, i) => P(`c${i + 1}`, { tier: "C" })),
  ];
  const isMixed = (r: readonly Player[], m: Match) => {
    const tiers = [...m.teamA, ...m.teamB].map((id) => r.find((p) => p.id === id)?.tier ?? "B");
    return tiers.includes("A") && tiers.includes("B");
  };
  const bGamesOf = (r: readonly Player[], ms: readonly Match[], id: string) =>
    ms.filter((m) => isMixed(r, m) && [...m.teamA, ...m.teamB].includes(id)).length;
  const worstA = (r: readonly Player[], ms: readonly Match[]) =>
    Math.max(...r.filter((p) => p.tier === "A").map((p) => bGamesOf(r, ms, p.id)));

  it("last Wednesday's roster at three, four and five games each", () => {
    for (const target of [3, 4, 5]) {
      const r = [
        ...["benson", "tamilore", "david", "folarin", "timi", "ade", "chibuike", "elvis", "fiyin", "sam", "abiola", "martins"]
          .map((x) => P(x, { tier: "A" })),
        ...["albright", "evelyn", "ese", "idara", "goanaer", "kai", "olu", "khalid"].map((x) => P(x, { tier: "B" })),
      ];
      const { matches, counts } = runNight(r, target);
      expect(matches).toHaveLength(totalMatches(20, target));
      expect(counts.every((c) => c === target)).toBe(true);
      expect(worstA(r, matches)).toBeLessThanOrEqual(1);
    }
  });

  it("eight A's and eight B's at three each: nobody's second B game", () => {
    const r = roster(8, 8);
    const { matches, counts } = runNight(r, 3);
    expect(matches).toHaveLength(12);
    expect(counts.every((c) => c === 3)).toBe(true);
    expect(worstA(r, matches)).toBeLessThanOrEqual(1);
  });

  it("six A's and six B's at four each, where the A's were dealt three and four B games", () => {
    const r = roster(6, 6);
    const { matches, counts } = runNight(r, 4);
    expect(matches).toHaveLength(12);
    expect(counts.every((c) => c === 4)).toBe(true);
    expect(worstA(r, matches)).toBeLessThanOrEqual(1);
  });

  it("holds on every court of four or more A's and four or more B's, at three each", () => {
    // Four of a tier is what it takes to field that tier's own game, and from
    // there the seats always work out: the A's play each other and at most
    // one game in the night has to cross over. The engine has to find it.
    for (let as = 4; as <= 10; as++) {
      for (let bs = 4; bs <= 10; bs++) {
        if (!validTargets(as + bs).includes(3)) continue;
        const r = roster(as, bs);
        const { matches, counts } = runNight(r, 3);
        expect(matches, `${as}A/${bs}B`).toHaveLength(totalMatches(as + bs, 3));
        expect(counts.every((c) => c === 3), `${as}A/${bs}B`).toBe(true);
        expect(worstA(r, matches), `${as}A/${bs}B`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("seven A's and one lone B at three: two A's meet the B twice, never one A three times", () => {
    // The free law, where the cap cannot hold. A lone B on a court of seven
    // A's plays three games and every one of them is three A's against the
    // B, so nine A-seats go over seven A's and two seconds are forced. They
    // are spread: one A taking a second and a third costs one plus two,
    // where two A's taking a second each costs one plus one.
    const r = roster(7, 1);
    const { matches, counts } = runNight(r, 3);
    expect(matches).toHaveLength(6);
    expect(counts.every((c) => c === 3)).toBe(true);
    expect(worstA(r, matches)).toBeLessThanOrEqual(2);
    const charged = r.filter((p) => p.tier === "A" && bGamesOf(r, matches, p.id) > 1);
    expect(charged).toHaveLength(2);
  });

  it("six A's and two B's at four: the two second games land on two DIFFERENT A's", () => {
    // The same spreading, on the night the brief names. Eight A-seats are
    // needed across the net and there are six A's, so two seconds are
    // forced. One A taking both would be the cheap-looking answer for a
    // picker that only counts games; it is the dear one for the club.
    const r = roster(6, 2);
    const { matches, counts } = runNight(r, 4);
    expect(counts.every((c) => c === 4)).toBe(true);
    const charged = r.filter((p) => p.tier === "A" && bGamesOf(r, matches, p.id) > 1);
    expect(charged).toHaveLength(2);
    expect(charged.map((p) => bGamesOf(r, matches, p.id))).toEqual([2, 2]);
  });

  it("last Wednesday at three: every B gets their game with the A's, and nobody meets anybody three times", () => {
    // The B side of the rule. A cap read as "mix as little as possible"
    // would keep the A's among themselves all night and leave the B's in
    // their own corner; the club's rule is exactly one, which is what gives
    // the B's their games up. Four mixed games instead of six is also what
    // put abiola on court with martins three times, so the promise from the
    // block above is asserted here again on the same night.
    const r = wednesday();
    const { matches, counts } = runNight(r, 3);
    expect(matches).toHaveLength(15);
    expect(counts.every((c) => c === 3)).toBe(true);
    expect(worstA(r, matches)).toBeLessThanOrEqual(1);
    for (const b of r.filter((p) => p.tier === "B")) {
      expect(bGamesOf(r, matches, b.id), b.id).toBeGreaterThanOrEqual(1);
    }
    const met = new Map<string, number>();
    for (const m of matches) {
      const ids = [...m.teamA, ...m.teamB];
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const k = [ids[i], ids[j]].sort().join("+");
        met.set(k, (met.get(k) ?? 0) + 1);
      }
    }
    expect(Math.max(...met.values())).toBeLessThanOrEqual(2);
  });

  it("six A's and six B's at four: the two mixed games go to four different B's", () => {
    // The other half of "exactly one where the seats allow". Twelve games,
    // two of them mixed, and the B seats in them could all fall to the same
    // two B's. Spreading them is what the mixing preference is for.
    const r = roster(6, 6);
    const { matches } = runNight(r, 4);
    const mixed = matches.filter((m) => isMixed(r, m));
    expect(mixed).toHaveLength(2);
    const bs = mixed.flatMap((m) => [...m.teamA, ...m.teamB]).filter((id) => id.startsWith("b"));
    expect(bs).toHaveLength(4);
    expect(new Set(bs).size).toBe(4);
  });

  it("with beginners on the court too, the cap still holds", () => {
    // Three C's take the one designated B into every C game, which flips
    // what the A's and B's have left over and over. The A's meet the B's
    // one at a time in those nights rather than two at a time, and a picker
    // that assumed at most one such game read these courts as hopeless and
    // dealt needless seconds. The start state of all three is clean, so
    // nothing here may be charged.
    for (const [as, bs, cs, target] of [[4, 4, 3, 4], [5, 4, 3, 2], [5, 4, 3, 3]] as const) {
      const label = `${as}A/${bs}B/${cs}C T${target}`;
      const r = roster(as, bs, cs);
      const { matches, counts } = runNight(r, target);
      expect(matches, label).toHaveLength(totalMatches(as + bs + cs, target));
      expect(counts.every((c) => c === target), label).toBe(true);
      expect(worstA(r, matches), label).toBeLessThanOrEqual(1);
    }
  });

  it("an A walking in before game nine has their one game with the B's and no more", () => {
    // The card grows for a walk-in, so the seats no longer divide by four
    // and the oracle is looking at a night it cannot finish exactly. The
    // slack seat is what keeps the cap on: without it every four after the
    // walk-in prices the same and the rule is quietly off for the rest of
    // the night.
    const r = runWith(wednesday(), 3, 9, (ps) => [...ps, P("late", { tier: "A", walkIn: true, joinedAtMatchIndex: 9 })]);
    expect(r.counts.every((c) => c >= 3)).toBe(true);
    expect(r.counts.filter((c) => c > 3)).toHaveLength(r.extraSeats);
    expect(Math.max(...r.spreads.slice(9))).toBeLessThanOrEqual(1);
    expect(worstA(r.players, r.matches)).toBeLessThanOrEqual(1);
  });

  it("a B walking in before game nine costs no A a second game", () => {
    // The same night from the other side: one more B to give games to, and
    // the A's who have already had theirs stay out of it.
    const r = runWith(wednesday(), 3, 9, (ps) => [...ps, P("late", { tier: "B", walkIn: true, joinedAtMatchIndex: 9 })]);
    expect(r.counts.every((c) => c >= 3)).toBe(true);
    expect(r.counts.filter((c) => c > 3)).toHaveLength(r.extraSeats);
    expect(Math.max(...r.spreads.slice(9))).toBeLessThanOrEqual(1);
    expect(worstA(r.players, r.matches)).toBeLessThanOrEqual(1);
  });

  it("that late B plays only B's, and the night never offers them an A", () => {
    // The consequence nobody is on screen to explain to the late arrival, so
    // it is pinned here and in the tiers.ts header rather than left to be
    // discovered. By game nine all twelve A's have spent their one ticket,
    // the cap walls every one of them off, and the three games the night
    // still owes this B are three games among B's. The rule holds, the night
    // finishes on target, and this is what it costs.
    const r = runWith(wednesday(), 3, 9, (ps) => [...ps, P("late", { tier: "B", walkIn: true, joinedAtMatchIndex: 9 })]);
    const theirs = r.matches.filter((m) => [...m.teamA, ...m.teamB].includes("late"));
    expect(theirs).toHaveLength(3);
    expect(theirs.some((m) => isMixed(r.players, m))).toBe(false);
  });

  it("an A leaving before game six takes their ticket with them", () => {
    // Eleven A's and eight B's from game six on. The cap holds, and it is
    // paid for once: at game ten a least-played player waits a game because
    // the four ahead of them would have charged an A. That is the one thing
    // the rule is allowed to cost, and the spread touches two, never three.
    const r = runWith(wednesday(), 3, 6, (ps) => ps.map((p) => (p.id === "abiola" ? { ...p, away: true } : p)));
    expect(r.counts.every((c) => c >= 3)).toBe(true);
    expect(r.counts.filter((c) => c > 3)).toHaveLength(r.extraSeats);
    expect(Math.max(...r.spreads)).toBeLessThanOrEqual(2);
    expect(worstA(r.players, r.matches)).toBeLessThanOrEqual(1);
  });

  it("a B leaving before game six leaves the cap where it was", () => {
    // The leaver had one game. Seven B's and twelve A's finish the night,
    // the spread never leaves one, and no A meets the B's twice.
    const r = runWith(wednesday(), 3, 6, (ps) => ps.map((p) => (p.id === "ese" ? { ...p, away: true } : p)));
    expect(r.counts.every((c) => c >= 3)).toBe(true);
    expect(r.counts.filter((c) => c > 3)).toHaveLength(r.extraSeats);
    expect(Math.max(...r.spreads)).toBeLessThanOrEqual(1);
    expect(worstA(r.players, r.matches)).toBeLessThanOrEqual(1);
  });

  it("the exactly-three-C's roster still gives the bridge no more than it had", () => {
    // The bridge already plays a game more than anyone, because every C
    // game needs them. The cap must not add to that: it is a rule about the
    // A's, and this court has none. Ten players, every fourth one a C, at
    // four each. The bridge finishes on five, no C is short, and the number
    // the setup screen quotes is unchanged.
    const r = Array.from({ length: 10 }, (_, i) =>
      P(`p${i}`, i % 4 === 0 ? { tier: "C" } : {}));
    const { matches, counts } = runNight(r, 4);
    expect(counts.every((c) => c >= 4)).toBe(true);
    expect(Math.max(...counts)).toBeLessThanOrEqual(5);
    const bridge = designateB(r, 1)!;
    expect(matchesPlayedBy(matches, bridge)).toBe(5);
    for (const c of r.filter((p) => p.tier === "C")) {
      expect(matchesPlayedBy(matches, c.id), c.id).toBe(4);
    }
  });

  it("a change mid-night on a court with beginners still costs no A a second game", () => {
    // The nights the cap came off on, found by sweeping walk-ins and
    // leavers over every court the room can field (2026-09-11). All three
    // hold C's, and that is the point: a C game seats one B, which turns
    // the B parity over and is what lets the A's meet the B's one at a
    // time. The oracle counted those turns off the padded card, where the
    // slack seats a walk-in leaves are owed games rather than spare ones,
    // so it promised a finish the live court could not deal and the picker
    // walked into it. Priced off the owed totals, all three finish clean.
    const cases = [
      { r: roster(6, 3, 3), target: 5, at: 5, change: "an A walks in" as const },
      { r: roster(5, 4, 3), target: 4, at: 5, change: "a B leaves" as const },
      { r: roster(9, 4, 3), target: 4, at: 7, change: "a B leaves" as const },
    ];
    for (const { r, target, at, change } of cases) {
      const label = `${r.length} players T${target}, ${change} before game ${at}`;
      const run = runWith(r, target, at, (ps) => (change === "an A walks in"
        ? [...ps, P("late", { tier: "A", walkIn: true, joinedAtMatchIndex: at })]
        : ps.map((p) => (p.id === "b1" ? { ...p, away: true } : p))));
      // Nobody short, and the games past the target add up to exactly the
      // seats the card could not divide into fours. Who takes them is the
      // picker's own business and older than this rule: on the first of
      // these all three land on one player.
      const over = run.counts.reduce((n, c) => n + (c - target), 0);
      expect(run.counts.every((c) => c >= target), `${label}: ${run.counts.join(",")}`).toBe(true);
      expect(over, `${label}: ${run.counts.join(",")}`).toBe(run.extraSeats);
      expect(worstA(run.players, run.matches), label).toBeLessThanOrEqual(1);
    }
  });

  it("two changes in one night stack the overshoot on the B's, and nobody finishes short", () => {
    // Pinned rather than fixed (2026-09-11). Five A's, four B's and three
    // C's at four each. A leaver after game two and a B walking in after
    // game nine are each harmless alone: over this roster every single
    // change lands at a spread of two or less, and a fresh night on it is
    // level at zero. Together they run the card to fifteen games where
    // twelve would do, and the overshoot goes on the B's. A court of three
    // C's has one legal C shape, three C's and one B, so every game the
    // C's still owe drafts a B, and slotCount grows the card to the rows
    // spent plus the most anybody is owed. A court whose only owed players
    // are B's and C's therefore keeps drawing the same bridge. Ten of this
    // roster's ninety-one two-change scenarios do it, no other roster
    // exceeds a spread of two under any change or pair, and the cap itself
    // is not what bends: the A's here are on their one game with the B's.
    //
    // The lever is the card rather than the cap, and reaching into the
    // picker this late to buy a spread of two here would put every night
    // above it at risk. So what the night actually promises is guarded
    // instead: nobody finishes short, the second change costs no A a game
    // with the B's the seats were not already forcing, and the overshoot
    // sits where it sat when it was measured rather than growing quietly.
    const base = roster(5, 4, 3);
    let players = base;
    const matches: Match[] = [];
    for (let guard = 0; guard < 40; guard++) {
      if (matches.length === 2) players = players.map((p) => (p.id === "b1" ? { ...p, away: true } : p));
      if (matches.length === 9) players = [...players, P("late", { tier: "B", walkIn: true, joinedAtMatchIndex: 9 })];
      const next = nextMatch(players, matches, 1, 4);
      if (!next) break;
      matches.push({
        id: `two${matches.length}`, courtNumber: 1, matchIndex: matches.length + 1,
        teamA: next.teamA, teamB: next.teamB,
        scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
      });
    }
    const live = players.filter((p) => !p.away);
    const counts = live.map((p) => matchesPlayedBy(matches, p.id));
    // The promise. Everyone who is still here plays their four.
    expect(counts.every((c) => c >= 4), counts.join(",")).toBe(true);
    // Not a cap failure. Two is the bound the seats on this roster already
    // force under single changes, and the pair does not go past it.
    expect(worstA(live, matches)).toBeLessThanOrEqual(2);
    // And the overshoot, where it lands and how far it goes. Measured at
    // four on 2026-09-11, on a B: the bound is here so that a later change
    // to the card cannot widen it without somebody reading this comment.
    const spread = Math.max(...counts) - Math.min(...counts);
    expect(spread, counts.join(",")).toBeLessThanOrEqual(4);
    const most = live[counts.indexOf(Math.max(...counts))];
    expect(most.tier).toBe("B");
  });

  it("the cap costs nobody a game: the night still ends with everyone on target", () => {
    // Where the rule cannot be kept at all, it bends rather than the night
    // breaking: six A's and two B's at four each need eight A seats across the
    // net from the B's and there are only six A's to give them, so two A's
    // meet the B's twice and everybody still finishes on four.
    const r = roster(6, 2);
    const { matches, counts } = runNight(r, 4);
    expect(matches).toHaveLength(8);
    expect(counts.every((c) => c === 4)).toBe(true);
    expect(worstA(r, matches)).toBeLessThanOrEqual(2);
  });
});

describe("a court of five plays five games, not six", () => {
  // Found by the cap's own sweep on 2026-09-11, and older than the cap: the
  // same two nights deal the same six games at d524422, before the third law
  // existed. Five players at four each is twenty seats and five games, one
  // player sitting out each. The engine dealt six, the two of the smaller
  // tier finishing on six games while the three finished on four.
  //
  // The cause is the mixing law read off parity alone. Two A's and three B's
  // owe eight A seats and twelve B seats; both totals are even at every draw,
  // so the law reads strict and every game is an A and a B against an A and a
  // B. That shape spends two A seats a game, so the A's are spent after four
  // games while the B's still owe four seats, and the card has to seat an A
  // past their target to field a fifth. Parity is necessary for a strict
  // night and not sufficient: with fewer than four of a tier that tier can
  // never field a pure game, so every seat it owes has to come out of a mixed
  // one, and strict only works when the two tiers owe the same number.
  //
  // The night that does fit is three strict games and two of an A among three
  // B's: eight A seats and twelve B seats, five games, everyone on four.
  const fives = (nA: number, nB: number): Player[] => [
    ...Array.from({ length: nA }, (_, i) => P(`a${i + 1}`, { tier: "A" })),
    ...Array.from({ length: nB }, (_, i) => P(`b${i + 1}`, { tier: "B" })),
  ];

  it("two A's and three B's at four each, and the same the other way round", () => {
    for (const [nA, nB] of [[2, 3], [3, 2]] as const) {
      const players = fives(nA, nB);
      const { matches, counts } = runNight(players, 4);
      expect(matches, `${nA}A/${nB}B`).toHaveLength(totalMatches(5, 4));
      expect(counts, `${nA}A/${nB}B`).toEqual([4, 4, 4, 4, 4]);
    }
  });

  it("every court of five the room can field finishes on its target", () => {
    // The two above are the ones that broke, but nothing about five players
    // is special to those splits, so the whole row is asserted.
    for (let nA = 0; nA <= 5; nA++) {
      const nB = 5 - nA;
      const players = fives(nA, nB);
      for (const target of validTargets(5)) {
        if (target > 5) continue;
        const { matches, counts } = runNight(players, target);
        const label = `${nA}A/${nB}B T${target}`;
        expect(matches, label).toHaveLength(totalMatches(5, target));
        expect(counts.every((c) => c === target), label).toBe(true);
      }
    }
  });
});

describe("a change mid-night, on the courts the laws are tightest on", () => {
  // The fixed rosters above are the case the free rung of the mixing law
  // never reaches: a fixed roster owes N times its target and drops by four
  // a game, so its seats are a multiple of four all night and some law can
  // always finish them. A walk-in, a leaver and an extended target leave
  // seats no law can finish, and on 2026-09-11 the ladder answered "free"
  // there, which judge() read as no shape rule at all. The wide version of
  // this lives in mixing-sweep.test.ts behind MANAGE_SWEEP, over 5,224
  // nights; these are the courts of five and six it found, kept here so
  // they run on every commit.
  const court = (nA: number, nB: number): Player[] => [
    ...Array.from({ length: nA }, (_, i) => P(`a${i + 1}`, { tier: "A" })),
    ...Array.from({ length: nB }, (_, i) => P(`b${i + 1}`, { tier: "B" })),
  ];

  it("never deals a side without a B, whatever the seats owed do", () => {
    // The shape the first law exists to prevent, two A's standing against
    // two B's, dealt 441 times over the sweep when free meant no rule and
    // never once before the rung existed. Judged here under the FREE law,
    // the loosest the engine can apply: free adds the lone B among A's and
    // adds nothing else, so a game that fails this is a game with a side
    // holding no B while two B's are on court.
    let games = 0;
    for (let nA = 1; nA <= 5; nA++) {
      for (const target of [3, 4]) {
        for (const at of [2, 3, 4]) {
          for (const tier of ["A", "B"] as const) {
            const base = court(nA, 6 - nA);
            for (const change of [
              (ps: Player[]) => [...ps, P("late", { tier, walkIn: true, joinedAtMatchIndex: at })],
              (ps: Player[]) => ps.map((p) => (p.id === (tier === "A" ? "a1" : "b1") ? { ...p, away: true } : p)),
            ]) {
              const r = runWith(base, target, at, change);
              // Tiers off the whole roster rather than the court, so a
              // leaver in a game dealt before they left still reads as the
              // tier they played as. A court's own context answers B for
              // anybody off it, which would call their old games hunts.
              const tiers = new Map(r.players.map((p) => [p.id, tierOf(p)]));
              const ctx = { ...lawContextFor(r.players, 1),
                            tierById: (id: string) => tiers.get(id) ?? "B",
                            abLaw: "free" as const };
              for (const m of r.matches) {
                const label = `${nA}A/${6 - nA}B T${target} ${tier}@${at}: `
                  + `${m.teamA.join("+")} v ${m.teamB.join("+")}`;
                expect(judge({ teamA: m.teamA, teamB: m.teamB }, ctx), label).toBeNull();
                games++;
              }
            }
          }
        }
      }
    }
    expect(games).toBeGreaterThan(200);
  });

  it("a third A onto the court of five still finishes six games with everyone on four", () => {
    // Two A's and three B's at four each, an A walking in before game
    // three. The night that fits is six games with all six on four, which
    // is what this dealt at d1aa383 and what it deals now. Between them it
    // dealt NINE, the three B's on eight games each against a target of
    // four: the card opened with an A among three B's, which spends B seats
    // three at a time, so by the time the third A arrived the B's were
    // spent and nothing re-planned. The shape was dealt first because the
    // oracle priced every card that kept the club's own shape at Infinity,
    // and Infinity ranks above fairness (2026-09-11).
    const r = runWith(court(2, 3), 4, 3,
      (ps) => [...ps, P("late", { tier: "A", walkIn: true, joinedAtMatchIndex: 3 })]);
    expect(r.matches, r.counts.join(",")).toHaveLength(6);
    expect(r.counts).toEqual([4, 4, 4, 4, 4, 4]);
    // A game later the same walk-in is owed four games with three games'
    // worth of seats left on the card, and nobody plays twice in one game,
    // so four games is the fewest the night can take. Seven in all, nobody
    // short, nobody more than one game over: the same night as d1aa383.
    const later = runWith(court(2, 3), 4, 4,
      (ps) => [...ps, P("late", { tier: "A", walkIn: true, joinedAtMatchIndex: 4 })]);
    expect(later.matches, later.counts.join(",")).toHaveLength(7);
    expect(later.counts.every((c) => c >= 4 && c <= 5), later.counts.join(",")).toBe(true);
  });

  it("and the law it runs under is the one its seats can be finished under", () => {
    // The ladder, read the way a draw reads it, on a court of three and
    // three. Eight seats each are four games of an A and a B against an A
    // and a B, so the club's rule holds; five against three needs the lone
    // B among A's twice, which only the free law deals; and two seats
    // against two is one strict game again.
    expect(lawForOwedSeats(8, 8, 3, 3)).toBe("strict");
    expect(lawForOwedSeats(5, 3, 3, 3)).toBe("free");
    expect(lawForOwedSeats(2, 2, 3, 3)).toBe("strict");
    // And a card no law can finish keeps the law the parity reading gave
    // it, never free: one seat owed each way is the walk-in's residue, and
    // free there is what dealt two A's against two B's.
    expect(lawForOwedSeats(1, 1, 3, 3)).toBe("soft");
  });
});
