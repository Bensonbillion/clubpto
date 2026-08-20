// How a court ends, and the two things that ending must never do.
//
// The first is crowning the wrong shape. The bracket ending crowns a PAIR;
// one more round crowns a PERSON (frame 24). They are different endings and
// the module has to keep them different, because a screen that prints two
// names under "Court 1 champion" after a round rather than a bracket has
// silently invented a crossover the design refuses.
//
// The second is leaking across courts. Frame 19 promises "each court decides
// on the night, the other court is unaffected", and that promise is only worth
// anything if recording one court's choice provably leaves the other's alone.
// That is asserted directly here rather than inferred from the spread
// operator, because the day it becomes a mutation is the day the promise
// breaks with nothing failing.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../../types";
import {
  chooseEnding,
  endingFor,
  individualChampion,
  mayChooseEnding,
  oneMoreRoundChange,
  type CourtEndings,
} from "../endings";
import { readiness } from "../playoff";
import { buildQueue, courtComplete, validTargets } from "../rotation";
import { computeStandings, type PlayedMatch } from "../standings";

const P = (id: string, court: number): Player => ({
  id,
  name: id.toUpperCase(),
  walkIn: false,
  courtNumber: court,
  away: false,
  joinedAtMatchIndex: null,
});

let seq = 0;
const played = (
  court: number,
  teamA: [string, string],
  teamB: [string, string],
  scoreA = 2,
  scoreB = 0,
): Match => {
  const matchIndex = ++seq;
  return {
    id: `m${matchIndex}`,
    courtNumber: court,
    matchIndex,
    teamA,
    teamB,
    scoreA,
    scoreB,
    status: "played",
    startedAt: matchIndex,
    completedAt: matchIndex,
    stage: null,
  };
};

/**
 * The court's table, built the way the app builds it: real matches mapped into
 * standings input. Handing `individualChampion` hand written rows would let a
 * test agree with itself about an order the real table would never produce.
 */
const table = (ids: readonly string[], matches: readonly Match[]) =>
  computeStandings(
    ids,
    matches.map((m): PlayedMatch => ({
      matchIndex: m.matchIndex,
      completedAt: m.completedAt,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
    })),
  );

const courtOf = (court: number, ids: string[]) => ids.map((id) => P(id, court));

describe("a court cannot choose an ending before its targets are met", () => {
  it("refuses on a court that has played nothing, and says how much is owed", () => {
    // Frame 19 is drawn with "Targets met" in the step slot. Offering either
    // ending at 7:30 would let an operator start a bracket on a table that is
    // three matches from meaning anything.
    seq = 0;
    const r = mayChooseEnding(courtOf(1, ["a", "b", "c", "d"]), [], 1, 2);
    expect(r.mayChoose).toBe(false);
    expect(r.matchesOutstanding).toBe(8);
  });

  it("still refuses part way through, when only some scores have landed", () => {
    // The dangerous half state. One more round raises the target, so offering
    // it here would raise the target on an unfinished round robin and the
    // court would owe two more games instead of one.
    seq = 0;
    const players = courtOf(1, ["a", "b", "c", "d"]);
    const r = mayChooseEnding(players, [played(1, ["a", "b"], ["c", "d"])], 1, 2);
    expect(r.mayChoose).toBe(false);
    expect(r.matchesOutstanding).toBe(4);
  });

  it("opens the instant the last score lands", () => {
    // The spec is exact about this: "the table is final the moment the last
    // score lands." Nothing else has to happen first, no button, no review.
    seq = 0;
    const players = courtOf(1, ["a", "b", "c", "d"]);
    const r = mayChooseEnding(players, [played(1, ["a", "b"], ["c", "d"])], 1, 1);
    expect(r.mayChoose).toBe(true);
    expect(r.matchesOutstanding).toBe(0);
  });

  it("opens at exactly the same moment the bracket does, never one match apart", () => {
    // Two copies of "targets met" drift. If this one opened first, frame 19
    // would offer one more round while the playoff still said "not ready",
    // and the operator would be looking at two screens that disagree.
    seq = 0;
    const players = courtOf(1, ["a", "b", "c", "d"]);
    const history: Match[] = [];
    for (let i = 0; i <= 2; i++) {
      expect(mayChooseEnding(players, history, 1, 2).mayChoose).toBe(
        readiness(players, history, 1, 2).ready,
      );
      history.push(played(1, ["a", "b"], ["c", "d"]));
    }
  });
});

