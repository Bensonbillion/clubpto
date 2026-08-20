// The two balance laws.
//
// These are the promises the club makes to the people at either end of the
// room, so every test below names the person who gets hurt when it breaks.

import { describe, expect, it } from "vitest";
import type { Player } from "../../types";
import {
  canFieldACMatch, chooseFour, designateB, isLegal, judge, tierOf,
  type LawContext, type Lineup, type Tier,
} from "../tiers";

const P = (id: string, tier?: Tier, court = 1): Player => ({
  id, name: id, walkIn: false, courtNumber: court, away: false,
  joinedAtMatchIndex: null, ...(tier ? { tier } : {}),
});

const ctxOf = (tiers: Record<string, Tier>, over: Partial<LawContext> = {}): LawContext => ({
  tierById: (id) => tiers[id] ?? "B",
  designatedB: null,
  relaxed: false,
  cCount: Object.values(tiers).filter((t) => t === "C").length,
  ...over,
});

const lineup = (a1: string, a2: string, b1: string, b2: string): Lineup =>
  ({ teamA: [a1, a2], teamB: [b1, b2] });

describe("unassessed counts as B", () => {
  it("a player with no tier is a B, not a fourth category", () => {
    // Several hundred roster players have never been assessed. Whatever they
    // default to is a guess made at scale, and B is the only tier with no
    // restriction, so it is the least damaging wrong guess.
    expect(tierOf(P("x"))).toBe("B");
    expect(tierOf(P("x", "A"))).toBe("A");
  });

  it("so an unassessed player may share a match with anyone", () => {
    const ctx = ctxOf({ a: "A" });
    expect(isLegal(lineup("a", "u1", "u2", "u3"), ctx)).toBe(true);
  });
});

describe("law two: the wall between A and C", () => {
  it("an A is never in a match with a C", () => {
    // This is the promise to the newest player in the room, and it is the one
    // rule with no exception anywhere.
    const ctx = ctxOf({ a: "A", c1: "C", c2: "C", c3: "C" });
    expect(judge(lineup("a", "c1", "c2", "c3"), ctx)).toBe("aWithC");
  });

  it("the wall holds even when the court has run out of legal C shapes", () => {
    // relaxed loosens the shape rules so two C's can play among the B's. It
    // must never loosen this one.
    const ctx = ctxOf({ a: "A", c1: "C", c2: "C" }, { relaxed: true });
    expect(judge(lineup("a", "c1", "c2", "b"), ctx)).toBe("aWithC");
  });
});

describe("law two: the only two legal C shapes", () => {
  it("four C's is legal", () => {
    const ctx = ctxOf({ c1: "C", c2: "C", c3: "C", c4: "C" });
    expect(judge(lineup("c1", "c2", "c3", "c4"), ctx)).toBeNull();
  });

  it("three C's plus the designated B is legal", () => {
    const ctx = ctxOf({ c1: "C", c2: "C", c3: "C", kayode: "B" }, { designatedB: "kayode" });
    expect(judge(lineup("c1", "kayode", "c2", "c3"), ctx)).toBeNull();
  });

  it("two C's and two B's is NOT legal, because it stops being a C match", () => {
    const ctx = ctxOf({ c1: "C", c2: "C", b1: "B", b2: "B" });
    expect(judge(lineup("c1", "b1", "c2", "b2"), ctx)).toBe("tooManyBInCMatch");
  });

  it("a C match must have a C on each team, not two beginners against two minders", () => {
    // The shape the rule exists to prevent: a side made entirely of stronger
    // players facing a side made entirely of newcomers.
    const ctx = ctxOf({ b1: "B", b2: "B", c1: "C", c2: "C" }, { designatedB: "b1" });
    expect(judge(lineup("b1", "b2", "c1", "c2"), ctx)).toBe("cNotOnEachTeam");
  });

  it("three C's and a B is legal however the four are arranged", () => {
    // Worth pinning: with three C's there is no split that leaves a team
    // without one, so the C-on-each-team rule can never bite this shape and a
    // reader should not go looking for the case where it does.
    const ctx = ctxOf({ c1: "C", c2: "C", c3: "C", b: "B" }, { designatedB: "b" });
    expect(judge(lineup("c1", "c2", "c3", "b"), ctx)).toBeNull();
    expect(judge(lineup("c1", "b", "c2", "c3"), ctx)).toBeNull();
  });

  it("a B who is not the designated one cannot ride with the group", () => {
    // The C's are promised ONE consistent stronger face all night, not a
    // rotating cast of them.
    const ctx = ctxOf({ c1: "C", c2: "C", c3: "C", other: "B" }, { designatedB: "kayode" });
    expect(judge(lineup("c1", "other", "c2", "c3"), ctx)).toBe("notTheDesignatedB");
  });
});

describe("law one: no lone B among A's", () => {
  it("three A's and one B is not allowed", () => {
    // The B is the only weaker player on court, so the game becomes three
    // people hunting them.
    const ctx = ctxOf({ a1: "A", a2: "A", a3: "A", b: "B" });
    expect(judge(lineup("a1", "a2", "a3", "b"), ctx)).toBe("bNotOnEachTeam");
  });

  it("two A's and two B's is allowed when the B's are split", () => {
    const ctx = ctxOf({ a1: "A", a2: "A", b1: "B", b2: "B" });
    expect(judge(lineup("a1", "b1", "a2", "b2"), ctx)).toBeNull();
  });

  it("but not when both B's are on the same side", () => {
    const ctx = ctxOf({ a1: "A", a2: "A", b1: "B", b2: "B" });
    expect(judge(lineup("a1", "a2", "b1", "b2"), ctx)).toBe("bNotOnEachTeam");
  });

  it("four A's is fine, because no B is present to be hunted", () => {
    const ctx = ctxOf({ a1: "A", a2: "A", a3: "A", a4: "A" });
    expect(judge(lineup("a1", "a2", "a3", "a4"), ctx)).toBeNull();
  });
});

