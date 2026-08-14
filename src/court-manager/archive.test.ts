import { beforeEach, describe, expect, it, vi } from "vitest";

// One mutable fake client the tests reconfigure per case.
const fake = {
  readResult: { data: null as unknown, error: null as { message: string } | null },
  // Insert outcomes are consumed in order, so a test can fail the SECOND
  // write (the local copy) while the first succeeds.
  insertResults: [] as Array<{ error: { message: string } | null }>,
  inserted: [] as Record<string, unknown>[],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => fake.readResult }) }),
      insert: async (row: Record<string, unknown>) => {
        fake.inserted.push({ ...row, __table: table });
        return fake.insertResults.shift() ?? { error: null };
      },
    }),
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
  },
}));

const { archiveGameStateRow, ArchiveFailed } = await import("./archive");

const envelope = (n: number) => ({ schemaVersion: 5, savedAt: n, state: { players: [n] } });
const sourcesOf = () => fake.inserted.map((r) => String(r.reason).split(" ")[0]);

describe("archive before reset (C7)", () => {
  beforeEach(() => {
    fake.readResult = { data: null, error: null };
    fake.insertResults = [];
    fake.inserted = [];
  });

  it("copies the remote row and reports what it saved", async () => {
    fake.readResult = {
      data: { state: envelope(1), updated_at: "2026-08-12T23:57:58.976Z" },
      error: null,
    };
    const out = await archiveGameStateRow("cm_v3_session", { label: "v3 resetSession" });
    expect(out.archived).toHaveLength(1);
    expect(out.archived[0].source).toBe("remote");
    expect(fake.inserted[0]).toMatchObject({
      __table: "game_state_archive",
      row_id: "cm_v3_session",
      source_updated_at: "2026-08-12T23:57:58.976Z",
      archived_by: "admin-1",
      reason: "remote — v3 resetSession",
    });
  });

  it("THROWS when the archive insert fails — this is what blocks the reset", async () => {
    fake.readResult = { data: { state: envelope(1), updated_at: null }, error: null };
    fake.insertResults = [{ error: { message: "new row violates row-level security policy" } }];
    await expect(archiveGameStateRow("cm_v3_session")).rejects.toBeInstanceOf(ArchiveFailed);
  });

  it("THROWS when the session cannot even be read", async () => {
    fake.readResult = { data: null, error: { message: "network down" } };
    await expect(archiveGameStateRow("cm_v4_session")).rejects.toBeInstanceOf(ArchiveFailed);
  });

  it("never writes a partial row: a read failure inserts nothing", async () => {
    fake.readResult = { data: null, error: { message: "boom" } };
    await expect(archiveGameStateRow("cm_v3_session")).rejects.toThrow();
    expect(fake.inserted).toHaveLength(0);
  });
});

describe("both copies get archived (C7a)", () => {
  beforeEach(() => {
    fake.readResult = { data: null, error: null };
    fake.insertResults = [];
    fake.inserted = [];
  });

  // The case that made C7a urgent: a push has been failing since 7pm, so the
  // remote row is EMPTY while the device holds the whole night. The old
  // "nothing stored yet" early return would have cleared the only copy.
  it("archives the local envelope when remote is empty", async () => {
    fake.readResult = { data: null, error: null };
    const out = await archiveGameStateRow("cm_v3_session", { local: envelope(7) });
    expect(out.archived).toHaveLength(1);
    expect(out.archived[0].source).toBe("local");
    expect(fake.inserted).toHaveLength(1);
    expect(fake.inserted[0]).toMatchObject({ reason: "local" });
  });

  it("BLOCKS the reset when that local-only archive fails", async () => {
    fake.readResult = { data: null, error: null };
    fake.insertResults = [{ error: { message: "rls" } }];
    await expect(
      archiveGameStateRow("cm_v3_session", { local: envelope(7) })
    ).rejects.toBeInstanceOf(ArchiveFailed);
  });

  it("archives BOTH when a stale tab differs from a newer remote", async () => {
    fake.readResult = { data: { state: envelope(9), updated_at: "2026-08-14T00:00:00Z" }, error: null };
    const out = await archiveGameStateRow("cm_v4_session", { local: envelope(2), label: "v4 resetNight" });
    expect(out.archived).toHaveLength(2);
    expect(sourcesOf()).toEqual(["remote", "local"]);
    // Distinct timestamps, or unique (row_id, archived_at) would reject one.
    expect(out.archived[0].archivedAt).not.toBe(out.archived[1].archivedAt);
  });

  it("BLOCKS when the second (local) insert fails, even though the first succeeded", async () => {
    fake.readResult = { data: { state: envelope(9), updated_at: null }, error: null };
    fake.insertResults = [{ error: null }, { error: { message: "rls" } }];
    await expect(
      archiveGameStateRow("cm_v4_session", { local: envelope(2) })
    ).rejects.toBeInstanceOf(ArchiveFailed);
    expect(sourcesOf()).toEqual(["remote", "local"]); // both attempted
  });

  it("writes one row when the device is already in sync", async () => {
    const same = envelope(4);
    fake.readResult = { data: { state: same, updated_at: null }, error: null };
    const out = await archiveGameStateRow("cm_v3_session", { local: same });
    expect(out.archived).toHaveLength(1);
    expect(out.archived[0].source).toBe("remote");
  });

  it("returns cleanly ONLY when remote and memory are both empty", async () => {
    fake.readResult = { data: null, error: null };
    const out = await archiveGameStateRow("cm_v4_session", { local: null });
    expect(out.archived).toEqual([]);
    expect(fake.inserted).toHaveLength(0);
  });
});
