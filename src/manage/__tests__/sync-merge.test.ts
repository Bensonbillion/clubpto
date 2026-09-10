// Two phones, one row: the protocol end to end, against a fake of the
// function's compare-and-set. Clocks are skewed on purpose; nothing here
// may depend on them agreeing.

import { describe, expect, it } from "vitest";
import { createSessionStore, memoryStorage, type Envelope, type KeyValueStorage } from "@/court-manager/persistence";
import { createManageRemote } from "../sync/remote";
import { mergeSessions, type MergeNote } from "../sync/merge";
import type { Match, Session } from "../types";

/* ── the function, in memory ─────────────────────────────────────── */

type Row = { envelope: Envelope<Session>; saved_at: number };

class FakeServer {
  row: Row | null = null;
  /** Every accepted push: the base it named and the version it made. */
  pushes: { base: number | null | "old"; version: number }[] = [];

  private versionOf(): number | null { return this.row ? (this.row.envelope.version ?? 0) : null; }
  private withVersion() { return { ...this.row!.envelope, version: this.versionOf()! }; }

  handle(body: Record<string, unknown>): { data: Record<string, unknown> | null; error: { message: string } | null } {
    if (body.passcode !== "9999") return { data: { error: "wrong passcode" }, error: null };
    if (body.op === "pull") {
      return { data: { envelope: this.row ? this.withVersion() : null, savedAt: this.row?.saved_at ?? null, version: this.versionOf() }, error: null };
    }
    const incoming = body.envelope as Envelope<Session>;
    const knows = Object.prototype.hasOwnProperty.call(body, "baseVersion");
    if (this.row && knows && body.baseVersion !== this.versionOf()) {
      return { data: { stale: true, error: "stale", envelope: this.withVersion(), savedAt: this.row.saved_at, version: this.versionOf() }, error: null };
    }
    if (this.row && !knows && ((this.row.envelope as { cas?: boolean }).cas === true || this.row.saved_at > incoming.savedAt)) {
      // supabase-js turns a 409 into an error with no body.
      return { data: null, error: { message: "stale" } };
    }
    const version = (this.versionOf() ?? 0) + 1;
    const savedAt = this.row ? Math.max(incoming.savedAt, this.row.saved_at + 1) : incoming.savedAt;
    const cas = knows || (this.row?.envelope as { cas?: boolean } | undefined)?.cas === true;
    this.row = { envelope: { ...incoming, savedAt, version, cas } as Envelope<Session>, saved_at: savedAt };
    this.pushes.push({ base: knows ? (body.baseVersion as number | null) : "old", version });
    return { data: { savedAt, version }, error: null };
  }
}

/* ── a phone ─────────────────────────────────────────────────────── */

const settle = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
};

function phone(server: FakeServer, opts: {
  skew?: number; storage?: KeyValueStorage; offline?: () => boolean;
  /** Something to wait on before a push reaches the server. */
  beforePush?: () => Promise<void> | null;
} = {}) {
  const storage = opts.storage ?? memoryStorage();
  let clock = 1_000_000 + (opts.skew ?? 0);
  const now = () => (clock += 1);
  const notes: MergeNote[] = [];
  const remote = createManageRemote({
    instance: "1", passcode: "9999",
    invoke: async (body) => {
      if (opts.offline?.()) return { data: null, error: { message: "offline" } };
      if (body.op === "push") { const wait = opts.beforePush?.(); if (wait) await wait; }
      return server.handle(body) as never;
    },
  });
  let state: Session | null = null;
  const store = createSessionStore<Session>({
    storageKey: "k", schemaVersion: 1, storage, remote, defaults: () => night(),
    merge: (b, l, r) => { const res = mergeSessions(b, l, r); notes.push(...res.notes); return res.state; },
    onRow: (row) => { state = store.reconcile(row, state!, now()); },
  });
  return {
    store, notes, storage,
    get state(): Session { return state!; },
    async load() { const r = await store.load(); state = r.state; return r; },
    commit(fn: (s: Session) => Session) { state = fn(state!); store.save(state, now()); },
    /** The follow tick, as the hook runs it. */
    async tick() {
      if (store.isPushing()) return;
      if (store.isDirty()) { await store.flush(); return; }
      try {
        const row = await remote.pull();
        if (row && store.isNews(row)) state = store.reconcile(row, state!, now());
      } catch { /* offline */ }
    },
  };
}

/* ── a night ─────────────────────────────────────────────────────── */