describe("fewer than three C's", () => {
  it("cannot field a legal C match", () => {
    expect(canFieldACMatch(["C", "C", "B", "B", "A"])).toBe(false);
    expect(canFieldACMatch(["C", "C", "C", "B"])).toBe(true);
  });

  it("relaxed lets two C's play among the B's, still walled off from A", () => {
    const ctx = ctxOf({ c1: "C", c2: "C", b1: "B", b2: "B" }, { relaxed: true });
    expect(judge(lineup("c1", "b1", "c2", "b2"), ctx)).toBeNull();
  });
});

describe("the designated B is stable all night", () => {
  it("is the same answer regardless of games played, because it reads seat order", () => {
    const roster = [P("c1", "C"), P("kayode", "B"), P("c2", "C"), P("other", "B"), P("c3", "C")];
    expect(designateB(roster, 1)).toBe("kayode");
    // Nothing about a night in progress can change it.
    expect(designateB([...roster].map((p) => ({ ...p })), 1)).toBe("kayode");
  });

  it("is null on a court with no C, because nobody needs riding with", () => {
    expect(designateB([P("a", "A"), P("b", "B")], 1)).toBeNull();
  });

  it("is null when a C court has no B to spare, leaving four C's the only shape", () => {
    expect(designateB([P("c1", "C"), P("c2", "C"), P("c3", "C"), P("c4", "C")], 1)).toBeNull();
  });
});

describe("choosing the four", () => {
  it("takes the head of the queue when the head is already legal", () => {
    const ctx = ctxOf({});
    const got = chooseFour(["p1", "p2", "p3", "p4", "p5"], ctx)!;
    expect(got.positions).toEqual([0, 1, 2, 3]);
  });

  it("reaches past an illegal head rather than fielding it", () => {
    // Queue head is three A's and a B, which law one forbids. The fifth player
    // is a B, so pulling them in is the least-played legal answer.
    const ctx = ctxOf({ p1: "A", p2: "A", p3: "A", p4: "B", p5: "B" });
    const got = chooseFour(["p1", "p2", "p3", "p4", "p5"], ctx)!;
    const ids = [...got.lineup.teamA, ...got.lineup.teamB];
    expect(ids).toContain("p5");
    expect(isLegal(got.lineup, ctx)).toBe(true);
  });

  it("never returns an illegal lineup, so it returns nothing instead", () => {
    // One C and three A's on a court: no legal match exists at all. Handing
    // back a wrong answer would put the C in a game with three A's.
    const ctx = ctxOf({ c: "C", a1: "A", a2: "A", a3: "A" });
    expect(chooseFour(["c", "a1", "a2", "a3"], ctx)).toBeNull();
  });

  it("prefers the lower total queue position among legal options", () => {
    const ctx = ctxOf({});
    const got = chooseFour(["p1", "p2", "p3", "p4", "p5", "p6"], ctx)!;
    expect(got.positions.reduce((a, b) => a + b, 0)).toBe(6);
  });
});

describe("the big night: 16 A, 4 B, 10 C", () => {
  // Frame 31. The C court is 4 B and 10 C, and the A court is all A.
  const tiers: Record<string, Tier> = {};
  const cCourt: string[] = [];
  for (let i = 1; i <= 10; i++) { tiers[`c${i}`] = "C"; cCourt.push(`c${i}`); }
  for (let i = 1; i <= 4; i++) { tiers[`b${i}`] = "B"; cCourt.push(`b${i}`); }

  it("fields only legal C shapes on the beginners' court", () => {
    const ctx = ctxOf(tiers, { designatedB: "b1" });
    const got = chooseFour(cCourt, ctx)!;
    expect(isLegal(got.lineup, ctx)).toBe(true);
    const all = [...got.lineup.teamA, ...got.lineup.teamB];
    const bs = all.filter((id) => tiers[id] === "B");
    // Four C's, or three C's and exactly the designated B.
    expect(bs.length === 0 || (bs.length === 1 && bs[0] === "b1")).toBe(true);
  });

  it("puts no A on that court's matches, whatever the queue looks like", () => {
    const withStray: Record<string, Tier> = { ...tiers, a1: "A" };
    const ctx = ctxOf(withStray, { designatedB: "b1" });
    const got = chooseFour(["a1", ...cCourt], ctx)!;
    const all = [...got.lineup.teamA, ...got.lineup.teamB];
    const hasC = all.some((id) => withStray[id] === "C");
    const hasA = all.some((id) => withStray[id] === "A");
    expect(hasC && hasA).toBe(false);
  });

  it("the all-A court just plays, because law one is silent without a B", () => {
    const aOnly: Record<string, Tier> = {};
    const ids: string[] = [];
    for (let i = 1; i <= 16; i++) { aOnly[`a${i}`] = "A"; ids.push(`a${i}`); }
    const ctx = ctxOf(aOnly);
    const got = chooseFour(ids, ctx)!;
    expect(got.positions).toEqual([0, 1, 2, 3]);
  });
});
