import { beforeEach, describe, expect, it, vi } from "vitest";

// One mutable fake client the tests reconfigure per case.
const fake = {
  readResult: { data: null as unknown, error: null as { message: string } | null },
  insertResult: { error: null as { message: string } | null },
  inserted: null as Record<string, unknown> | null,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => fake.readResult,
        }),
      }),
      insert: async (row: Record<string, unknown>) => {
        fake.inserted = { ...row, __table: table };
        return fake.insertResult;
      },
    }),
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
  },
}));

const { archiveGameStateRow, ArchiveFailed } = await import("./archive");

describe("archive before reset (C7)", () => {
  beforeEach(() => {
    fake.readResult = { data: null, error: null };
    fake.insertResult = { error: null };
    fake.inserted = null;
  });

  it("copies the row into the archive and reports what it saved", async () => {
    fake.readResult = {
      data: { state: { players: [1, 2, 3] }, updated_at: "2026-08-12T23:57:58.976Z" },
      error: null,
    };
    const out = await archiveGameStateRow("cm_v3_session", "v3 resetSession");
    expect(out.archivedAt).not.toBeNull();
    expect(out.bytes).toBeGreaterThan(0);
    expect(fake.inserted).toMatchObject({
      __table: "game_state_archive",
      row_id: "cm_v3_session",
      source_updated_at: "2026-08-12T23:57:58.976Z",
      archived_by: "admin-1",
      reason: "v3 resetSession",
    });
  });

  it("THROWS when the archive insert fails — this is what blocks the reset", async () => {
    fake.readResult = { data: { state: { players: [] }, updated_at: null }, error: null };
    fake.insertResult = { error: { message: "new row violates row-level security policy" } };
    await expect(archiveGameStateRow("cm_v3_session")).rejects.toBeInstanceOf(ArchiveFailed);
  });

  it("THROWS when the session cannot even be read", async () => {
    fake.readResult = { data: null, error: { message: "network down" } };
    await expect(archiveGameStateRow("cm_v4_session")).rejects.toBeInstanceOf(ArchiveFailed);
  });

  it("allows a reset when there is genuinely nothing stored yet", async () => {
    fake.readResult = { data: null, error: null };
    const out = await archiveGameStateRow("cm_v4_session");
    expect(out.archivedAt).toBeNull();
    expect(fake.inserted).toBeNull(); // nothing written, and no throw
  });

  it("never writes a partial row: a read failure inserts nothing", async () => {
    fake.readResult = { data: null, error: { message: "boom" } };
    await expect(archiveGameStateRow("cm_v3_session")).rejects.toThrow();
    expect(fake.inserted).toBeNull();
  });
});