const live = (id: string, court: number, slot: number, four: [string, string, string, string]): Match => ({
  id, courtNumber: court, matchIndex: slot,
  teamA: [four[0], four[1]], teamB: [four[2], four[3]],
  scoreA: null, scoreB: null, status: "onCourt", startedAt: 1000, completedAt: null, stage: null,
});
const night = (): Session => ({
  id: "night-2026-09-13", dayLabel: "Wednesday", date: "2026-09-13", status: "running",
  players: ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => ({
    id, name: id.toUpperCase(), walkIn: false, courtNumber: i < 4 ? 1 : 2, away: false, joinedAtMatchIndex: null,
  })),
  courts: [
    { number: 1, targetMatches: 4, playoffSeeded: false, champion: null },
    { number: 2, targetMatches: 4, playoffSeeded: false, champion: null },
  ],
  matches: [live("m1", 1, 1, ["a", "b", "c", "d"]), live("m2", 2, 1, ["e", "f", "g", "h"])],
  startedAt: 500, endedAt: null,
});
const score = (id: string, a: number, b: number) => (s: Session): Session => ({
  ...s, matches: s.matches.map((m) => m.id === id ? { ...m, scoreA: a, scoreB: b, status: "played" as const, completedAt: 2000 } : m),
});
const scoreOf = (s: Session, id: string) => { const m = s.matches.find((x) => x.id === id); return m ? [m.scoreA, m.scoreB] : null; };

/** Two phones with the row seeded by the first. */
async function twoPhones(server = new FakeServer(), skewB = 40 * 60 * 1000) {
  const A = phone(server);
  await A.load();
  A.commit(() => night());
  await settle();
  const B = phone(server, { skew: -skewB });
  await B.load();
  return { server, A, B };
}

describe("the defect: two scores in one window", () => {
  it("a score on each phone from the same base both land, and every phone converges", async () => {
    const { server, A, B } = await twoPhones();
    expect(server.row?.envelope.version).toBe(1);
    expect(B.state).toEqual(A.state);

    A.commit(score("m1", 7, 5));
    B.commit(score("m2", 6, 7));
    await settle();
    // Whichever landed second was refused, merged and pushed again.
    expect(server.pushes.map((p) => p.version)).toEqual([1, 2, 3]);
    expect(server.pushes.map((p) => p.base)).toEqual([null, 1, 2]);
    const row = server.row!.envelope.state;
    expect(scoreOf(row, "m1")).toEqual([7, 5]);
    expect(scoreOf(row, "m2")).toEqual([6, 7]);

    await A.tick(); await B.tick(); await settle();
    expect(A.state).toEqual(row);
    expect(B.state).toEqual(row);
    expect(A.store.isDirty()).toBe(false);
    expect(B.store.isDirty()).toBe(false);
    expect(A.notes).toEqual([]);
    expect(B.notes).toEqual([]);
  });

  it("clocks forty minutes apart change nothing, and the row's savedAt only rises", async () => {
    const { server, A, B } = await twoPhones();
    const seen: number[] = [server.row!.saved_at];
    B.commit(score("m2", 6, 7)); await settle(); seen.push(server.row!.saved_at);
    A.commit(score("m1", 7, 5)); await settle(); seen.push(server.row!.saved_at);
    await A.tick(); await B.tick(); await settle();
    expect(seen).toEqual([...seen].sort((x, y) => x - y));
    expect(new Set(seen).size).toBe(3);
    expect(A.state).toEqual(B.state);
    expect(scoreOf(A.state, "m1")).toEqual([7, 5]);
    expect(scoreOf(A.state, "m2")).toEqual([6, 7]);
  });

  it("the same game scored differently: the first to land stands, the other phone is told", async () => {
    const { server, A, B } = await twoPhones();
    A.commit(score("m1", 7, 5));
    await settle();
    B.commit(score("m1", 3, 7));
    await settle();
    expect(scoreOf(server.row!.envelope.state, "m1")).toEqual([7, 5]);
    expect(scoreOf(B.state, "m1")).toEqual([7, 5]);
    expect(B.notes[0]).toMatchObject({ kind: "resultKept", courtNumber: 1 });
    expect(A.notes).toEqual([]);
  });
});

