import { beforeEach, describe, expect, it, vi } from "vitest";

// One mutable fake client, same shape as src/court-manager/archive.test.ts.
const fake = {
  selectResult: { data: null as unknown, error: null as { message: string } | null },
  upsertResult: { error: null as { message: string } | null },
  /** Every upsert call, so "one write" can be asserted as one call. */
  upserts: [] as { rows: Record<string, unknown>[]; options: unknown }[],
  user: { id: "admin-1" } as { id: string } | null,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: async () => fake.selectResult,
      upsert: async (rows: Record<string, unknown>[], options: unknown) => {
        fake.upserts.push({ rows, options });
        return fake.upsertResult;
      },
    }),
    auth: { getUser: async () => ({ data: { user: fake.user } }) },
  },
}));

const { fetchAliases, commitAliasesOrThrow, AliasCommitFailed } = await import("./aliasStore");
const { planAliases, resolveAliases } = await import("./aliases");

const roster = [
  { playerId: "p-benson", displayName: "Benson" },
  { playerId: "p-timi", displayName: "Timi" },
  { playerId: "p-timi-olaoye", displayName: "Timi Olaoye" },
];

beforeEach(() => {
  fake.selectResult = { data: [], error: null };
  fake.upsertResult = { error: null };
  fake.upserts = [];
  fake.user = { id: "admin-1" };
});

describe("reading what is already mapped", () => {
  it("returns the stored engine aliases", async () => {
    fake.selectResult = {
      data: [{ kind: "engine_player_id", value: "pl-1", player_id: "p-benson" }],
      error: null,
    };
    await expect(fetchAliases()).resolves.toEqual([
      { kind: "engine_player_id", value: "pl-1", playerId: "p-benson" },
    ]);
  });

  // A read failure that returned [] would look exactly like "nothing is
  // mapped yet", put every already-answered name back in front of the admin,
  // and overwrite the earlier answers with whatever they picked the second time.
  it("throws instead of reporting an empty mapping table", async () => {
    fake.selectResult = { data: null, error: { message: "network down" } };
    await expect(fetchAliases()).rejects.toBeInstanceOf(AliasCommitFailed);
  });
});

describe("committing, once, at Publish", () => {
  it("writes every confirmation in a single call", async () => {
    const n = await commitAliasesOrThrow([
      { kind: "engine_player_id", value: "pl-1", playerId: "p-timi" },
      { kind: "engine_player_id", value: "pl-2", playerId: "p-benson" },
      { kind: "engine_player_id", value: "pl-3", playerId: "p-timi-olaoye" },
    ]);
    expect(n).toBe(3);
    expect(fake.upserts).toHaveLength(1); // one statement, one transaction
    expect(fake.upserts[0].rows).toHaveLength(3);
    expect(fake.upserts[0].options).toEqual({ onConflict: "kind,value" });
  });

  it("stamps every row confirmed, by a named admin", async () => {
    await commitAliasesOrThrow([{ kind: "engine_player_id", value: "pl-1", playerId: "p-timi" }]);
    expect(fake.upserts[0].rows[0]).toEqual({
      kind: "engine_player_id",
      value: "pl-1",
      player_id: "p-timi",
      verified: true,
      confirmed_by: "admin-1",
    });
  });

  it("refuses to write with nobody signed in", async () => {
    fake.user = null;
    await expect(
      commitAliasesOrThrow([{ kind: "engine_player_id", value: "pl-1", playerId: "p-timi" }])
    ).rejects.toBeInstanceOf(AliasCommitFailed);
    expect(fake.upserts).toHaveLength(0);
  });

  it("throws when the write fails, so the caller cannot publish on top of it", async () => {
    fake.upsertResult = { error: { message: "new row violates row-level security policy" } };
    await expect(
      commitAliasesOrThrow([{ kind: "engine_player_id", value: "pl-1", playerId: "p-timi" }])
    ).rejects.toBeInstanceOf(AliasCommitFailed);
  });

  it("makes no request at all when there is nothing to write", async () => {
    await expect(commitAliasesOrThrow([])).resolves.toBe(0);
    expect(fake.upserts).toHaveLength(0);
  });
});

// The whole point of staging: an admin confirms 24 names at 11pm and closes
// the laptop. If confirmations were written as they were tapped, the next
// Publish would resolve some of those people and re-ask about the rest, with
// nothing to say which was which.
describe("a cancelled Publish", () => {
  const twentyFour = Array.from({ length: 24 }, (_, i) => ({
    id: `pl-${i}`,
    name: i % 2 ? "Timi" : "Benson",
  }));

  it("leaves zero aliases behind after twelve confirmations and a close", async () => {
    const resolution = resolveAliases({ engine: twentyFour, roster, aliases: [] });
    expect(resolution.questions).toHaveLength(24);

    // The admin taps through half the list...
    const decisions: Record<string, string | null> = {};
    for (const q of resolution.questions.slice(0, 12)) {
      decisions[q.engineId] = q.engineName === "Timi" ? "p-timi" : "p-benson";
    }

    // ...and stops. The plan knows it is not finished.
    const plan = planAliases({ resolution, decisions, roster, aliases: [] });
    expect(plan.problems.filter((p) => p.kind === "unanswered")).toHaveLength(12);

    // Nothing was written, because nothing writes until commit is called.
    expect(fake.upserts).toHaveLength(0);

    // And a fresh session finds the database exactly as it was.
    fake.selectResult = { data: [], error: null };
    await expect(fetchAliases()).resolves.toEqual([]);
  });

  it("writes nothing when a full set of confirmations is abandoned", async () => {
    const resolution = resolveAliases({ engine: twentyFour, roster, aliases: [] });
    const decisions: Record<string, string | null> = {};
    for (const q of resolution.questions) {
      decisions[q.engineId] = q.engineName === "Timi" ? "p-timi" : "p-benson";
    }
    const plan = planAliases({ resolution, decisions, roster, aliases: [] });

    // A complete set of answers, all 24 of them, and still nothing in the
    // database — the admin closed the tab instead of tapping Publish.
    expect(plan.rows).toHaveLength(24);
    expect(fake.upserts).toHaveLength(0);
  });

  it("writes nothing when the set is bad, even though most of it was fine", async () => {
    const resolution = resolveAliases({ engine: twentyFour, roster, aliases: [] });
    const decisions: Record<string, string | null> = {};
    for (const q of resolution.questions) {
      decisions[q.engineId] = q.engineName === "Timi" ? "p-timi" : "p-benson";
    }
    const plan = planAliases({ resolution, decisions, roster, aliases: [] });
    // 24 people, two roster members: the duplicate check catches it.
    expect(plan.problems.some((p) => p.kind === "duplicate-person")).toBe(true);

    // A caller that ignored the problems and committed anyway still gets
    // all-or-nothing from the database, because it is one statement.
    fake.upsertResult = { error: { message: "duplicate key value violates unique constraint" } };
    await expect(commitAliasesOrThrow(plan.rows)).rejects.toBeInstanceOf(AliasCommitFailed);
    expect(fake.upserts).toHaveLength(1);
  });
});
