import { describe, expect, it } from "vitest";
import { assertNoTierLeak, buildPublishBundle } from "./transform";
import type { PublishOptions, PublishSessionInput } from "./types";

const POINTS = {
  "Champion of the Week": 100,
  "PTO Champion of the Week": 100,
  "Court 1 Champions": 40,
  "Court 2 Champions": 60,
};

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
      { title: "Champion of the Week", pairId: "pairA" },
      { title: "Court 2 Champions", pairId: "pairB" },
    ],
  };
}

const baseOptions: PublishOptions = { pointsConfig: POINTS };

describe("buildPublishBundle", () => {
  it("never leaks tier or division data in any output shape", () => {
    const bundle = buildPublishBundle(fixture(), baseOptions);
    expect(() => assertNoTierLeak(bundle)).not.toThrow();
    const json = JSON.stringify(bundle);
    expect(json).not.toContain('"tier"');
    expect(json).not.toContain('"division"');
  });

  it("publishes champions by court/title name with event-weighted points", () => {
    const bundle = buildPublishBundle(fixture(), baseOptions);
    expect(bundle.champions.map((c) => [c.title, c.points])).toEqual([
      ["Champion of the Week", 100],
      ["Court 2 Champions", 60],
    ]);
  });

  it("points depend only on the title, never on who won it (LB-4)", () => {
    const base = fixture();
    const swapped = { ...base, champions: [{ title: "Champion of the Week", pairId: "pairB" }] };
    const a = buildPublishBundle(base, baseOptions).champions[0];
    const b = buildPublishBundle(swapped, baseOptions).champions[0];
    expect(a.points).toBe(b.points);
  });

  it("unconfigured titles publish with zero points, never a guess", () => {
    const special = { ...fixture(), champions: [{ title: "Holiday Cup", pairId: "pairA" }] };
    expect(buildPublishBundle(special, baseOptions).champions[0].points).toBe(0);
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
    const champA = bundle.champions.find((c) => c.title === "Champion of the Week")!;
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
