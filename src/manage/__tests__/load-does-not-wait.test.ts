// The night comes back before the wifi does.
//
// THE FAILURE THIS IS ABOUT. The operator reloads at nine o'clock on The
// District's wifi, which is a captive portal that holds a request open rather
// than refusing it. `load()` read the local night synchronously and then
// awaited the row before returning it, so for as long as the portal held on
// (sync/remote.ts REMOTE_TIMEOUT_MS is ten seconds) the app had no session to
// show. What it showed instead was the empty door: "No night is running.
// Start one and the app walks you through it", with Start tonight live under
// it, over a night that was sitting intact in localStorage the whole time.
//
// The local copy is the thing this app is built around. It is written
// synchronously before anything else on every save, precisely so that the
// venue's wifi is never between the operator and their own night. Waiting on
// the row to hand it back gave that away at the one moment it mattered.
//
// Reconciling still happens. It happens in the background, through the same
// `onRow` the poll already uses, so a row that has moved on lands as a merge
// against whatever is on screen by then, including taps made while the portal
// was still thinking.

import { describe, expect, it, vi } from "vitest";
import { createSessionStore, memoryStorage, type Envelope, type RemoteSync } from "@/court-manager/persistence";

type Night = { games: string[] };
const EMPTY: Night = { games: [] };

const KEY = "cm_manage_session";
const SCHEMA = 1;

/** A local night already on this phone, as a save would have left it. */
const seeded = (storage: ReturnType<typeof memoryStorage>, night: Night, version: number | null = 1) => {
  const env: Envelope<Night> = { schemaVersion: SCHEMA, savedAt: 1000, state: night, ...(version == null ? {} : { version }) };
  storage.setItem(KEY, JSON.stringify(env));
  storage.setItem(`${KEY}.base`, JSON.stringify(env));
};

/** A remote whose pull never answers, which is what a captive portal does. */
const portal = (): RemoteSync<Night> & { pulls: number } => ({
  pulls: 0,
  push: async () => ({ accepted: true as const, version: 1, savedAt: 1 }),
  pull: function (this: { pulls: number }) { this.pulls += 1; return new Promise<never>(() => {}); },
});

/** A remote that answers, but only when told to. */
const slow = (row: Envelope<Night> | null) => {
  let release!: (v: Envelope<Night> | null) => void;
  const answered = new Promise<Envelope<Night> | null>((res) => { release = res; });
  return {
    remote: {
      push: async () => ({ accepted: true as const, version: 9, savedAt: 9 }),
      pull: () => answered,
    } as RemoteSync<Night>,
    answer: () => release(row),
  };
};

const store = (storage: ReturnType<typeof memoryStorage>, remote: RemoteSync<Night> | null, onRow?: (r: Envelope<Night>) => void) =>
  createSessionStore<Night>({
    storageKey: KEY, schemaVersion: SCHEMA, storage, remote,
    defaults: () => EMPTY,
    merge: (_base, local, row) => ({ games: [...new Set([...local.games, ...row.games])] }),
    onRow,
  });

/** Did `p` settle before the clock ran out? */
const settledWithin = async <V,>(p: Promise<V>, ms: number): Promise<{ done: true; value: V } | { done: false }> =>
  Promise.race([
    p.then((value) => ({ done: true as const, value })),
    new Promise<{ done: false }>((res) => setTimeout(() => res({ done: false as const }), ms)),
  ]);

describe("a night already on this phone does not wait on the row", () => {
  it("hands back the local night while the portal is still holding the pull", async () => {
    const storage = memoryStorage();
    seeded(storage, { games: ["g1", "g2", "g3"] });
    const s = store(storage, portal());

    const got = await settledWithin(s.load(), 100);
    expect(got.done, "load() is still waiting on the network").toBe(true);
    if (!got.done) return;
    expect(got.value.source).toBe("local");
    expect(got.value.state.games).toEqual(["g1", "g2", "g3"]);
  });

  it("still asks the row, and still reconciles when the answer arrives", async () => {
    // Returning early must not mean going it alone. The row is still pulled,
    // and news still reaches the caller, just not on the critical path.
    const storage = memoryStorage();
    seeded(storage, { games: ["g1"] });
    const onRow = vi.fn();
    const { remote, answer } = slow({ schemaVersion: SCHEMA, savedAt: 5000, state: { games: ["g1", "g2"] }, version: 7 });
    const s = store(storage, remote, onRow);

    const got = await settledWithin(s.load(), 100);
    expect(got.done).toBe(true);
    expect(onRow).not.toHaveBeenCalled();

    answer();
    await new Promise((r) => setTimeout(r, 20));
    expect(onRow).toHaveBeenCalledTimes(1);
    expect(onRow.mock.calls[0][0].state.games).toEqual(["g1", "g2"]);
  });

  it("a phone with NOTHING local still waits, because it has nothing to show", async () => {
    // The guard. Returning defaults early here is the dangerous direction:
    // an empty session handed back before the row has answered is what makes
    // the door offer to start a night over one that already exists.
    const storage = memoryStorage();
    const s = store(storage, portal());
    const got = await settledWithin(s.load(), 60);
    expect(got.done, "a phone with no local copy must wait for the row").toBe(false);
  });
});