describe("three phones", () => {
  it("a chain of stale pushes with a late tap: every edit reaches every phone", async () => {
    const { server, A, B } = await twoPhones();
    const C = phone(server, { skew: 12345 });
    await C.load();

    A.commit(score("m1", 7, 5));
    B.commit(score("m2", 6, 7));
    C.commit((s) => ({ ...s, players: s.players.map((p) => p.id === "h" ? { ...p, away: true } : p) }));
    await settle();
    // A taps during the window, then everyone ticks.
    A.commit((s) => ({ ...s, dayLabel: "Wednesday night" }));
    await settle();
    for (const p of [A, B, C]) await p.tick();
    await settle();
    for (const p of [A, B, C]) await p.tick();
    await settle();

    const row = server.row!.envelope.state;
    expect(scoreOf(row, "m1")).toEqual([7, 5]);
    expect(scoreOf(row, "m2")).toEqual([6, 7]);
    expect(row.players.find((p) => p.id === "h")?.away).toBe(true);
    expect(row.dayLabel).toBe("Wednesday night");
    for (const p of [A, B, C]) expect(p.state).toEqual(row);
    // The row's history is one straight line.
    const versions = server.pushes.map((p) => p.version);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
    for (let i = 1; i < server.pushes.length; i++) expect(server.pushes[i].base).toBe(server.pushes[i - 1].version);
  });
});

describe("a phone that was away", () => {
  it("offline taps, a reload while offline, then reconnecting: nothing lost on either side", async () => {
    const server = new FakeServer();
    let bOffline = false;
    const A = phone(server);
    await A.load();
    A.commit(() => night());
    await settle();
    const storageB = memoryStorage();
    const B1 = phone(server, { storage: storageB, offline: () => bOffline });
    await B1.load();

    bOffline = true;
    B1.commit(score("m2", 6, 7));
    B1.commit((s) => ({ ...s, players: s.players.map((p) => p.id === "e" ? { ...p, away: true } : p) }));
    await settle();
    expect(B1.store.syncStatus()).toBe("error");
    // Meanwhile the row moves on.
    A.commit(score("m1", 7, 5));
    await settle();

    // B reloads while still offline: local copy, still dirty, still owed.
    const B2 = phone(server, { storage: storageB, offline: () => bOffline });
    const loaded = await B2.load();
    expect(loaded.source).toBe("local");
    expect(B2.store.isDirty()).toBe(true);
    expect(B2.store.knownVersion()).toBe(1);

    bOffline = false;
    await B2.tick();
    await settle();
    const row = server.row!.envelope.state;
    expect(scoreOf(row, "m1")).toEqual([7, 5]);
    expect(scoreOf(row, "m2")).toEqual([6, 7]);
    expect(row.players.find((p) => p.id === "e")?.away).toBe(true);
    expect(B2.store.isDirty()).toBe(false);
    await A.tick();
    expect(A.state).toEqual(row);
  });

  it("a save during a push is chased against the new base, never refused", async () => {
    const server = new FakeServer();
    let release: (() => void) | null = null;
    let holdNext = false;
    const A = phone(server, {
      beforePush: () => holdNext ? new Promise<void>((r) => { release = r; holdNext = false; }) : null,
    });
    await A.load();
    A.commit(() => night());
    await settle();
    holdNext = true;
    A.commit(score("m1", 7, 5));
    await settle(2);
    expect(A.store.isPushing()).toBe(true);
    // A second tap while the first is in flight.
    A.commit(score("m2", 6, 7));
    release!();
    await settle();
    expect(server.pushes.map((p) => [p.base, p.version])).toEqual([[null, 1], [1, 2], [2, 3]]);
    expect(A.store.isDirty()).toBe(false);
    expect(scoreOf(server.row!.envelope.state, "m1")).toEqual([7, 5]);
    expect(scoreOf(server.row!.envelope.state, "m2")).toEqual([6, 7]);
  });
});

describe("the store on its own", () => {
  it("adopt writes local and the base, marks synced, and pushes nothing", async () => {
    const pushes: number[] = [];
    const storage = memoryStorage();
    const store = createSessionStore<Session>({
      storageKey: "k", schemaVersion: 1, storage,
      remote: { push: async (e) => { pushes.push(e.savedAt); return { accepted: true, version: 1, savedAt: e.savedAt }; }, pull: async () => null },
      defaults: () => night(),
    });
    await store.load();
    expect(store.knownVersion()).toBeNull();
    store.adopt({ schemaVersion: 1, savedAt: 42, version: 7, state: { ...night(), dayLabel: "Sunday" } });
    expect(store.knownVersion()).toBe(7);
    expect(JSON.parse(storage.getItem("k")!).state.dayLabel).toBe("Sunday");
    expect(JSON.parse(storage.getItem("k.base")!).version).toBe(7);
    expect(store.syncStatus()).toBe("synced");
    expect(store.isDirty()).toBe(false);
    expect(pushes).toEqual([]);
  });

  it("load takes a row this phone has not agreed with, so a phone that was away does not roll the night back", async () => {
    const storage = memoryStorage();
    storage.setItem("k", JSON.stringify({ schemaVersion: 1, savedAt: 10, version: 1, state: { ...night(), dayLabel: "stale" } }));
    const store = createSessionStore<Session>({
      storageKey: "k", schemaVersion: 1, storage,
      remote: { push: async () => { throw new Error("no"); }, pull: async () => ({ schemaVersion: 1, savedAt: 20, version: 2, state: { ...night(), dayLabel: "fresh" } }) },
      defaults: () => night(),
    });
    const { state, source } = await store.load();
    expect(source).toBe("remote");
    expect(state.dayLabel).toBe("fresh");
    expect(store.knownVersion()).toBe(2);
  });

  it("without versions on either side the clock is all there is, as before", () => {
    const store = createSessionStore<Session>({
      storageKey: "k", schemaVersion: 1, storage: memoryStorage(), remote: null, defaults: () => night(),
    });
    store.adopt({ schemaVersion: 1, savedAt: 10, state: night() });
    expect(store.isNews({ schemaVersion: 1, savedAt: 11, state: night() })).toBe(true);
    expect(store.isNews({ schemaVersion: 1, savedAt: 9, state: night() })).toBe(false);
  });
});

