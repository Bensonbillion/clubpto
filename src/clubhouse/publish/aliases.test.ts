import { describe, expect, it } from "vitest";
import {
  isCommittable,
  planAliases,
  resolveAliases,
  type AliasRow,
  type EngineIdentity,
  type RosterName,
} from "./aliases";
import { mergeRoster } from "@/court-manager/rosterMerge";
import type { Player } from "@/court-manager/types";

// The real collision, from src/clubhouse/migrations/002_roster_seed.sql:
// 66 rows, exactly one first name shared by two people.
const roster: RosterName[] = [
  { playerId: "p-benson", displayName: "Benson" },
  { playerId: "p-timi", displayName: "Timi" },
  { playerId: "p-timi-olaoye", displayName: "Timi Olaoye" },
  { playerId: "p-shana", displayName: "Shana" },
  // The near-misses, verbatim from the seed. Its header records as a data law
  // that these co-occurred on one night and are different people.
  { playerId: "p-ade", displayName: "Ade" },
  { playerId: "p-adee", displayName: "Adee" },
  { playerId: "p-sam", displayName: "Sam" },
  { playerId: "p-samuel", displayName: "Samuel" },
  { playerId: "p-temi", displayName: "Temi" },
  { playerId: "p-temitope", displayName: "Temitope" },
];

const engine = (id: string, name: string, lastName?: string): EngineIdentity => ({ id, name, lastName });

describe("resolving engine ids against the roster", () => {
  it("uses a stored alias without asking anyone", () => {
    const aliases: AliasRow[] = [{ kind: "engine_player_id", value: "pl-abc-1", playerId: "p-benson" }];
    const out = resolveAliases({ engine: [engine("pl-abc-1", "Benson")], roster, aliases });
    expect(out.resolved).toEqual([{ engineId: "pl-abc-1", playerId: "p-benson", stale: false }]);
    expect(out.questions).toHaveLength(0);
  });

  // The case the module exists for. Two people answer to "Timi", so there is
  // no such thing as a safe guess and the module does not make one.
  it("refuses to pre-select when two members share the first name", () => {
    const out = resolveAliases({ engine: [engine("pl-1", "Timi")], roster, aliases: [] });
    expect(out.resolved).toHaveLength(0);
    const q = out.questions[0];
    expect(q.preselected).toBeNull();
    expect(q.reason).toBe("several-first-name-matches");
    expect(q.candidates.map((c) => c.playerId)).toEqual(["p-timi", "p-timi-olaoye"]);
  });

  it("pre-selects a unique first name but still asks", () => {
    const out = resolveAliases({ engine: [engine("pl-2", "Shana")], roster, aliases: [] });
    const q = out.questions[0];
    expect(q.preselected).toBe("p-shana");
    expect(q.reason).toBe("one-first-name-match");
    // Pre-selected is not resolved. It is still a question.
    expect(out.resolved).toHaveLength(0);
  });

  it("prefers a unique full-name match over the ambiguous first name", () => {
    const out = resolveAliases({ engine: [engine("pl-3", "Timi", "Olaoye")], roster, aliases: [] });
    const q = out.questions[0];
    expect(q.preselected).toBe("p-timi-olaoye");
    expect(q.reason).toBe("one-full-name-match");
    expect(q.candidates[0].match).toBe("full-name");
    // The OTHER Timi is still on the list. Ranking a strong match first is
    // not the same as hiding the person the admin might actually have meant,
    // and a preselection they cannot override is a silent match wearing a
    // confirm button.
    expect(q.candidates.map((c) => c.playerId)).toEqual(["p-timi-olaoye", "p-timi"]);
  });

  it("does not treat a missing last name as a full-name match", () => {
    // "Benson" with no surname must not match as though it were a full name;
    // it is a first-name match, and the reason has to say so.
    const out = resolveAliases({ engine: [engine("pl-4", "Benson")], roster, aliases: [] });
    expect(out.questions[0].reason).toBe("one-first-name-match");
    expect(out.questions[0].candidates[0].match).toBe("first-name");
  });

  // A guest, a typo, a name nobody recognises. They still have to be
  // accounted for; they do not get dropped on the floor.
  it("surfaces an unmatched id as a question rather than skipping it", () => {
    const out = resolveAliases({ engine: [engine("pl-5", "Zephyrine")], roster, aliases: [] });
    expect(out.questions).toHaveLength(1);
    expect(out.questions[0].candidates).toEqual([]);
    expect(out.questions[0].reason).toBe("no-name-match");
    expect(out.questions[0].preselected).toBeNull();
  });

  it("accounts for every engine id exactly once", () => {
    const people = [
      engine("pl-a", "Benson"),
      engine("pl-b", "Timi"),
      engine("pl-c", "Nobody"),
      engine("pl-d", "Shana"),
    ];
    const out = resolveAliases({
      engine: people,
      roster,
      aliases: [{ kind: "engine_player_id", value: "pl-a", playerId: "p-benson" }],
    });
    const seen = [...out.resolved.map((r) => r.engineId), ...out.questions.map((q) => q.engineId)].sort();
    expect(seen).toEqual(["pl-a", "pl-b", "pl-c", "pl-d"]);
  });

  // Six strict-prefix pairs exist in the real roster and every one of them is
  // two different people who played on the same night. A matcher that got
  // any cleverer than equality would merge them.
  it.each([
    ["Ade", "p-ade"],
    ["Adee", "p-adee"],
    ["Sam", "p-sam"],
    ["Samuel", "p-samuel"],
    ["Temi", "p-temi"],
    ["Temitope", "p-temitope"],
  ])("matches %s to exactly one member and nobody adjacent", (name, expected) => {
    const out = resolveAliases({ engine: [engine("pl-x", name)], roster, aliases: [] });
    const q = out.questions[0];
    expect(q.candidates.map((c) => c.playerId)).toEqual([expected]);
    expect(q.reason).toBe("one-first-name-match");
  });

  it("counts how many ids already point at a candidate", () => {
    const aliases: AliasRow[] = [
      { kind: "engine_player_id", value: "csv_benson", playerId: "p-benson" },
      { kind: "engine_player_id", value: "pl-old-9", playerId: "p-benson" },
    ];
    const out = resolveAliases({ engine: [engine("pl-new-1", "Benson")], roster, aliases });
    expect(out.questions[0].candidates[0].alreadyMappedFrom).toBe(2);
  });
});

