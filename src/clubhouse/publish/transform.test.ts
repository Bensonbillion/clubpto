import { describe, expect, it } from "vitest";
import { assertNoTierLeak, buildPublishBundle } from "./transform";
import type { PublishOptions, PublishSessionInput } from "./types";

const DIVISIONS = { A: "Headliners", B: "The Lineup", C: "Soundcheck" };

function fixture(): PublishSessionInput {
  return {
    sessionId: "s-2026-08-05",
    date: "2026-08-05",
    venue: "District Padel Club",
    players: [
      { id: "p1", name: "Benson", lastName: "Egemonye", tier: "A" },
      { id: "p2", name: "Duke", tier: "A" },
      { id: "p3", name: "Maya", tier: "B" },
      { id: "p4", name: "Sam", tier: "B" },
    ],
    pairs: [
      { id: "pairA", playerIds: ["p1", "p2"], tier: "A" },
      { id: "pairB", playerIds: ["p3", "p4"], tier: "B" },
    ],
    results: [
      { gameId: "g1", winnerPairId: "pairA", loserPairId: "pairB", completedAt: 100 },
      { gameId: "g2", winnerPairId: "pairB", loserPairId: "pairA", completedAt: 200 },
    ],
    champions: [
      { tier: "A", pairId: "pairA" },
      { tier: "B", pairId: "pairB" },
    ],
  };
}

const baseOptions: PublishOptions = { divisionNames: DIVISIONS };

describe("buildPublishBundle", () => {
  it("never leaks tier data in any output shape", () => {
    const bundle = buildPublishBundle(fixture(), baseOptions);
    expect(() => assertNoTierLeak(bundle, Object.values(DIVISIONS))).not.toThrow();
    expect(JSON.stringify(bundle)).not.toContain('"tier"');
  });

  it("maps champions to division display names at publish time", () => {
    const bundle = buildPublishBundle(fixture(), baseOptions);
    expect(bundle.champions.map((c) => c.division)).toEqual(["Headliners", "The Lineup"]);
  });

  it("is deterministic: same input produces a deep-equal bundle (republish idempotence)", () => {
    const a = buildPublishBundle(fixture(), baseOptions);
    const b = buildPublishBundle(fixture(), baseOptions);
    expect(a).toEqual(b);
  });

  it("hides players everywhere: no id, no name, absent from the player list", () => {
    const bundle = buildPublishBundle(fixture(), {
      ...baseOptions,
      privacy: { hiddenPlayerIds: ["p2"] },
    });
    expect(JSON.stringify(bundle)).not.toContain("Duke");
    expect(bundle.players.some((p) => p.id === "p2")).toBe(false);
    const pairA = bundle.pairs.find((p) => p.pairId === "pairA")!;
    expect(pairA.players.some((ref) => ref.displayName === "Club member" && !ref.id)).toBe(true);
    // Their games remain as anonymized entries (PROF-3).
    expect(bundle.results).toHaveLength(2);
  });

  it("applies pseudonyms while keeping the stable player id", () => {
    const bundle = buildPublishBundle(fixture(), {
      ...baseOptions,
      privacy: { pseudonyms: { p3: "The Wall" } },
    });
    expect(JSON.stringify(bundle)).not.toContain("Maya");
    const ref = bundle.players.find((p) => p.id === "p3");
    expect(ref?.displayName).toBe("The Wall");
  });

  it("honors champion-naming opt-out without hiding the player elsewhere", () => {
    const bundle = buildPublishBundle(fixture(), {
      ...baseOptions,
      privacy: { championOptOutIds: ["p1"] },
    });
    const champA = bundle.champions.find((c) => c.division === "Headliners")!;
    expect(champA.pair.players.some((ref) => ref.displayName === "Club member")).toBe(true);
    expect(bundle.players.some((p) => p.id === "p1")).toBe(true);
  });

  it("withholds results and champions for practice sessions", () => {
    const bundle = buildPublishBundle({ ...fixture(), isPractice: true }, baseOptions);
    expect(bundle.practiceOnly).toBe(true);
    expect(bundle.results).toHaveLength(0);
    expect(bundle.champions).toHaveLength(0);
    expect(bundle.session.attendanceCount).toBe(4);
  });

  it("carries the human recap note and shout-outs", () => {
    const bundle = buildPublishBundle(fixture(), {
      ...baseOptions,
      recapNote: "  A night of upsets.  ",
      shoutouts: ["Maya brought three guests", " "],
    });
    expect(bundle.session.recapNote).toBe("A night of upsets.");
    expect(bundle.session.shoutouts).toEqual(["Maya brought three guests"]);
  });
});
