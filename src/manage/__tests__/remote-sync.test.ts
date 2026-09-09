// The shared row: a night reaching a second phone.

import { describe, expect, it } from "vitest";
import { createSessionStore, memoryStorage, type Envelope } from "@/court-manager/persistence";
import { createManageRemote } from "../sync/remote";
import type { Session } from "../types";

const night = (dayLabel: string): Session => ({
  id: "n", dayLabel, date: "2026-09-13", status: "running",
  players: [], courts: [], matches: [], startedAt: 1, endedAt: null,
});

describe("the remote adapter speaks to the function honestly", () => {
  it("pushes the envelope with the instance and passcode, pulls what the row holds", async () => {
    const calls: Record<string, unknown>[] = [];
    const row: { envelope: Envelope<Session> | null } = { envelope: null };
    const remote = createManageRemote({
      instance: "2", passcode: "9999",
      invoke: async (body) => {
        calls.push(body);
        if (body.op === "push") { row.envelope = body.envelope as Envelope<Session>; return { data: { savedAt: 5 }, error: null }; }
        return { data: { envelope: row.envelope }, error: null };
      },
    });
    await remote.push({ schemaVersion: 1, savedAt: 5, state: night("Sunday") });
    expect(calls[0]).toMatchObject({ op: "push", instance: "2", passcode: "9999" });
    const pulled = await remote.pull();
    expect(pulled?.state.dayLabel).toBe("Sunday");
  });

  it("a refusal from the function is an error, never a silent success", async () => {
    const remote = createManageRemote({
      instance: "1", passcode: "0000",
      invoke: async () => ({ data: { error: "wrong passcode" }, error: null }),
    });
    await expect(remote.pull()).rejects.toThrow("wrong passcode");
  });
});

describe("a follower adopts a newer row without echoing it back", () => {
  it("adopt writes local, updates latestSavedAt, and marks synced; nothing is pushed", async () => {
    const pushes: number[] = [];
    const storage = memoryStorage();
    const store = createSessionStore<Session>({
      storageKey: "k", schemaVersion: 1, storage,
      remote: { push: async (e) => { pushes.push(e.savedAt); }, pull: async () => null },
      defaults: () => night(""),
    });
    await store.load();
    expect(store.latestSavedAt()).toBeNull();
    store.adopt({ schemaVersion: 1, savedAt: 42, state: night("Wednesday") });
    expect(store.latestSavedAt()).toBe(42);
    expect(JSON.parse(storage.getItem("k")!).state.dayLabel).toBe("Wednesday");
    expect(store.syncStatus()).toBe("synced");
    expect(pushes).toEqual([]);
  });

  it("load takes the newer of local and row, so a phone that was away does not roll the night back", async () => {
    const storage = memoryStorage();
    storage.setItem("k", JSON.stringify({ schemaVersion: 1, savedAt: 10, state: night("stale") }));
    const store = createSessionStore<Session>({
      storageKey: "k", schemaVersion: 1, storage,
      remote: { push: async () => {}, pull: async () => ({ schemaVersion: 1, savedAt: 20, state: night("fresh") }) },
      defaults: () => night(""),
    });
    const { state, source } = await store.load();
    expect(source).toBe("remote");
    expect(state.dayLabel).toBe("fresh");
    expect(store.latestSavedAt()).toBe(20);
  });
});