describe("planning the one write", () => {
  const resolution = (engineList: EngineIdentity[], aliases: AliasRow[] = []) =>
    resolveAliases({ engine: engineList, roster, aliases });

  it("holds an answered question until Publish, as one row", () => {
    const res = resolution([engine("pl-1", "Timi")]);
    const plan = planAliases({
      resolution: res,
      decisions: { "pl-1": "p-timi-olaoye" },
      roster,
      aliases: [],
    });
    expect(plan.rows).toEqual([{ kind: "engine_player_id", value: "pl-1", playerId: "p-timi-olaoye" }]);
    expect(plan.mapping).toEqual({ "pl-1": "p-timi-olaoye" });
    expect(isCommittable(plan)).toBe(true);
  });

  it("refuses to commit while a question is unanswered", () => {
    const res = resolution([engine("pl-1", "Timi"), engine("pl-2", "Shana")]);
    const plan = planAliases({ resolution: res, decisions: { "pl-1": "p-timi" }, roster, aliases: [] });
    expect(plan.problems).toEqual([{ kind: "unanswered", engineId: "pl-2" }]);
    expect(isCommittable(plan)).toBe(false);
  });

  it("takes an explicit skip as an answer, and writes nothing for it", () => {
    const res = resolution([engine("pl-9", "Zephyrine")]);
    const plan = planAliases({ resolution: res, decisions: { "pl-9": null }, roster, aliases: [] });
    expect(plan.rows).toEqual([]);
    expect(plan.skipped).toEqual(["pl-9"]);
    expect(plan.mapping).toEqual({});
    expect(isCommittable(plan)).toBe(true);
  });

  it("catches two engine ids pointed at one member", () => {
    const res = resolution([engine("pl-1", "Timi"), engine("pl-2", "Timi")]);
    const plan = planAliases({
      resolution: res,
      decisions: { "pl-1": "p-timi", "pl-2": "p-timi" },
      roster,
      aliases: [],
    });
    expect(plan.problems).toEqual([
      { kind: "duplicate-person", playerId: "p-timi", engineIds: ["pl-1", "pl-2"] },
    ]);
    expect(isCommittable(plan)).toBe(false);
  });

  it("rejects a decision naming somebody who is not on the roster", () => {
    const res = resolution([engine("pl-1", "Timi")]);
    const plan = planAliases({ resolution: res, decisions: { "pl-1": "p-ghost" }, roster, aliases: [] });
    expect(plan.problems).toContainEqual({ kind: "unknown-roster-member", engineId: "pl-1", playerId: "p-ghost" });
    expect(isCommittable(plan)).toBe(false);
  });

  // Corrections, not appends. The admin mapped pl-1 to the wrong Timi.
  it("reassigns a stored mapping and says out loud that it is changing", () => {
    const stored: AliasRow[] = [{ kind: "engine_player_id", value: "pl-1", playerId: "p-timi" }];
    const res = resolution([engine("pl-1", "Timi")], stored);
    expect(res.resolved).toHaveLength(1); // nobody is asked; the admin overrides

    const plan = planAliases({
      resolution: res,
      decisions: { "pl-1": "p-timi-olaoye" },
      roster,
      aliases: stored,
    });
    expect(plan.reassignments).toEqual([{ engineId: "pl-1", from: "p-timi", to: "p-timi-olaoye" }]);
    expect(plan.rows).toEqual([{ kind: "engine_player_id", value: "pl-1", playerId: "p-timi-olaoye" }]);
    expect(plan.mapping["pl-1"]).toBe("p-timi-olaoye");
    expect(isCommittable(plan)).toBe(true);
  });

  it("re-confirming the same mapping writes nothing", () => {
    const stored: AliasRow[] = [{ kind: "engine_player_id", value: "pl-1", playerId: "p-timi" }];
    const res = resolution([engine("pl-1", "Timi")], stored);
    const plan = planAliases({ resolution: res, decisions: { "pl-1": "p-timi" }, roster, aliases: stored });
    expect(plan.rows).toEqual([]);
    expect(plan.reassignments).toEqual([]);
  });
});

