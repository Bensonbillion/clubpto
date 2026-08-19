import { describe, expect, it } from "vitest";
import { nearMatches, nearMatchNotice } from "./nearMatches";

// The real roster, including the pairs that have already caused trouble.
const roster = [
  { playerId: "p-ade", displayName: "Ade" },
  { playerId: "p-adee", displayName: "Adee" },
  { playerId: "p-benson", displayName: "Benson" },
  { playerId: "p-martins", displayName: "Martins" },
  { playerId: "p-sam", displayName: "Sam" },
  { playerId: "p-samuel", displayName: "Samuel" },
  { playerId: "p-timi", displayName: "Timi" },
  { playerId: "p-timi-olaoye", displayName: "Timi Olaoye" },
];

describe("what the roster screen shows before it creates anybody", () => {
  it("flags an exact name that already exists", () => {
    const found = nearMatches("Benson", roster);
    expect(found[0]).toMatchObject({ playerId: "p-benson", kind: "same-name" });
    expect(nearMatchNotice("Benson", found)).toContain("already on the roster");
  });

  // The collision that shipped once already.
  it("flags Adee when Ade is typed, and the other way round", () => {
    expect(nearMatches("Ade", roster).map((m) => m.playerId)).toContain("p-adee");
    expect(nearMatches("Adee", roster).map((m) => m.playerId)).toContain("p-ade");
  });

  it("flags the Sam / Samuel and Timi / Timi Olaoye shapes", () => {
    expect(nearMatches("Sam", roster).map((m) => m.playerId)).toEqual(
      expect.arrayContaining(["p-sam", "p-samuel"])
    );
    expect(nearMatches("Timi", roster).map((m) => m.playerId)).toEqual(
      expect.arrayContaining(["p-timi", "p-timi-olaoye"])
    );
  });

  // The autocorrect that made "Martins" look like a person called Martin.
  it("flags Martins when Martin is typed", () => {
    expect(nearMatches("Martin", roster).map((m) => m.playerId)).toContain("p-martins");
  });

  it("ranks an exact name above a lookalike", () => {
    const found = nearMatches("Sam", roster);
    expect(found[0].kind).toBe("same-name");
    expect(found[0].playerId).toBe("p-sam");
  });

  it("says nothing about a genuinely new name", () => {
    expect(nearMatches("Zephyrine", roster)).toEqual([]);
    expect(nearMatchNotice("Zephyrine", [])).toBeNull();
  });

  it("ignores case, accents and punctuation", () => {
    expect(nearMatches("  bEnSoN ", roster)[0].playerId).toBe("p-benson");
    expect(nearMatches("Adé", roster).map((m) => m.playerId)).toContain("p-ade");
  });

  it("says nothing for an empty box", () => {
    expect(nearMatches("", roster)).toEqual([]);
    expect(nearMatches("   ", roster)).toEqual([]);
  });

  // SURFACE, DON'T BLOCK: two real people share a first name in this roster,
  // so a near-match is a prompt to look, never a refusal. Both notices state
  // a consequence; neither states a refusal.
  it("tells an exact name what it is about to do, and still allows it", () => {
    const found = nearMatches("Timi", roster);
    expect(found.length).toBeGreaterThan(0);
    const said = nearMatchNotice("Timi", found)!;
    expect(said).toContain("makes a second person with that name");
    expect(said).not.toMatch(/cannot|can't|not allowed|refused/i);
  });

  it("asks a lookalike to be checked, and still allows it", () => {
    const found = nearMatches("Timi O", roster);
    expect(found.map((m) => m.playerId)).toContain("p-timi-olaoye");
    const said = nearMatchNotice("Timi O", found)!;
    expect(said).toContain("Check this is somebody new");
    expect(said).not.toMatch(/cannot|can't|not allowed|refused/i);
  });
});