describe("one more round offers the smallest add that keeps the schedule whole", () => {
  it("adds one each on eight players, and no more", () => {
    // Eight players at target three is six matches. One more each is two
    // further matches, which is eight player games, which is one each. An add
    // of two here would read as a whole second round robin and the court
    // would still be playing at eleven.
    const change = oneMoreRoundChange(8, 3);
    expect(change.addEach).toBe(1);
    expect(change.targetMatches).toBe(4);
    expect(change.matchesAdded).toBe(2);
    expect(change.matchesAdded).toBe(8 / 4);
    expect(change.possible).toBe(true);
  });

  it("adds two each on ten players, because one each does not divide", () => {
    // The case that used to leave the card inert. Ten by five is twelve
    // matches and a half, so the old answer was possible=false and the
    // operator was told nothing. The honest offer is the next add that
    // divides: two more each, ten by six is fifteen matches, five more than
    // the ten already owed.
    const ten = oneMoreRoundChange(10, 4);
    expect(ten.possible).toBe(true);
    expect(ten.addEach).toBe(2);
    expect(ten.targetMatches).toBe(6);
    expect(ten.matchesAdded).toBe(5);
  });

  it("finds the smallest add across the awkward headcounts", () => {
    // The table the spec's arithmetic implies, pinned so the search can never
    // quietly overshoot: offering three more games each to a court that could
    // have played one more each is a forty five minute mistake on a real
    // night. Sizes divisible by four take every raise, even sizes need an
    // even raised target, and odd sizes wait for a raised target that is
    // itself a multiple of four.
    expect(oneMoreRoundChange(8, 3)).toMatchObject({ addEach: 1, targetMatches: 4, matchesAdded: 2 });
    expect(oneMoreRoundChange(10, 4)).toMatchObject({ addEach: 2, targetMatches: 6, matchesAdded: 5 });
    expect(oneMoreRoundChange(11, 4)).toMatchObject({ addEach: 4, targetMatches: 8, matchesAdded: 11 });
    expect(oneMoreRoundChange(12, 3)).toMatchObject({ addEach: 1, targetMatches: 4, matchesAdded: 3 });
  });

  it("always lands on a whole number of matches, from any target the app issues", () => {
    // The reason the add exists at all. If any size and target pair slipped
    // through with a fractional match count, one game would be owed to fewer
    // than four people and the court could never finish. Targets come from
    // validTargets and nowhere else, so those pairs are the whole input space
    // a running court can present.
    for (let size = 4; size <= 24; size++) {
      for (const target of validTargets(size)) {
        const change = oneMoreRoundChange(size, target);
        expect(change.possible).toBe(true);
        expect(change.addEach).toBeGreaterThanOrEqual(1);
        expect(change.addEach).toBeLessThanOrEqual(4);
        expect(Number.isInteger(change.matchesAdded)).toBe(true);
        expect(change.matchesAdded).toBeGreaterThan(0);
        expect((size * change.targetMatches) % 4).toBe(0);
      }
    }
  });

  it("refuses only a court too small to play at all", () => {
    // Under four players no match of any kind exists, so no add fixes it.
    // The impossible answer must also carry no raise: a caller that forgot
    // to check possible would otherwise extend a court that cannot run.
    const tiny = oneMoreRoundChange(3, 3);
    expect(tiny.possible).toBe(false);
    expect(tiny.addEach).toBe(0);
    expect(tiny.matchesAdded).toBe(0);
    expect(tiny.targetMatches).toBe(3);
  });

  it("puts every player back in the queue owed exactly one game", () => {
    // The module's claim is that the ending IS the raised number, with no
    // separate bookkeeping of who has had their extra match. If the raise
    // ever landed anywhere but the target, this queue would come back with
    // somebody owed zero and somebody owed two.
    seq = 0;
    const players = courtOf(1, ["a", "b", "c", "d"]);
    const history = [played(1, ["a", "b"], ["c", "d"])];
    expect(courtComplete(players, history, 1, 1)).toBe(true);

    const { targetMatches } = oneMoreRoundChange(4, 1);
    expect(courtComplete(players, history, 1, targetMatches)).toBe(false);
    expect(buildQueue(players, history, 1, targetMatches).map((q) => q.owed))
      .toEqual([1, 1, 1, 1]);
  });

  it("does not compound when the screen asks twice", () => {
    // Frames re-render, and a screen that reads the change on every render
    // must get the same answer every time. A version that folded the raise
    // into stored state would climb to five and then six while the operator
    // read the card.
    expect(oneMoreRoundChange(8, 3).targetMatches).toBe(4);
    expect(oneMoreRoundChange(8, 3).targetMatches).toBe(4);
    // Two rounds chosen in sequence is two games each, which is the honest
    // answer, and it is reached by raising twice rather than by one raise
    // quietly counting for more than it says.
    const twice = oneMoreRoundChange(8, oneMoreRoundChange(8, 3).targetMatches);
    expect(twice.targetMatches).toBe(5);
  });
});

