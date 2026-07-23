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

  // Finding 1: tonight's flow — classic (first name only) then a CSV with 2+
  // people sharing that first name. The classic member must NOT get an
  // arbitrary surname stapled on (that misidentifies them at check-in).
  it("does not staple an arbitrary surname when the first name is ambiguous in the incoming CSV", () => {
    const existing = [p({ id: "classic-david", name: "David", tier: "A" })]; // no last name
    const incoming = [
      p({ id: "csv-1", name: "David", lastName: "Okafor" }),
      p({ id: "csv-2", name: "David", lastName: "Mensah" }),
    ];

    const result = mergeRoster(existing, incoming);

    const classicDavid = result.players.find((x) => x.id === "classic-david");
    expect(classicDavid?.lastName).toBeUndefined(); // no wrong surname
    expect(classicDavid?.tier).toBe("A");
    expect(result.players).toHaveLength(3); // both CSV Davids added, none lost
    expect(result.players.filter((x) => x.name === "David")).toHaveLength(3);
  });

  // Finding 1 (worse variant): 3+ same-first-name incoming must never overwrite
  // each other via a match against an already-pushed entry.
  it("keeps every distinct same-first-name person from the incoming batch", () => {
    const incoming = [
      p({ id: "a", name: "Tosin", lastName: "Aye" }),
      p({ id: "b", name: "Tosin", lastName: "Bami" }),
      p({ id: "c", name: "Tosin", lastName: "Cole" }),
    ];
    const result = mergeRoster([], incoming);
    expect(result.players).toHaveLength(3);
    expect(result.added).toBe(3);
  });

  // Finding 2: a distinct same-first-name person is not dropped when the
  // existing entry already carries a (different) surname.
  it("does not drop a distinct person sharing a first name with a surnamed existing entry", () => {
    const existing = [p({ id: "e1", name: "Benson", lastName: "Billions" })];
    const incoming = [p({ id: "i1", name: "Benson", lastName: "Kim" })];

    const result = mergeRoster(existing, incoming);

    expect(result.players).toHaveLength(2);
    expect(result.added).toBe(1);
  });

  // Finding 3: importing CSV before classic must still keep the classic
  // member's real tier and stable id.
  it("keeps the classic tier and stable id regardless of import order", () => {
    const csvFirst = [p({ id: "csv_benson", name: "Benson", tier: "B", lastName: "Billions" })];
    const classicIncoming = [p({ id: "classic-benson", name: "Benson", tier: "A" })];

    const result = mergeRoster(csvFirst, classicIncoming);

    expect(result.players).toHaveLength(1);
    expect(result.players[0].tier).toBe("A"); // real tier wins over default B
    expect(result.players[0].id).toBe("classic-benson"); // stable id wins over csv_ id
    expect(result.players[0].lastName).toBe("Billions"); // surname kept
  });
});