// mergeRoster's attach() replaces an existing csv_ id with a stable one, in
// exactly one direction: a CSV-created player later matched by the "Import
// classic roster" button. The person did not change. Their engine id did, and
// this is the moment a naive alias table either silently misses them or
// re-asks about the whole roster.
describe("an id swap in the engine costs exactly one confirmation", () => {
  const player = (id: string, name: string, lastName?: string): Player =>
    ({ id, name, lastName, tier: "B", isVip: false, isCoach: false, checkedIn: false }) as Player;

  it("mergeRoster really does replace a csv_ id", () => {
    const merged = mergeRoster([player("csv_benson", "Benson")], [player("pl-stable-1", "Benson")]);
    expect(merged.added).toBe(0);
    expect(merged.updated).toBe(1);
    expect(merged.players[0].id).toBe("pl-stable-1"); // the id moved under them
  });

  it("asks about the new id once, and keeps resolving the old one", () => {
    const before: AliasRow[] = [{ kind: "engine_player_id", value: "csv_benson", playerId: "p-benson" }];
    const merged = mergeRoster([player("csv_benson", "Benson")], [player("pl-stable-1", "Benson")]);
    const tonight: EngineIdentity[] = merged.players.map((p) => ({ id: p.id, name: p.name, lastName: p.lastName }));

    const res = resolveAliases({ engine: tonight, roster, aliases: before });
    expect(res.questions).toHaveLength(1);
    expect(res.questions[0].engineId).toBe("pl-stable-1");
    expect(res.questions[0].preselected).toBe("p-benson");

    const plan = planAliases({
      resolution: res,
      decisions: { "pl-stable-1": "p-benson" },
      roster,
      aliases: before,
    });
    expect(plan.rows).toHaveLength(1);
    // Not a reassignment: the old alias is untouched, the member simply has
    // two handles now.
    expect(plan.reassignments).toEqual([]);

    // Last month's session, which still carries the old id, keeps resolving.
    const after = [...before, ...plan.rows];
    const old = resolveAliases({ engine: [engine("csv_benson", "Benson")], roster, aliases: after });
    expect(old.resolved).toEqual([{ engineId: "csv_benson", playerId: "p-benson", stale: false }]);
    expect(old.questions).toHaveLength(0);
  });
});

