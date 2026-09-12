// The balance laws.
//
// These are the promises the club makes to the people at either end of the
// room, so every test below names the person who gets hurt when it breaks.

import { describe, expect, it } from "vitest";
import type { Player } from "../../types";
import {
  abLawFor, canFieldACMatch, chooseFour, designateB, isLegal, judge, lawForOwedSeats,
  seatsFinishable, tierOf, type LawContext, type Lineup, type Tier,
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
    // One A on a court of unassessed players: the mixing law relaxes to a B
    // on each team, and the A plays among them rather than sitting all night.
    const ctx = ctxOf({ a: "A" }, { abLaw: "free" });
    expect(isLegal(lineup("a", "u1", "u2", "u3"), ctx)).toBe(true);
  });
});

describe("law one: the same make-up on each side", () => {
  it("an A and a B against an A and a B is the mixed shape", () => {
    const ctx = ctxOf({ a1: "A", a2: "A", b1: "B", b2: "B" });
    expect(judge(lineup("a1", "b1", "a2", "b2"), ctx)).toBeNull();
  });

  it("an A and a B against two B's is not, even though each team has a B", () => {
    // The club's own words: it is either B B B B or A B A B. Found on a
    // Wednesday with twelve A's and eight B's on one court, where three of
    // fifteen games ran this shape.
    const ctx = ctxOf({ a1: "A", b1: "B", b2: "B", b3: "B" });
    expect(judge(lineup("a1", "b1", "b2", "b3"), ctx)).toBe("sidesUnequal");
  });

  it("two A's against an A and a B is not either", () => {
    const ctx = ctxOf({ a1: "A", a2: "A", a3: "A", b1: "B" });
    expect(judge(lineup("a1", "b1", "a2", "a3"), ctx)).toBe("bNotOnEachTeam");
    expect(judge(lineup("a1", "a2", "a3", "b1"), ctx)).toBe("bNotOnEachTeam");
  });

  it("holds strict only when the A's and the B's can both pair off", () => {
    expect(abLawFor(["A", "A", "B", "B"])).toBe("strict");
    expect(abLawFor(["A", "A", "A", "A", "B", "B"])).toBe("strict");
    expect(abLawFor(["A", "A", "A", "B", "B"])).toBe("soft");
    expect(abLawFor(["A", "A", "B", "B", "B"])).toBe("soft");
    expect(abLawFor(["A", "B", "B", "B"])).toBe("free");
    expect(abLawFor(["A", "A", "A", "B"])).toBe("free");
    expect(abLawFor(["A", "A", "A", "A"])).toBe("strict");
    // Soft: a B on each side, so the odd A out can play with the B's.
    const soft = ctxOf({ a1: "A", b1: "B", b2: "B", b3: "B" }, { abLaw: "soft" });
    expect(judge(lineup("a1", "b1", "b2", "b3"), soft)).toBeNull();
    expect(judge(lineup("a1", "b1", "b2", "b3"), ctxOf({ a1: "A", b1: "B", b2: "B", b3: "B" }))).toBe("sidesUnequal");
    // Free: anything goes for the one who has nobody of their kind to pair with.
    const free = ctxOf({ a1: "A", b1: "B", b2: "B", b3: "B" }, { abLaw: "free" });
    expect(judge(lineup("a1", "b1", "b2", "b3"), free)).toBeNull();
  });
});

