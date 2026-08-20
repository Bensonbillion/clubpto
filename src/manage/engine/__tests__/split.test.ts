// The suggested split. It follows the counts, and the frames pin two nights.

import { describe, expect, it } from "vitest";
import type { Player } from "../../types";
import { suggestSplit, suggestTarget } from "../split";
import type { Tier } from "../tiers";

let n = 0;
const P = (tier?: Tier): Player => ({
  id: `p${++n}`, name: `p${n}`, walkIn: false, courtNumber: null, away: false,
  joinedAtMatchIndex: null, ...(tier ? { tier } : {}),
});
const many = (count: number, tier?: Tier) => Array.from({ length: count }, () => P(tier));

const courtsOf = (players: Player[], courtCount: number) => {
  const s = suggestSplit(players, courtCount);
  const byCourt = new Map<number, Player[]>();
  for (const p of players) {
    const c = s.assignment.get(p.id)!;
    byCourt.set(c, [...(byCourt.get(c) ?? []), p]);
  }
  return { s, byCourt };
};

describe("frame A07: the typical sixteen", () => {
  it("puts A and B together and gives C their own court", () => {
    // One A, two C's, the rest unassessed (which counts as B).
    n = 0;
    const players = [P("A"), P("C"), P("C"), ...many(13)];
    const { s, byCourt } = courtsOf(players, 2);
    const c2 = byCourt.get(2)!.map((p) => p.tier ?? "B");
    expect(c2).toContain("C");
    expect(c2).not.toContain("A");
    expect(byCourt.get(1)!.length + byCourt.get(2)!.length).toBe(16);
    // Two C's is below the floor, and the note says so before the night starts.
    expect(s.notes.some((x) => x.kind === "tooFewCs")).toBe(true);
  });
});

describe("frame B31: the big night, 16 A, 4 B, 10 C", () => {
  it("splits all-A against B-with-C, sixteen against fourteen", () => {
    n = 0;
    const players = [...many(16, "A"), ...many(4, "B"), ...many(10, "C")];
    const { s, byCourt } = courtsOf(players, 2);
    const tiers = (c: number) => byCourt.get(c)!.map((p) => p.tier);
    // Court 1 is all A. Court 2 is the B's bridging the C's.
    expect(tiers(1).every((t) => t === "A")).toBe(true);
    expect(byCourt.get(1)!.length).toBe(16);
    expect(byCourt.get(2)!.length).toBe(14);
    expect(tiers(2).filter((t) => t === "B")).toHaveLength(4);
    expect(tiers(2).filter((t) => t === "C")).toHaveLength(10);
    // And the targets are per court: 16 divides at 3, 14 only at 4.
    expect(s.targets.get(1)).toBe(3);
    expect(s.targets.get(2)).toBe(4);
  });
});

describe("the wall survives the suggestion", () => {
  it("never proposes a court holding both an A and a C, at any mix", () => {
    // A suggestion that starts the night illegal is not a suggestion.
    for (const [a, b, c] of [[5, 5, 6], [1, 1, 14], [10, 0, 6], [3, 9, 4]]) {
      n = 0;
      const players = [...many(a, "A"), ...many(b, "B"), ...many(c, "C")];
      const { byCourt } = courtsOf(players, 2);
      for (const group of byCourt.values()) {
        const tiers = group.map((p) => p.tier ?? "B");
        expect(tiers.includes("A") && tiers.includes("C")).toBe(false);
      }
    }
  });
});

describe("nights without the full spread", () => {
  it("no C at all: an even split, no notes about C", () => {
    n = 0;
    const players = [...many(6, "A"), ...many(10, "B")];
    const { s, byCourt } = courtsOf(players, 2);
    expect(byCourt.get(1)!.length).toBe(8);
    expect(byCourt.get(2)!.length).toBe(8);
    expect(s.notes).toHaveLength(0);
  });

  it("exactly three C's: the note names the court whose B will play extra", () => {
    // The open decision, surfaced at setup instead of discovered at nine: with
    // three C's every C match needs the designated B, who plays beyond their
    // own target. The operator hears it before the night starts.
    n = 0;
    const players = [...many(8, "B"), ...many(3, "C"), ...many(5, "A")];
    const { s } = courtsOf(players, 2);
    const note = s.notes.find((x) => x.kind === "exactlyThreeCs");
    expect(note).toBeDefined();
  });

  it("one court: everyone lands on it and the laws do the rest per match", () => {
    n = 0;
    const players = [...many(4, "A"), ...many(4, "B"), ...many(4, "C")];
    const { byCourt } = courtsOf(players, 1);
    expect(byCourt.get(1)!.length).toBe(12);
  });

  it("a court too small to run is named, not silently produced", () => {
    n = 0;
    const players = [...many(4, "A"), P("C"), P("C"), P("C")];
    const { s } = courtsOf(players, 2);
    // Three C's alone on court 2 cannot make a match of four.
    expect(s.notes.some((x) => x.kind === "courtTooSmall")).toBe(true);
  });
});

describe("suggestTarget makes whole matches", () => {
  it("prefers three each, falls back to four", () => {
    expect(suggestTarget(16)).toBe(3);  // 16 x 3 / 4 = 12 matches
    expect(suggestTarget(14)).toBe(4);  // 14 x 3 does not divide; x 4 = 14
    expect(suggestTarget(8)).toBe(3);
    expect(suggestTarget(10)).toBe(4);
  });

  it("refuses a court that cannot field a match", () => {
    expect(suggestTarget(3)).toBeNull();
  });
});