// The half of the swap that bites. Both import callers rewrite session.players
// and nothing else, so the OLD id stays behind in pairs[].playerIds, in the
// pair's own id string, in unpaired, vipPartnerId, playoffs and champion.
// A publish input assembled from pairs carries the old id; one assembled from
// players carries the new one. The same human, twice, in one night.
describe("the old id left behind in pairs", () => {
  const swapped: EngineIdentity[] = [
    { id: "pl-stable-1", name: "Benson" },
    // No Player object exists for this any more — only the reference does,
    // which is why it has no name to show.
    { id: "csv_benson", name: "", staleReference: true },
  ];

  it("surfaces a nameless leftover as a question instead of dropping it", () => {
    const out = resolveAliases({ engine: swapped, roster, aliases: [] });
    const leftover = out.questions.find((q) => q.engineId === "csv_benson")!;
    expect(leftover).toBeDefined();
    expect(leftover.stale).toBe(true);
    expect(leftover.candidates).toEqual([]);
    expect(leftover.reason).toBe("no-name-match");
    expect(out.staleIds).toEqual(["csv_benson"]);
  });

  it("lets both ids land on one member without calling it a duplicate", () => {
    const out = resolveAliases({ engine: swapped, roster, aliases: [] });
    const plan = planAliases({
      resolution: out,
      decisions: { "pl-stable-1": "p-benson", csv_benson: "p-benson" },
      roster,
      aliases: [],
    });
    expect(plan.problems).toEqual([]);
    expect(isCommittable(plan)).toBe(true);
    expect(plan.rows).toHaveLength(2);
  });

  // What the same night looks like if nobody marks the leftover: two people
  // called Benson, and a Publish that will not commit.
  it("WOULD be refused if the leftover were treated as a person", () => {
    const naive = swapped.map((p) => ({ ...p, staleReference: false, name: "Benson" }));
    const out = resolveAliases({ engine: naive, roster, aliases: [] });
    const plan = planAliases({
      resolution: out,
      decisions: { "pl-stable-1": "p-benson", csv_benson: "p-benson" },
      roster,
      aliases: [],
    });
    expect(plan.problems).toEqual([
      { kind: "duplicate-person", playerId: "p-benson", engineIds: ["csv_benson", "pl-stable-1"] },
    ]);
  });

  it("still catches two genuine people aimed at one member", () => {
    const two: EngineIdentity[] = [
      { id: "pl-1", name: "Timi" },
      { id: "pl-2", name: "Timi" },
    ];
    const out = resolveAliases({ engine: two, roster, aliases: [] });
    const plan = planAliases({
      resolution: out,
      decisions: { "pl-1": "p-timi", "pl-2": "p-timi" },
      roster,
      aliases: [],
    });
    expect(plan.problems).toEqual([
      { kind: "duplicate-person", playerId: "p-timi", engineIds: ["pl-1", "pl-2"] },
    ]);
  });
});

// Every roster name is ASCII today. This is for the first one that is not:
// the engine and the roster hold names typed by different people on
// different days, and one of them will skip the accent.
describe("accents", () => {
  const accented: RosterName[] = [
    { playerId: "p-jose", displayName: "José" },
    { playerId: "p-benson", displayName: "Benson" },
  ];

  it("matches an unaccented spelling to an accented roster name", () => {
    const out = resolveAliases({ engine: [engine("pl-1", "Jose")], roster: accented, aliases: [] });
    expect(out.questions[0].candidates.map((c) => c.playerId)).toEqual(["p-jose"]);
  });

  it("and the other way round", () => {
    const out = resolveAliases({ engine: [engine("pl-1", "José")], roster: accented, aliases: [] });
    expect(out.questions[0].candidates.map((c) => c.playerId)).toEqual(["p-jose"]);
  });

  // Folding produces more candidates, never fewer — so if both spellings are
  // on the roster as different people, the question becomes ambiguous rather
  // than quietly picking one.
  it("goes ambiguous rather than choosing between two spellings", () => {
    const both = [...accented, { playerId: "p-jose-plain", displayName: "Jose" }];
    const out = resolveAliases({ engine: [engine("pl-1", "Jose")], roster: both, aliases: [] });
    expect(out.questions[0].preselected).toBeNull();
    expect(out.questions[0].reason).toBe("several-first-name-matches");
  });
});