describe("the law the seats can still be finished under", () => {
  // lawForOwedSeats, which is what lawfulFour holds a court to draw by draw.
  // Every case names the night it comes from. The numbers are (A seats owed,
  // B seats owed, A's on court, B's on court).

  it("holds the club's rule wherever the night can be dealt out strict", () => {
    // Eight of each at four each: sixteen games, and every one of them can be
    // an A and a B against an A and a B.
    expect(lawForOwedSeats(32, 32, 8, 8)).toBe("strict");
    // Six A's and two B's at four each, the court the third law bends on.
    // Four mixed games and four pure A games still deal it out strict.
    expect(lawForOwedSeats(24, 8, 6, 2)).toBe("strict");
    // A court with nothing left owed is finished, and finished strict.
    expect(lawForOwedSeats(0, 0, 4, 4)).toBe("strict");
  });

  it("an odd total is the old parity case, and soft is what absorbs it", () => {
    // Nothing strict spends an odd number of either tier's seats, so an odd
    // total was never strict and still is not. Seven A seats and nine B ones
    // go out as one A among three B's, one strict game, and a pure game at
    // each end.
    expect(lawForOwedSeats(7, 9, 4, 4)).toBe("soft");
    expect(lawForOwedSeats(8, 9, 4, 4)).not.toBe("strict");
  });

  it("two A's and three B's at four each is even all night and not strict", () => {
    // The night that overshot (2026-09-11). Eight A seats and twelve B ones,
    // both even, and neither tier can field a pure game: four strict games
    // spend the A's while the B's still owe four, and the card had to deal a
    // sixth game. Three strict games and two of one A among three B's fit.
    expect(lawForOwedSeats(8, 12, 2, 3)).toBe("soft");
  });

  it("three A's and two B's is the mirror, and soft cannot deal it", () => {
    // With two B's every game that keeps a B on each side is an A and a B
    // against an A and a B, so soft is strict here and overshoots the same
    // way. The night that fits is three strict games and two of one B among
    // three A's, which only the free law allows.
    expect(lawForOwedSeats(12, 8, 3, 2)).toBe("free");
  });

  it("a tier of three can never field its own pure game", () => {
    // Four A seats among three A's and twelve B seats among three B's. Strict
    // wants a pure game at both ends and there are not four of either tier to
    // fill one, so the four A seats go out one at a time among the B's.
    expect(lawForOwedSeats(4, 12, 3, 3)).toBe("soft");
    // The same seats with eight of each on the court are strict again.
    expect(lawForOwedSeats(4, 12, 8, 8)).toBe("strict");
  });

  it("keeps the law a card nothing can finish already had", () => {
    // Two A seats and four B ones is six seats, and games come in fours, so
    // no rung of the ladder deals this out exactly. It is a walk-in's, a
    // leaver's or an extended target's card, which is to say most of a real
    // Wednesday. Free used to be the answer here, and free was read as no
    // rule at all: those cards then dealt two A's against two B's, the game
    // law one exists to prevent, 135 times over a sweep of 1,206 mid-night
    // courts. The floor is the parity reading the ladder replaced, so a
    // card nothing can finish keeps the law it had rather than losing it.
    expect(lawForOwedSeats(2, 4, 4, 4)).toBe("strict");
    expect(seatsFinishable(2, 4, 4, 4)).toBe(false);
    // An odd total floors to soft the same way, which is where parity had it.
    expect(lawForOwedSeats(3, 4, 4, 4)).toBe("soft");
    // And a card the ladder CAN finish is not floored at all: the court of
    // five that started this, eight A seats against twelve B ones.
    expect(seatsFinishable(8, 12, 2, 3)).toBe(true);
    expect(lawForOwedSeats(8, 12, 2, 3)).toBe("soft");
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

  it("and the free law does not license it: two A's against two B's is hunting too", () => {
    // The law says two separate things, and free only loosens one of them.
    // Which SHAPES a night may deal is what free adds to: a lone B among
    // A's, the one four that cannot put a B on each side. How a four is
    // ARRANGED is the same sentence under every law. Read as "free means no
    // rule", free dealt two A's against two B's, and mid-night courts reach
    // free the moment a walk-in leaves seats no law can finish (2026-09-11).
    const ctx = ctxOf({ a1: "A", a2: "A", b1: "B", b2: "B" }, { abLaw: "free" });
    expect(judge(lineup("a1", "a2", "b1", "b2"), ctx)).toBe("bNotOnEachTeam");
    expect(judge(lineup("a1", "b1", "a2", "b2"), ctx)).toBeNull();
    // What free is FOR still works: the lone B among three A's, and the
    // lone A among three B's, in any arrangement either allows.
    const loneB = ctxOf({ a1: "A", a2: "A", a3: "A", b: "B" }, { abLaw: "free" });
    expect(judge(lineup("a1", "a2", "a3", "b"), loneB)).toBeNull();
    expect(judge(lineup("a1", "b", "a2", "a3"), loneB)).toBeNull();
    // And the shape stays illegal under the two laws that do not deal it.
    const soft = ctxOf({ a1: "A", a2: "A", a3: "A", b: "B" }, { abLaw: "soft" });
    expect(judge(lineup("a1", "b", "a2", "a3"), soft)).toBe("bNotOnEachTeam");
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
