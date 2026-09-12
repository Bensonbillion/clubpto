import { vi } from "vitest";

// A localStorage the node environment does not have.
//
// src/clubhouse/supabaseClient.ts reads `localStorage` at module scope, so
// every test that reaches it through useSession -> sync/remote crashed at
// IMPORT under `environment: "node"`, taking five suites down before a
// single assertion ran. Stubbed here rather than in the client, because the
// client is right to expect a browser and the tests are the ones running
// without one.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(i: number) { return [...this.store.keys()][i] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}
if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(), configurable: true, writable: true,
  });
}

// Mock the Supabase client so tests don't need localStorage or network
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }), order: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      upsert: () => Promise.resolve({ data: null, error: null }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => {} }),
    removeChannel: () => {},
  },
}));