// Both of these were live defects, found by an adversarial review after the
// first version passed 37 tests. They share a root cause: the full-name
// comparison was equality of LETTERS RUN TOGETHER rather than equality of
// names, so the near-miss pairs the seed calls a data law collapsed into each
// other — and each one arrived under "one-full-name-match", the strongest
// label the type has.
describe("the full-name match, where it went wrong", () => {
  const near: RosterName[] = [
    { playerId: "p-ade", displayName: "Ade" },
    { playerId: "p-adee", displayName: "Adee" },
    { playerId: "p-ife", displayName: "Ife" },
    { playerId: "p-ifeoma", displayName: "Ifeoma" },
    { playerId: "p-sam", displayName: "Sam" },
    { playerId: "p-samuel", displayName: "Samuel" },
    { playerId: "p-temi", displayName: "Temi" },
    { playerId: "p-temitope", displayName: "Temitope" },
    { playerId: "p-tomi", displayName: "Tomi" },
  ];

  // "Ade E." is what a Google or Apple contacts export gives you, and
  // rosterCsv's splitFullName turns it into {name: "Ade", lastName: "E."}.
  // Concatenated that is "adee" — the other person.
  it("does not turn a last initial into a match on a longer name", () => {
    const out = resolveAliases({ engine: [engine("pl-1", "Ade", "E.")], roster: near, aliases: [] });
    const q = out.questions[0];
    expect(q.candidates.filter((c) => c.match === "full-name")).toEqual([]);
    expect(q.preselected).toBe("p-ade");
    expect(q.reason).toBe("one-first-name-match");
  });

  it.each([
    ["Ife", "Oma", "p-ife", "p-ifeoma"],
    ["Sam", "Uel", "p-sam", "p-samuel"],
    ["Temi", "Tope", "p-temi", "p-temitope"],
  ])("never lets %s + %s become the other member", (first, last, right, wrong) => {
    const out = resolveAliases({ engine: [engine("pl-1", first, last)], roster: near, aliases: [] });
    const q = out.questions[0];
    expect(q.preselected).not.toBe(wrong);
    expect(q.preselected).toBe(right);
    expect(q.candidates.some((c) => c.playerId === wrong && c.match === "full-name")).toBe(false);
  });

  // The nastiest one: "Tom" + "I" concatenates to the ONLY candidate, so the
  // right person is not even offered.
  it("does not invent a sole candidate out of a split name", () => {
    const out = resolveAliases({ engine: [engine("pl-1", "Tom", "I")], roster: near, aliases: [] });
    expect(out.questions[0].candidates.map((c) => c.playerId)).toEqual([]);
    expect(out.questions[0].reason).toBe("no-name-match");
  });

  // The real one still has to work.
  it("still matches a genuine two-part name", () => {
    const out = resolveAliases({ engine: [engine("pl-1", "Timi", "Olaoye")], roster, aliases: [] });
    expect(out.questions[0].preselected).toBe("p-timi-olaoye");
    expect(out.questions[0].reason).toBe("one-full-name-match");
  });
});

describe("a surname field with nothing in it", () => {
  // "-" and "." are what people type into a required field, and rosterCsv's
  // clean() only trims and collapses whitespace, so they arrive intact.
  it.each(["-", ".", " ", "  ", "—", ""])(
    "treats %j as no surname, keeping both Timis in play",
    (lastName) => {
      const out = resolveAliases({ engine: [engine("pl-1", "Timi", lastName)], roster, aliases: [] });
      const q = out.questions[0];
      expect(q.preselected).toBeNull();
      expect(q.reason).toBe("several-first-name-matches");
      expect(q.candidates.map((c) => c.playerId)).toEqual(["p-timi", "p-timi-olaoye"]);
    }
  );
});
