// Court Manager v2, localStorage-first persistence (§12).
//
// The venue's wifi is the least reliable component in the stack. During a live
// session THE TABLET IS THE SOURCE OF TRUTH:
//   1. Every state change writes to local storage synchronously, first.
//   2. Remote (Supabase) syncs in the background; a pending indicator tells the
//      admin when the last write hasn't reached the server yet.
//   3. Load order: active local session → remote → defaults, last resort.
//
// Two phones on one night. The shared row is a straight line of versions,
// stamped by the server, and every accepted push is a compare-and-set
// against the version this phone last agreed with (its BASE). A push that
// arrives against a moved row is refused with the row, and the store
// merges: merge(base, local, row) keeps what each side changed. The same
// merge runs when the poll finds the row moved while this phone holds
// unpushed taps. No wall clock decides anything; the version does.
//
// Storage and remote are injected interfaces so this layer tests headlessly
// and the Supabase adapter stays a thin, separate concern. The storage key is
// NEW: it never touches the legacy game_state rows used by live /manage.

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Envelope<T> {
  schemaVersion: number;
  savedAt: number; // epoch ms
  state: T;
  /**
   * The server's counter for this copy. Present exactly when this envelope
   * is (or equals) a row the server confirmed; a local envelope without one
   * holds unpushed taps. Absent on rows written before versions existed,
   * which read as 0.
   */
  version?: number;
}

/** What the server said to a push. */
export type PushReply<T> =
  | { accepted: true; version: number | null; savedAt: number }
  /** Refused because the row moved past baseVersion; here is the row. */
  | { accepted: false; row: Envelope<T> | null };

export interface RemoteSync<T> {
  /** Compare-and-set against baseVersion, null for a phone that has seen no row. */
  push(envelope: Envelope<T>, baseVersion: number | null): Promise<PushReply<T>>;
  pull(): Promise<Envelope<T> | null>;
}

export type SyncStatus = "synced" | "pending" | "error";

export interface SessionStore<T> {
  /** Synchronous local write FIRST, then a background remote push. */
  save(state: T, nowMs: number): void;
  /** local → remote → defaults. Never throws; wifi failures degrade gracefully. */
  load(): Promise<{ state: T; source: "local" | "remote" | "merged" | "defaults" }>;
  /**
   * When the copy this device holds was saved, or null before anything was
   * loaded or saved. Display only: nothing decides on it any more.
   */
  latestSavedAt(): number | null;
  /** The version this phone last agreed with the row on, or null. */
  knownVersion(): number | null;
  /** Unpushed taps on this phone. */
  isDirty(): boolean;
  /** A push is in flight. */
  isPushing(): boolean;
  /** Whether a pulled row is news: a version this phone has not agreed with. */
  isNews(row: Envelope<T>): boolean;
  /**
   * Take a row as this device's own copy: written locally, remembered as
   * the base, never pushed back. The clean follower's write path.
   */
  adopt(envelope: Envelope<T>): void;
  /**
   * Bring a row this phone has not agreed with into line with what this
   * phone shows. Clean: the row is adopted whole. Dirty: merge(base,
   * current, row) becomes the local copy, the row becomes the base, and
   * the merge is pushed against the row's version. Returns the state to
   * show. Meant to run INSIDE the caller's state updater, so a tap queued
   * behind it lands on the merged state rather than under it.
   */
  reconcile(row: Envelope<T>, current: T, nowMs: number): T;
  /** Retry the remote push of the latest local state (call on a timer/reconnect). */
  flush(): Promise<void>;
  syncStatus(): SyncStatus;
  /** Clear the local session and its base (end-of-night reset). Remote copy untouched. */
  clearLocal(): void;
}

export interface SessionStoreConfig<T> {
  storageKey: string;
  schemaVersion: number;
  storage: KeyValueStorage;
  remote: RemoteSync<T> | null;
  defaults: () => T;
  /**
   * Upgrade an older-schema state instead of discarding it. Return null only
   * when the old shape is truly unusable: silent data loss on version bumps
   * is exactly the "vanished roster" bug class (§13: completed data is sacred).
   */
  migrate?: (oldState: unknown, oldVersion: number) => T | null;
  /**
   * merge(base, local, row): the three-way merge. Without one, a refused
   * push and a moved row both fall back to the row (today's newest wins).
   */
  merge?: (base: T | null, local: T, remote: T) => T;
  /**
   * A refused push handed back the row and this phone is dirty. The caller
   * runs `reconcile(row, current, now)` inside its own state updater. Without
   * this, the store reconciles against its latest copy itself.
   */
  onRow?: (row: Envelope<T>) => void;
  onSyncStatusChange?: (status: SyncStatus) => void;
}

