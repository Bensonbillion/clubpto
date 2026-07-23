// Court Manager v2 — localStorage-first persistence (§12).
//
// The venue's wifi is the least reliable component in the stack. During a live
// session THE TABLET IS THE SOURCE OF TRUTH:
//   1. Every state change writes to local storage synchronously, first.
//   2. Remote (Supabase) syncs in the background; a pending indicator tells the
//      admin when the last write hasn't reached the server yet.
//   3. Load order: active local session → remote → defaults, last resort.
//
// Storage and remote are injected interfaces so this layer tests headlessly
// and the Supabase adapter stays a thin, separate concern. The storage key is
// NEW — it never touches the legacy game_state rows used by live /manage.

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Envelope<T> {
  schemaVersion: number;
  savedAt: number; // epoch ms
  state: T;
}

export interface RemoteSync<T> {
  push(envelope: Envelope<T>): Promise<void>;
  pull(): Promise<Envelope<T> | null>;
}

export type SyncStatus = "synced" | "pending" | "error";

export interface SessionStore<T> {
  /** Synchronous local write FIRST, then a background remote push. */
  save(state: T, nowMs: number): void;
  /** local → remote → defaults. Never throws; wifi failures degrade gracefully. */
  load(): Promise<{ state: T; source: "local" | "remote" | "defaults" }>;
  /** Retry the remote push of the latest local state (call on a timer/reconnect). */
  flush(): Promise<void>;
  syncStatus(): SyncStatus;
  /** Clear the local session (end-of-night reset). Remote copy untouched. */
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
   * when the old shape is truly unusable — silent data loss on version bumps
   * is exactly the "vanished roster" bug class (§13: completed data is sacred).
   */
  migrate?: (oldState: unknown, oldVersion: number) => T | null;
  onSyncStatusChange?: (status: SyncStatus) => void;
}

export function createSessionStore<T>(config: SessionStoreConfig<T>): SessionStore<T> {
  let status: SyncStatus = "synced";
  let pushing = false;
  let latest: Envelope<T> | null = null;

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
    return { schemaVersion: config.schemaVersion, savedAt: env.savedAt, state: migrated };
  };

  const readLocal = (): Envelope<T> | null => {
    try {
      const raw = config.storage.getItem(config.storageKey);
      if (!raw) return null;
      return upgrade(JSON.parse(raw) as Envelope<T>);
    } catch {
      return null;
    }
  };

  const pushLatest = async (): Promise<void> => {
    if (!config.remote || !latest || pushing) return;
    pushing = true;
    const pushed = latest;
    try {
      await config.remote.push(pushed);
      // Only mark synced if nothing newer arrived while we were pushing.
      if (latest === pushed) setStatus("synced");
    } catch {
      setStatus("error");
    } finally {
      pushing = false;
      // A newer write landed mid-push — chase it.
      if (latest !== pushed && latest) void pushLatest();
    }
  };

  return {
    save(state, nowMs) {
      const envelope: Envelope<T> = { schemaVersion: config.schemaVersion, savedAt: nowMs, state };
      // Keep the in-memory copy FIRST so the remote mirror still has it even if
      // the local write fails.
      latest = envelope;
      try {
        // The write that matters can never be lost to a network blip.
        config.storage.setItem(config.storageKey, JSON.stringify(envelope));
      } catch {
        // Storage blocked (Safari Private Browsing, quota, disabled). This runs
        // inside a React setState updater — if it threw, the render phase would
        // blow up and white-screen the live board. Swallow it: flag the error,
        // fall back to the in-memory + remote copies, never crash.
        setStatus("error");
        if (config.remote) void pushLatest();
        return;
      }
      // Local-only mode (no remote configured): the local write IS the sync.
      setStatus(config.remote ? "pending" : "synced");
      if (config.remote) void pushLatest();
    },

    async load() {
      const local = readLocal();
      if (local) {
        latest = local;
        return { state: local.state, source: "local" as const };
      }
      if (config.remote) {
        try {
          const remote = upgrade(await config.remote.pull());
          if (remote) {
            config.storage.setItem(config.storageKey, JSON.stringify(remote));
            latest = remote;
            return { state: remote.state, source: "remote" as const };
          }
        } catch {
          // Wifi down on load — defaults, and the admin sees it immediately.
        }
      }
      return { state: config.defaults(), source: "defaults" as const };
    },

    async flush() {
      if (status !== "synced") await pushLatest();
    },

    syncStatus: () => status,

    clearLocal() {
      config.storage.removeItem(config.storageKey);
      latest = null;
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