describe("whole-night operations", () => {
  it("start over on one phone while the other scores: the restart stands and the scorer is told", async () => {
    const { server, A, B } = await twoPhones();
    A.commit((s) => ({ ...s, matches: [], startedAt: 9000 }));
    B.commit(score("m2", 6, 7));
    await settle();
    await A.tick(); await B.tick(); await settle();
    expect(server.row!.envelope.state.matches).toEqual([]);
    expect(B.state.matches).toEqual([]);
    expect(B.notes).toContainEqual({ kind: "nightReplaced" });
    expect(A.state).toEqual(B.state);
  });
});

describe("a phone still on the old bundle", () => {
  const oldPush = (server: FakeServer, state: Session) => server.handle({
    op: "push", instance: "1", passcode: "9999",
    envelope: { schemaVersion: 1, savedAt: (server.row?.saved_at ?? 0) + 5, state },
  });

  it("writes as it always did until a merge-aware phone has written the row, and its writes are versioned", async () => {
    const server = new FakeServer();
    expect(oldPush(server, night()).data).toMatchObject({ version: 1 });
    expect(oldPush(server, score("m1", 7, 5)(night())).data).toMatchObject({ version: 2 });
    expect(server.row!.envelope.version).toBe(2);
    expect((server.row!.envelope as { cas?: boolean }).cas).toBe(false);
  });

  it("can only follow once a merge-aware phone has written: its push is refused, and the newer phone's tap stands", async () => {
    const server = new FakeServer();
    oldPush(server, night());
    const A = phone(server);
    await A.load();
    expect(A.store.knownVersion()).toBe(1);
    A.commit(score("m1", 7, 5));
    await settle();
    expect(server.row!.envelope.version).toBe(2);
    // The old phone, which never saw that tap, pushes its own copy wholesale.
    const reply = oldPush(server, score("m2", 6, 7)(night()));
    expect(reply.data).toBeNull();
    expect(reply.error?.message).toBe("stale");
    const row = server.row!.envelope.state;
    expect(scoreOf(row, "m1")).toEqual([7, 5]);
    expect(server.row!.envelope.version).toBe(2);
    // It still follows: the row's savedAt keeps rising past its own.
    const pulled = server.handle({ op: "pull", instance: "1", passcode: "9999" }).data as { envelope: Envelope<Session> };
    expect(pulled.envelope.savedAt).toBeGreaterThan(5);
  });
});

describe("the remote adapter", () => {
  it("names the base it pushed against and reads a refusal as the row, not an error", async () => {
    const server = new FakeServer();
    const calls: Record<string, unknown>[] = [];
    const remote = createManageRemote({
      instance: "2", passcode: "9999",
      invoke: async (body) => { calls.push(body); return server.handle({ ...body, instance: "1" }) as never; },
    });
    const first = await remote.push({ schemaVersion: 1, savedAt: 5, state: night() }, null);
    expect(first).toEqual({ accepted: true, version: 1, savedAt: 5 });
    expect(calls[0]).toMatchObject({ op: "push", instance: "2", passcode: "9999", baseVersion: null });
    const refused = await remote.push({ schemaVersion: 1, savedAt: 6, state: night() }, null);
    expect(refused.accepted).toBe(false);
    expect("row" in refused ? refused.row?.version : null).toBe(1);
    const pulled = await remote.pull();
    expect(pulled?.version).toBe(1);
  });

  it("a wrong passcode is an error, never a silent success", async () => {
    const remote = createManageRemote({
      instance: "1", passcode: "0000",
      invoke: async () => ({ data: { error: "wrong passcode" }, error: null }),
    });
    await expect(remote.pull()).rejects.toThrow("wrong passcode");
  });
});