/** Consecutive refusals before the store stops chasing and says error. */
const STALE_LIMIT = 5;

/** Equality that does not care about key order: jsonb reorders keys. */
const canon = (v: unknown): string => {
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort()
    .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
};

export function createSessionStore<T>(config: SessionStoreConfig<T>): SessionStore<T> {
  let status: SyncStatus = "synced";
  let pushing = false;
  let latest: Envelope<T> | null = null;
  let base: Envelope<T> | null = null;
  let staleStreak = 0;
  /**
   * A refused push's row has been handed to the caller and not yet
   * reconciled. Pushing the same stale copy again in the meantime would only
   * be refused again, so the chase waits for reconcile.
   */
  let awaitingRow = false;
  const baseKey = `${config.storageKey}.base`;

  const setStatus = (s: SyncStatus) => {
    if (status !== s) {
      status = s;
      config.onSyncStatusChange?.(s);
    }
  };

  const upgrade = (env: Envelope<T> | null): Envelope<T> | null => {
    if (!env) return null;
    if (env.schemaVersion === config.schemaVersion) return env;
    const migrated = config.migrate?.(env.state, env.schemaVersion);
    if (migrated == null) return null;
    return { ...env, schemaVersion: config.schemaVersion, state: migrated };
  };

  const read = (key: string): Envelope<T> | null => {
    try {
      const raw = config.storage.getItem(key);
      if (!raw) return null;
      return upgrade(JSON.parse(raw) as Envelope<T>);
    } catch {
      return null;
    }
  };

  /** Best effort; a blocked storage never throws out of here. */
  const write = (key: string, env: Envelope<T>): boolean => {
    try {
      config.storage.setItem(key, JSON.stringify(env));
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  };

  const dirty = () => latest != null && latest.version == null;
  const versionOf = (env: Envelope<T> | null): number | null =>
    env == null ? null : (env.version ?? 0);

  /** The row is what this phone shows and agrees with. */
  const takeRow = (row: Envelope<T>) => {
    latest = row;
    base = row;
    write(config.storageKey, row);
    write(baseKey, row);
  };

  const pushLatest = async (): Promise<void> => {
    if (!config.remote || !latest || pushing || awaitingRow || !dirty()) return;
    pushing = true;
    try {
      const pushed = latest;
      const reply = await config.remote.push(pushed, versionOf(base));
      if (reply.accepted) {
        staleStreak = 0;
        const confirmed: Envelope<T> = { ...pushed, version: reply.version ?? 0, savedAt: reply.savedAt };
        base = confirmed;
        write(baseKey, confirmed);
        // Only mark synced if nothing newer arrived while we were pushing.
        if (latest === pushed) {
          latest = confirmed;
          write(config.storageKey, confirmed);
          setStatus("synced");
        }
      } else {
        const row = "row" in reply ? reply.row : null;
        staleStreak += 1;
        if (!row || staleStreak > STALE_LIMIT) {
          setStatus("error");
        } else if (config.onRow) {
          awaitingRow = true;
          config.onRow(row);
        } else {
          reconcile(row, latest.state, Date.now());
        }
      }
    } catch {
      setStatus("error");
    } finally {
      pushing = false;
      // A newer write landed mid-push, or a merge wants out: chase it.
      if (dirty() && staleStreak <= STALE_LIMIT && status !== "error") void pushLatest();
    }
  };

  const reconcile = (rowIn: Envelope<T>, current: T, nowMs: number): T => {
    awaitingRow = false;
    const row = upgrade(rowIn);
    if (!row) return current;
    if (!dirty()) {
      takeRow(row);
      setStatus("synced");
      return row.state;
    }
    const merge = config.merge ?? ((_b: T | null, _l: T, r: T) => r);
    const merged = merge(base?.state ?? null, current, row.state);
    // The local copy is written BEFORE the base. A page that dies between
    // the two writes then leaves the merged copy (which holds the row's
    // changes) over an older base, and the next load merges again, which is
    // idempotent. The other order would leave the old dirty copy over a
    // base equal to the row, and the next load would push that old copy
    // against the row's version, accepted, the other phone's work gone.
    if (canon(merged) === canon(row.state)) {
      // Nothing of this phone's survived the merge as a difference: the row
      // is the whole story, and there is nothing to push.
      latest = row;
      write(config.storageKey, row);
      base = row;
      write(baseKey, row);
      setStatus("synced");
      return row.state;
    }
    latest = {
      schemaVersion: config.schemaVersion,
      savedAt: Math.max(nowMs, row.savedAt + 1),
      state: merged,
    };
    write(config.storageKey, latest);
    base = row;
    write(baseKey, row);
    setStatus("pending");
    void pushLatest();
    return merged;
  };

  return {
    save(state, nowMs) {
      const envelope: Envelope<T> = {
        schemaVersion: config.schemaVersion,
        // Never behind the base, so a tap in the same millisecond as a push
        // still reads as newer on a phone comparing clocks.
        savedAt: Math.max(nowMs, (base?.savedAt ?? 0) + 1),
        state,
      };
      // Keep the in-memory copy FIRST so the remote mirror still has it even if
      // the local write fails.
      latest = envelope;
      staleStreak = 0;
      if (!write(config.storageKey, envelope)) {
        // Storage blocked (Safari Private Browsing, quota, disabled). This runs
        // inside a React setState updater: if it threw, the render phase would
        // blow up and white-screen the live board. Flag the error, fall back
        // to the in-memory + remote copies, never crash.
        if (config.remote) void pushLatest();
        return;
      }
      // Local-only mode (no remote configured): the local write IS the sync.
      setStatus(config.remote ? "pending" : "synced");
      if (config.remote) void pushLatest();
    },

    async load() {
      const local = read(config.storageKey);
      base = read(baseKey);
      // A local copy with a version but no base is a row this phone once
      // agreed with (or a pre-base save); it is its own base.
      if (local && local.version != null && !base) base = local;
      if (local) {
        latest = local;
        if (config.remote) {
          try {
            const row = upgrade(await config.remote.pull());
            if (row && this.isNews(row)) {
              // A device that has been away holds an older row, or holds taps
              // made over one. Adopt or merge; never return the stale copy to
              // be republished over everyone else's work.
              const state = reconcile(row, local.state, Date.now());
              return { state, source: state === row.state ? ("remote" as const) : ("merged" as const) };
            }
            if (dirty()) {
              setStatus("pending");
              void pushLatest();
            }
          } catch {
            // Offline: the local copy is the best available, exactly as before,
            // but the store must say so. A phone that opens the night with the
            // row unreachable is keeping the night to itself, and a green line
            // claiming it is shared would send a second phone to a blank screen.
            setStatus("error");
          }
        }
        return { state: local.state, source: "local" as const };
      }
      if (config.remote) {
        try {
          const row = upgrade(await config.remote.pull());
          if (row) {
            // Mirroring to local is best-effort: if storage is blocked (private
            // mode / quota) we must still RETURN the healthy remote session.
            takeRow(row);
            return { state: row.state, source: "remote" as const };
          }
        } catch {
          // Wifi down on load and nothing local: defaults are unavoidable, but
          // the store must not look healthy. A green pill over an empty session
          // is what convinces someone it is safe to start entering names, and
          // the first save would push that emptiness over the shared row.
          setStatus("error");
        }
      }
      return { state: config.defaults(), source: "defaults" as const };
    },

    async flush() {
      if (dirty()) {
        // A row handed out and never reconciled must not hold the phone
        // hostage: the retry is refused again at worst, and reconciled then.
        awaitingRow = false;
        staleStreak = 0;
        await pushLatest();
      }
    },

    latestSavedAt: () => latest?.savedAt ?? null,
    knownVersion: () => versionOf(base),
    isDirty: dirty,
    isPushing: () => pushing,

    isNews(row) {
      if (!base) return true;
      // A row without a version came from a function older than this build:
      // the clock is all there is. With versions, only a row PAST the base is
      // news; a pull that lands after this phone's own push was accepted can
      // carry the row from before it, and that is not news, it is history.
      if (row.version == null) return row.savedAt > base.savedAt;
      return row.version > (base.version ?? 0);
    },

    adopt(envelope) {
      const upgraded = upgrade(envelope);
      if (!upgraded) return;
      takeRow(upgraded);
      setStatus("synced");
    },

    reconcile,

    syncStatus: () => status,

    clearLocal() {
      config.storage.removeItem(config.storageKey);
      config.storage.removeItem(baseKey);
      latest = null;
      base = null;
      setStatus("synced");
    },
  };
}

/** In-memory storage for tests and non-browser environments. */
export function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