describe("the individual champion is one person, off the top of the table", () => {
  // a wins the first three and loses the fourth. The pair that won the LAST
  // match is b and c, and the pair a last won alongside is a and d, and d
  // finishes bottom. Any implementation that crowns a pair rather than a row
  // therefore names somebody visibly wrong here.
  const ids = ["a", "b", "c", "d"];
  const lastMatchNotTheTitle = () => {
    seq = 0;
    return [
      played(1, ["a", "b"], ["c", "d"], 2, 0),
      played(1, ["a", "c"], ["b", "d"], 2, 0),
      played(1, ["a", "d"], ["b", "c"], 2, 1),
      played(1, ["b", "c"], ["a", "d"], 2, 0),
    ];
  };

  it("is the top of the table, not the winners of the last match", () => {
    // "Whoever tops the table is the individual champion" is the whole rule.
    // Reading the last result instead would crown b and c here, who are
    // second and third.
    const rows = table(ids, lastMatchNotTheTitle());
    const champ = individualChampion(rows)!;
    expect(champ.playerId).toBe("a");
    expect(champ.playerId).toBe(rows[0].playerId);
    expect(champ.points).toBe(9);
  });

  it("is the table AFTER the extra round, not the leader going into it", () => {
    // The whole point of one more round is that it is played. b leads on the
    // table that ended the round robin; a wins the extra match and takes the
    // title. Crowning from the table the court already had would hand the
    // trophy to b and make the last match of the night decorative.
    seq = 0;
    const roundRobin = [
      played(1, ["a", "b"], ["c", "d"], 2, 0),
      played(1, ["b", "c"], ["a", "d"], 2, 0),
      played(1, ["a", "d"], ["b", "c"], 2, 0),
    ];
    expect(individualChampion(table(ids, roundRobin))!.playerId).toBe("b");

    const change = oneMoreRoundChange(4, 3);
    expect(change.targetMatches).toBe(4);
    expect(change.matchesAdded).toBe(1);

    const withExtra = [...roundRobin, played(1, ["a", "c"], ["b", "d"], 2, 0)];
    expect(withExtra).toHaveLength(roundRobin.length + change.matchesAdded);
    expect(individualChampion(table(ids, withExtra))!.playerId).toBe("a");
  });

  it("is one person, with nowhere to put a partner", () => {
    // Frame 24 draws one name at forty six pixels. A pair champion is two ids
    // in an array, so the absence of any array in this result is the shape
    // assertion, not just the presence of a string.
    const champ = individualChampion(table(ids, lastMatchNotTheTitle()))!;
    expect(typeof champ.playerId).toBe("string");
    expect(Object.values(champ).some(Array.isArray)).toBe(false);
  });

  it("reports won-all so frame 24 can print 'won all 4' truthfully", () => {
    // The frame's stat line is "12 points · won all 4". The screen cannot
    // derive that from points alone, because points do not know how many
    // matches were played, so the flag has to be right at the source.
    seq = 0;
    const sweep = table(ids, [
      played(1, ["a", "b"], ["c", "d"], 2, 0),
      played(1, ["a", "c"], ["b", "d"], 2, 1),
      played(1, ["a", "d"], ["b", "c"], 2, 0),
    ]);
    const champ = individualChampion(sweep)!;
    expect(champ.playerId).toBe("a");
    expect(champ.wins).toBe(3);
    expect(champ.matchesPlayed).toBe(3);
    expect(champ.wonEveryMatch).toBe(true);

    // And it is false the moment somebody drops one, so the line never
    // overclaims on a champion who lost a game.
    expect(individualChampion(table(ids, lastMatchNotTheTitle()))!.wonEveryMatch)
      .toBe(false);
  });

  it("crowns nobody rather than crowning a player who never walked on", () => {
    // A court that was set up and abandoned still has a top row, every value
    // zero. Crowning it puts a name and a trophy on somebody who did not play.
    expect(individualChampion([])).toBeNull();
    expect(individualChampion(table(ids, []))).toBeNull();
  });
});

