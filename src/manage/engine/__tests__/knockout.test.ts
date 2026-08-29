// The knockout branch (frames 30 to 33). Sunday's Playoff door.

import { describe, expect, it } from "vitest";
import type { KnockoutPair, Match } from "../../types";
import {
  buildKnockoutStages, buildPlateStages, knockoutShape, orphanKnockoutMatchIds,
  planKnockoutDispatch, playableTies,
} from "../knockout";
import { winnerOf } from "../playoff";

const draw = (n: number): KnockoutPair[] =>
  Array.from({ length: n }, (_, i) => ({ seed: i + 1, playerIds: [`a${i + 1}`, `b${i + 1}`] }));

let idn = 0;
const settled = (teamA: [string, string], teamB: [string, string], stage: Match["stage"],
  scoreA: number, scoreB: number, walkover?: "A" | "B"): Match => ({
  id: `m${++idn}`, courtNumber: 1, matchIndex: idn, teamA, teamB,
  scoreA: walkover ? null : scoreA, scoreB: walkover ? null : scoreB,
  status: "played", startedAt: 1, completedAt: idn, stage,
  ...(walkover ? { walkover } : {}),
});

describe("the shape of the draw", () => {
  it("seven pairs: a bye for the top pair, three play-ins, then semifinals", () => {
    // Frame 32's own night.
    const stages = buildKnockoutStages(draw(7), []);
    expect(stages.map((s) => s.key)).toEqual(["playIn", "semi", "final"]);
    expect(stages[0].ties).toHaveLength(3);
    // Crossing is top against bottom inside the block: 2v7, 3v6, 4v5.
    expect(stages[0].ties.map((t) => [t.sideA!.seeds[0], t.sideB!.seeds[0]]))
      .toEqual([[2, 7], [3, 6], [4, 5]]);
    // The top pair holds the bye straight into the semifinals.
    expect(stages[1].ties[0].sideA!.seeds).toEqual([1]);
    expect(knockoutShape(7)).toBe("A bye for the top pair, three play-ins, then semifinals.");
  });

  it("eight pairs go straight to quarterfinals, and nothing is called a play-in", () => {
    const stages = buildKnockoutStages(draw(8), []);
    expect(stages.map((s) => s.key)).toEqual(["quarter", "semi", "final"]);
    expect(stages[0].label).toBe("Quarterfinals");
    expect(knockoutShape(8)).toBe("Everyone starts together: quarterfinals, nobody waits.");
  });

  it("two pairs is the final, straight away", () => {
    const stages = buildKnockoutStages(draw(2), []);
    expect(stages.map((s) => s.key)).toEqual(["final"]);
    expect(knockoutShape(2)).toBe("The final, straight away.");
  });

  it("five pairs: byes for the top three, one play-in", () => {
    expect(knockoutShape(5)).toBe("Byes for the top three pairs, one play-in, then semifinals.");
    const stages = buildKnockoutStages(draw(5), []);
    expect(stages[0].ties).toHaveLength(1);
    expect(stages[0].label).toBe("Play-in");
  });
});

describe("dispatch: one draw feeds every court", () => {
  it("hands back playable ties in draw order, as many as there are free courts", () => {
    const stages = buildKnockoutStages(draw(7), []);
    const ties = playableTies(stages);
    // Only the play-ins are playable: the semis wait on their winners.
    expect(ties.map((t) => t.id)).toEqual(["playIn-1", "playIn-2", "playIn-3"]);
  });

  it("a walkover advances the named side without any numbers", () => {
    const pairs = draw(2);
    const m = settled(["a1", "b1"], ["a2", "b2"], "final", 0, 0, "A");
    const stages = buildKnockoutStages(pairs, [m]);
    const final = stages[0].ties[0];
    expect(final.settled).toBe(true);
    expect(winnerOf(final)!.seeds).toEqual([1]);
  });
});

describe("the plate", () => {
  it("forms only once every round-one tie is settled, over the losers in draw order", () => {
    const pairs = draw(7);
    // Play-ins: 2v7, 3v6, 4v5. Two settled is not enough.
    const two = [
      settled(["a2", "b2"], ["a7", "b7"], "playIn", 7, 3),
      settled(["a3", "b3"], ["a6", "b6"], "playIn", 7, 4),
    ];
    expect(buildPlateStages(pairs, two)).toBeNull();
    const all = [...two, settled(["a4", "b4"], ["a5", "b5"], "playIn", 2, 7)];
    const plate = buildPlateStages(pairs, all)!;
    // Losers 7, 6, 4 in draw order: 4, 6, 7. Three sides: a plate play-in
    // between the bottom two, then the plate final against the top loser.
    expect(plate.map((s) => s.key)).toEqual(["platePlayIn", "plateFinal"]);
    expect(plate[0].ties[0].sideA!.seeds).toEqual([6]);
    expect(plate[0].ties[0].sideB!.seeds).toEqual([7]);
    expect(plate[1].ties[0].sideA!.seeds).toEqual([4]);
  });
});

