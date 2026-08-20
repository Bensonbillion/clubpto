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
  buildQueue, courtComplete, explainMatch, matchesPlayedBy, nextMatch,
  totalMatches, validTargets,
} from "../rotation";

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
