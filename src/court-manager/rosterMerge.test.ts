import { describe, expect, it } from "vitest";
import { mergeRoster } from "./rosterMerge";
import type { Player } from "./types";

const p = (over: Partial<Player> & { name: string }): Player => ({
  id: over.id ?? over.name.toLowerCase(),
  tier: "B",
  isVip: false,
  isCoach: false,
  checkedIn: false,
  ...over,
});

describe("mergeRoster", () => {
  it("attaches a CSV last name to a classic first-name-only entry without duplicating", () => {
    const existing = [p({ id: "classic-benson", name: "Benson", tier: "A" })];
    const incoming = [p({ id: "csv-1", name: "Benson", lastName: "Billions" })];

    const result = mergeRoster(existing, incoming);

    expect(result.players).toHaveLength(1);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.players[0]).toMatchObject({
      id: "classic-benson", // stable id preserved
      tier: "A", // real tier preserved, not clobbered to B
      lastName: "Billions",
    });
  });

  it("adds genuinely new people", () => {
    const existing = [p({ name: "Benson" })];
    const incoming = [p({ id: "csv-jane", name: "Jane", lastName: "Smith" })];

    const result = mergeRoster(existing, incoming);

    expect(result.players).toHaveLength(2);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
  });

  it("never collapses two different people who share a first name", () => {
    const existing = [
      p({ id: "d1", name: "David", lastName: "Okafor" }),
      p({ id: "d2", name: "David", lastName: "Mensah" }),
    ];
    // A CSV David with a third last name is ambiguous → added, not merged.
    const incoming = [p({ id: "csv-d", name: "David", lastName: "Adeyemi" })];

    const result = mergeRoster(existing, incoming);

    expect(result.players).toHaveLength(3);
    expect(result.added).toBe(1);
  });

  it("is idempotent — re-importing the same list changes nothing", () => {
    const roster = [p({ id: "csv-1", name: "Ada", lastName: "Lovelace" })];
    const again = mergeRoster(roster, [...roster]);

    expect(again.players).toHaveLength(1);
    expect(again.added).toBe(0);
  });
});