describe("the shapes the review asked to see pinned", () => {
  it("three pairs: a play-in, then the final against the bye", () => {
    const stages = buildKnockoutStages(draw(3), []);
    expect(stages.map((st) => st.key)).toEqual(["playIn", "final"]);
    expect(stages[0].ties[0].sideA!.seeds).toEqual([2]);
    expect(stages[0].ties[0].sideB!.seeds).toEqual([3]);
    expect(stages[1].ties[0].sideA!.seeds).toEqual([1]);
    expect(knockoutShape(3)).toBe("A bye for the top pair, one play-in, then the final.");
  });

  it("six and nine pairs read their shapes plainly", () => {
    expect(knockoutShape(6)).toBe("Byes for the top two pairs, two play-ins, then semifinals.");
    expect(knockoutShape(9)).toBe("Byes for the top seven pairs, one play-in, then quarterfinals.");
  });

  it("past sixteen pairs the engine refuses rather than truncating", () => {
    expect(knockoutShape(17)).toBeNull();
    expect(buildKnockoutStages(draw(17), [])).toEqual([]);
  });

  it("a walkover in the plate advances the named side", () => {
    const pairs = draw(7);
    const roundOne = [
      settled(["a2", "b2"], ["a7", "b7"], "playIn", 7, 3),
      settled(["a3", "b3"], ["a6", "b6"], "playIn", 7, 4),
      settled(["a4", "b4"], ["a5", "b5"], "playIn", 2, 7),
    ];
    // Plate over losers 4, 6, 7: plate play-in is 6 v 7 and 7 walks it over.
    const plateWalkover = settled(["a6", "b6"], ["a7", "b7"], "platePlayIn", 0, 0, "B");
    const plate = buildPlateStages(pairs, [...roundOne, plateWalkover])!;
    const final = plate.find((st) => st.key === "plateFinal")!.ties[0];
    expect(final.sideB!.seeds).toEqual([7]);
  });

  it("the plate still forms when round one settled by walkover, and the walked-over pair enters it", () => {
    const pairs = draw(7);
    const roundOne = [
      settled(["a2", "b2"], ["a7", "b7"], "playIn", 0, 0, "A"),
      settled(["a3", "b3"], ["a6", "b6"], "playIn", 7, 4),
      settled(["a4", "b4"], ["a5", "b5"], "playIn", 7, 5),
    ];
    const plate = buildPlateStages(pairs, roundOne)!;
    const enteredSeeds = plate.flatMap((st) => st.ties.flatMap((t) =>
      [t.sideA, t.sideB].filter(Boolean).map((x) => x!.seeds[0])));
    expect(enteredSeeds).toContain(7);
  });

  it("dispatch: two free courts take ties one and two, a live tie leaves the queue", () => {
    const pairs = draw(7);
    const plan = planKnockoutDispatch(pairs, [], [1, 2], false);
    expect(plan.map((p) => [p.courtNumber, p.tie.id])).toEqual([[1, "playIn-1"], [2, "playIn-2"]]);
    // With the first play-in live on court 1, the next free court gets tie 2.
    const live: Match = { ...settled(["a2", "b2"], ["a7", "b7"], "playIn", 0, 0), status: "onCourt", scoreA: null, scoreB: null };
    const plan2 = planKnockoutDispatch(pairs, [live], [1, 2], false);
    expect(plan2.map((p) => [p.courtNumber, p.tie.id])).toEqual([[2, "playIn-2"]]);
  });

  it("a corrected feeder orphans the match dealt from it, and the orphan is named", () => {
    const pairs = draw(2);
    // No feeder here, so use 3 pairs: play-in settles, the final is dealt,
    // then the play-in is voided. The final's match no longer binds.
    const p3 = draw(3);
    const playIn = settled(["a2", "b2"], ["a3", "b3"], "playIn", 7, 4);
    const finalDealt: Match = { ...settled(["a1", "b1"], ["a2", "b2"], "final", 0, 0), status: "onCourt", scoreA: null, scoreB: null };
    const voided = { ...playIn, status: "voided" as const };
    expect(orphanKnockoutMatchIds(p3, [voided, finalDealt], false)).toEqual([finalDealt.id]);
    void pairs;
  });
});