describe("a tie for the individual title never asks for a coin", () => {
  // All four finish level on points AND on score difference. Under the old
  // engine this exact state stopped the night and demanded a flip. Here the
  // table is already a total order, so the title falls out of it.
  const ids = ["early", "late", "x", "y"];
  const allLevel = () => {
    seq = 0;
    return [
      played(1, ["early", "x"], ["late", "y"], 2, 0),
      played(1, ["early", "y"], ["late", "x"], 2, 0),
      played(1, ["late", "x"], ["early", "y"], 2, 0),
      played(1, ["late", "y"], ["early", "x"], 2, 0),
    ];
  };

  it("hands the title to whoever reached the total first, with no flip to run", () => {
    // Points and difference are exhausted, so the third key decides. If it
    // did not, this call would have to return a tie, an unresolved state, or
    // a prompt, and there is nowhere on frame 24 to draw any of those.
    const rows = table(ids, allLevel());
    expect(new Set(rows.map((r) => r.points)).size).toBe(1);
    expect(new Set(rows.map((r) => r.scoreDiff)).size).toBe(1);

    const champ = individualChampion(rows)!;
    expect(champ.playerId).toBe("early");
    expect(rows[0].reachedAt).toBeLessThan(rows[1].reachedAt!);
    expect(champ.secondFromThird).toBe("reachedFirst");
  });

  it("names the same champion whichever order the night is read back in", () => {
    // Determinism is what makes "no coin" true rather than merely unprompted.
    // A champion that depends on the order rows arrive in is a coin flip that
    // nobody gets to watch.
    const forward = individualChampion(table(ids, allLevel()))!;
    const backward = individualChampion(
      table([...ids].reverse(), allLevel().reverse()),
    )!;
    expect(backward.playerId).toBe(forward.playerId);
    expect(backward.second?.playerId).toBe(forward.second?.playerId);
  });
});

describe("the runner-up line frame 24 draws", () => {
  const ids = ["a", "b", "c", "d"];

  it("names second and third and says score difference split them", () => {
    // The frame's closing sentence is "Chizea second on 9, Timi third on 9 by
    // score difference." Two of those three facts are ranks and points; the
    // third is the reason, and the screen must read it rather than guess. a
    // sweeps, so b, c and d finish level on 3 apiece and only the margins
    // separate them, which is the exact shape the frame is drawn around.
    seq = 0;
    const rows = table(ids, [
      played(1, ["a", "b"], ["c", "d"], 2, 0),
      played(1, ["a", "c"], ["b", "d"], 2, 1),
      played(1, ["a", "d"], ["b", "c"], 2, 1),
    ]);
    const champ = individualChampion(rows)!;
    expect(champ.second).toEqual({ playerId: "b", rank: 2, points: 3 });
    expect(champ.third).toEqual({ playerId: "c", rank: 3, points: 3 });
    expect(champ.second!.points).toBe(champ.third!.points);
    expect(rows[1].scoreDiff).toBeGreaterThan(rows[2].scoreDiff);
    expect(champ.secondFromThird).toBe("diff");
  });

  it("says points when points split them, so the line cannot claim otherwise", () => {
    // Guessing the reason from the numbers is the failure. A screen that
    // printed "by score difference" whenever it saw two rows adjacent would
    // be wrong here, where b on 6 is simply ahead of c on 3.
    seq = 0;
    const rows = table(ids, [
      played(1, ["a", "b"], ["c", "d"], 2, 0),
      played(1, ["a", "b"], ["c", "d"], 2, 1),
      played(1, ["a", "c"], ["b", "d"], 2, 0),
    ]);
    const champ = individualChampion(rows)!;
    expect(champ.second!.playerId).toBe("b");
    expect(champ.second!.points).toBe(6);
    expect(champ.third!.playerId).toBe("c");
    expect(champ.third!.points).toBe(3);
    expect(champ.secondFromThird).toBe("points");
  });

  it("leaves the slots empty rather than inventing a third place", () => {
    // A court short enough to have no third row must give the screen null, not
    // a repeated second or an undefined that renders as the word undefined.
    seq = 0;
    const rows = table(["a", "b"], [played(1, ["a", "x"], ["b", "y"], 2, 0)]);
    const champ = individualChampion(rows)!;
    expect(champ.playerId).toBe("a");
    expect(champ.second!.playerId).toBe("b");
    expect(champ.third).toBeNull();
    expect(champ.secondFromThird).toBeNull();
  });
});

