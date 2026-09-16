import { afterEach, vi } from "vitest";

// The DOM half of the setup, and it only runs for the suites that asked for a
// DOM.
//
// `environment` stays "node" for the whole project (vitest.config.ts), because
// the engine is pure and six hundred of these tests are arithmetic that has no
// use for a document and should not pay to build one. A suite that needs to
// render opts in with a docblock on its first line:
//
//   // @vitest-environment jsdom
//
// setupFiles runs for EVERY suite either way, so the DOM wiring is guarded on
// the document actually existing rather than imported at the top. Importing
// @testing-library/jest-dom unguarded would load a DOM library into six
// hundred node suites to register matchers none of them call.
//
// Why a DOM at all, added 2026-09-16: the engine was testable and the screens
// were not, so five fixes in a row shipped with the same caveat, that the rule
// was proven and the wiring that calls it was only read. ScoreEntry.tsx
// declared `unNudge` with a comment describing what it was for and no caller
// anywhere, and nothing in six hundred tests could have noticed.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  // React Testing Library mounts into a container it appends to the body. Left
  // alone, every test in a file renders on top of the last one's markup and
  // `getByRole` starts finding two of everything.
  afterEach(cleanup);
}

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