describe("the two courts' choices are independent", () => {
  it("recording one court's choice leaves every other court's entry untouched", () => {
    // This is the module's central claim and frame 19 states it in words on
    // the card: "the other court is unaffected." Asserted directly, because a
    // future edit that writes into the map in place would satisfy every other
    // test in this file.
    const before: CourtEndings = { 1: "oneMoreRound", 3: "doublesBracket" };
    const after = chooseEnding(before, 2, "doublesBracket");
    expect(endingFor(after, 1)).toBe("oneMoreRound");
    expect(endingFor(after, 3)).toBe("doublesBracket");
    expect(endingFor(after, 2)).toBe("doublesBracket");
  });

  it("does not mutate the map it was handed", () => {
    // The screens hold the previous map while the new one renders. Mutating
    // in place would retro-decide the ending on a court whose card is still
    // on screen, and nothing would look wrong until someone read it.
    const before = Object.freeze<CourtEndings>({ 1: "undecided", 2: "undecided" });
    const after = chooseEnding(before, 1, "oneMoreRound");
    expect(endingFor(before, 1)).toBe("undecided");
    expect(after).not.toBe(before);
  });

  it("lets one court take the bracket while the other takes one more round", () => {
    // Frame 19's footer reads "Court 1 chose one more round" while Court 2 is
    // being asked. Both endings therefore coexist on the same night, and a
    // single shared ending value could not represent this state at all.
    let endings: CourtEndings = {};
    endings = chooseEnding(endings, 1, "oneMoreRound");
    endings = chooseEnding(endings, 2, "doublesBracket");
    expect(endingFor(endings, 1)).toBe("oneMoreRound");
    expect(endingFor(endings, 2)).toBe("doublesBracket");
  });

  it("survives a mis-tap and a correction on one court", () => {
    // Changing a court's mind rewrites that court and only that court. A
    // correction that reset the other court would undo a bracket that is
    // already seeded and on court.
    let endings: CourtEndings = chooseEnding({}, 1, "doublesBracket");
    endings = chooseEnding(endings, 2, "oneMoreRound");
    endings = chooseEnding(endings, 2, "doublesBracket");
    expect(endingFor(endings, 1)).toBe("doublesBracket");
    expect(endingFor(endings, 2)).toBe("doublesBracket");
  });

  it("asks readiness per court, so a court still playing does not gate the finished one", () => {
    // The two courts run the same loop at their own pace and one always
    // finishes first. If readiness were asked of the night rather than the
    // court, the faster court would sit on a settled table waiting for the
    // slower one, which is the opposite of deciding on the night.
    seq = 0;
    const players = [...courtOf(1, ["a", "b", "c", "d"]), ...courtOf(2, ["e", "f", "g", "h"])];
    const history = [played(1, ["a", "b"], ["c", "d"])];
    expect(mayChooseEnding(players, history, 1, 1).mayChoose).toBe(true);
    expect(mayChooseEnding(players, history, 2, 1).mayChoose).toBe(false);
    expect(mayChooseEnding(players, history, 2, 1).matchesOutstanding).toBe(4);
  });
});

describe("a court nobody has decided for", () => {
  it("reads as undecided rather than as missing", () => {
    // "undecided" is a value the screen can render and branch on. A missing
    // key would arrive as undefined, which either prints as undefined or gets
    // read as falsy and hides the choice on a court that has earned it.
    expect(endingFor({}, 1)).toBe("undecided");
    expect(endingFor({}, 2)).toBe("undecided");
  });

  it("stays undecided while another court decides around it", () => {
    // The decided and undecided courts have to be distinguishable at a glance
    // on the switcher. Court 2 inheriting Court 1's answer is the exact
    // failure the per-court map exists to prevent.
    const endings = chooseEnding({}, 1, "oneMoreRound");
    expect(endingFor(endings, 2)).toBe("undecided");
    expect(endingFor(endings, 1)).toBe("oneMoreRound");
  });

  it("is undecided-and-may-choose, distinct from undecided-and-may-not", () => {
    // Two courts both reading "undecided" can be in opposite states: one has
    // met its targets and is waiting on the operator, the other is still
    // playing. Collapsing them would either offer an ending too early or
    // withhold it from a court that is finished.
    seq = 0;
    const players = [...courtOf(1, ["a", "b", "c", "d"]), ...courtOf(2, ["e", "f", "g", "h"])];
    const history = [played(1, ["a", "b"], ["c", "d"])];
    const endings: CourtEndings = {};
    expect(endingFor(endings, 1)).toBe(endingFor(endings, 2));
    expect(mayChooseEnding(players, history, 1, 1).mayChoose).toBe(true);
    expect(mayChooseEnding(players, history, 2, 1).mayChoose).toBe(false);
  });
});
