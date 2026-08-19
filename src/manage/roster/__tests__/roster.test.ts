// The roster layer's promises, asserted one at a time.
//
// Every test here names the live-night failure it exists to prevent. If one
// goes red, read that sentence first: it says what a manager would have seen
// on a Wednesday, which is faster than reading the assertion.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUNDLED_ROSTER, type RosterName } from "../names";
import { dedupeWalkIn, mergeRoster } from "../merge";

// The mock has to exist before the module factory runs, and vi.mock is
// hoisted above the imports, so the handle it reads from is hoisted too.
// `query` is what the fake `.eq()` resolves to; `thrown` makes it throw
// instead, which is the DNS-failure and dropped-wifi case.
const supa = vi.hoisted(() => ({
  query: { data: [] as unknown[] | null, error: null as unknown },
  thrown: null as Error | null,
  /** When true the query never settles, which is the real hang, not an error. */
  hang: false,
}));

vi.mock("@/clubhouse/supabaseClient", () => ({
  clubhouse: {
    from: () => ({
      select: () => ({
        eq: () => {
          if (supa.thrown) throw supa.thrown;
          if (supa.hang) return new Promise(() => {});
          return Promise.resolve(supa.query);
        },
      }),
    }),
  },
}));

// Imported after the mock is registered, so source.ts never touches the real
// client (which would want localStorage, and there is none in a node run).
const { loadRoster } = await import("../source");

const n = (playerId: string, displayName: string): RosterName => ({ playerId, displayName });

describe("mergeRoster keeps the night's list whole", () => {
  // Prevents: someone fixes a misspelled name in the database and the manager
  // still reads the old spelling off the phone all night.
  it("a remote spelling wins over the bundled one", () => {
    const bundled = [n("p-1", "Deborah"), n("p-2", "Ade")];
    const merged = mergeRoster(bundled, [n("p-1", "Debora")]);

    expect(merged.find((x) => x.playerId === "p-1")?.displayName).toBe("Debora");
    expect(merged).toHaveLength(2);
  });

  // Prevents: a member who joined after the last deploy cannot be checked in
  // without being retyped as a walk-in, splitting their history in two.
  it("a remote-only id is added", () => {
    const merged = mergeRoster([n("p-1", "Ade")], [n("p-9", "Zara")]);

    expect(merged.map((x) => x.playerId)).toEqual(["p-1", "p-9"]);
  });

  // Prevents: THE expensive one. A filtered or partial remote read shrinks the
  // picker, and a real person standing on the court cannot be added.
  it("bundled entries survive a remote list that is much shorter", () => {
    const bundled = [n("p-1", "Ade"), n("p-2", "Benson"), n("p-3", "Carlos")];
    const merged = mergeRoster(bundled, [n("p-2", "Benson")]);

    expect(merged.map((x) => x.playerId)).toEqual(["p-1", "p-2", "p-3"]);
  });

  // Prevents: names reshuffling under the manager's thumb the moment a remote
  // read lands, so the row they were reaching for is no longer where it was.
  it("the result is alphabetical by display name, and ties are still total", () => {
    const merged = mergeRoster(
      [n("p-c", "Carlos"), n("p-a", "Ade")],
      [n("p-b", "Benson"), n("p-b2", "Benson")],
    );

    expect(merged.map((x) => x.displayName)).toEqual(["Ade", "Benson", "Benson", "Carlos"]);
    // Equal names fall back to playerId, so the order is decided rather than
    // left to the sort implementation.
    expect(merged.map((x) => x.playerId)).toEqual(["p-a", "p-b", "p-b2", "p-c"]);
  });

  // Prevents: an empty read quietly rewriting a list it knows nothing about.
  it("an empty remote list returns the bundle unchanged", () => {
    const bundled = [n("p-1", "Ade"), n("p-2", "Benson")];

    expect(mergeRoster(bundled, [])).toEqual(bundled);
  });
});

describe("dedupeWalkIn matches a whole name and nothing less", () => {
  const roster = [n("p-timi", "Timi"), n("p-timi-olaoye", "Timi Olaoye"), n("p-ade", "Ade")];

  // Prevents: a second copy of an existing member, whose games land on a
  // different id and whose standings add up to nothing.
  it("finds an exact match", () => {
    expect(dedupeWalkIn(roster, "Ade")?.playerId).toBe("p-ade");
  });

  it("finds a match regardless of case", () => {
    expect(dedupeWalkIn(roster, "ade")?.playerId).toBe("p-ade");
    expect(dedupeWalkIn(roster, "ADE")?.playerId).toBe("p-ade");
  });

  // Prevents: a trailing space from a phone keyboard creating a duplicate that
  // looks identical on screen.
  it("finds a match through padding whitespace", () => {
    expect(dedupeWalkIn(roster, "  Ade  ")?.playerId).toBe("p-ade");
  });

  it("returns null for a genuinely new name", () => {
    expect(dedupeWalkIn(roster, "Somebody New")).toBeNull();
  });

  it("returns null for an empty or whitespace-only box", () => {
    expect(dedupeWalkIn(roster, "")).toBeNull();
    expect(dedupeWalkIn(roster, "   ")).toBeNull();
  });

  // Prevents: the wrong human in the match. Timi and Timi Olaoye played the
  // same night and are two people. A substring match would collapse them.
  it("does NOT match a partial name", () => {
    expect(dedupeWalkIn([n("p-timi-olaoye", "Timi Olaoye")], "Timi")).toBeNull();
    expect(dedupeWalkIn([n("p-temitope", "Temitope")], "Temi")).toBeNull();
    // And the other direction: a longer typed name must not latch onto a
    // shorter roster entry either.
    expect(dedupeWalkIn([n("p-timi", "Timi")], "Timi Olaoye")).toBeNull();
  });
});

describe("loadRoster always hands back a usable list", () => {
  beforeEach(() => {
    supa.query = { data: [], error: null };
    supa.thrown = null;
    supa.hang = false;
  });

  // Prevents: THE most confusing behaviour in this layer. An anon read of
  // clubhouse_roster returns HTTP 200 with [] because RLS grants SELECT to
  // authenticated only, and the manager's door is a passcode. Believing that
  // empty array opens the wizard to an empty picker on a night with twenty
  // people waiting.
  it("treats zero rows as unreadable, not as an empty club", async () => {
    supa.query = { data: [], error: null };
    const result = await loadRoster();

    expect(result.origin).toBe("bundled");
    expect(result.error).not.toBeNull();
    expect(result.names).toHaveLength(BUNDLED_ROSTER.length);
  });

  it("treats a null data payload the same way", async () => {
    supa.query = { data: null, error: null };
    const result = await loadRoster();

    expect(result.origin).toBe("bundled");
    expect(result.names.length).toBeGreaterThan(0);
  });

  // Prevents: an unhandled rejection inside a React effect, which leaves the
  // picker on a spinner with no way out.
  it("survives a client that throws", async () => {
    supa.thrown = new Error("fetch failed");
    const result = await loadRoster();

    expect(result.origin).toBe("bundled");
    expect(result.error).not.toBeNull();
    expect(result.names).toHaveLength(BUNDLED_ROSTER.length);
  });

  it("survives a query that reports an error", async () => {
    supa.query = { data: null, error: { message: "permission denied for table clubhouse_roster" } };
    const result = await loadRoster();

    expect(result.origin).toBe("bundled");
    expect(result.error).not.toBeNull();
  });

  // The error sentence is shown to an operator mid-night, so it stays a
  // sentence. A stack trace or a raw PostgREST code tells them nothing they
  // can act on.
  it("reports failures as a short sentence, not a stack trace", async () => {
    supa.thrown = new Error("fetch failed");
    const { error } = await loadRoster();

    expect(error).toBeTruthy();
    expect(error!.length).toBeLessThan(140);
    expect(error).not.toContain("Error:");
    expect(error).not.toContain("\n");
  });

  // Prevents: a successful read being labelled as bundled, so the UI keeps
  // nagging that the club list is unreachable when it is not.
  it("reports origin club and merges when rows come back", async () => {
    supa.query = {
      data: [
        { player_id: "p-ade", display_name: "Ade Corrected" },
        { player_id: "p-brand-new", display_name: "Brand New" },
      ],
      error: null,
    };
    const result = await loadRoster();

    expect(result.origin).toBe("club");
    expect(result.error).toBeNull();
    expect(result.names.find((x) => x.playerId === "p-ade")?.displayName).toBe("Ade Corrected");
    expect(result.names.find((x) => x.playerId === "p-brand-new")).toBeDefined();
    // Two rows came back and nobody bundled was dropped.
    expect(result.names).toHaveLength(BUNDLED_ROSTER.length + 1);
  });

  // Prevents: a blank, untappable row in the picker at 8pm.
  it("skips rows with a missing or blank display name", async () => {
    supa.query = {
      data: [
        { player_id: "p-blank", display_name: "   " },
        { player_id: "p-null", display_name: null },
        { player_id: "p-good", display_name: "Good Name" },
      ],
      error: null,
    };
    const result = await loadRoster();

    expect(result.origin).toBe("club");
    expect(result.names.some((x) => x.displayName.trim() === "")).toBe(false);
    expect(result.names).toHaveLength(BUNDLED_ROSTER.length + 1);
  });

  it("falls back when every returned row was unusable", async () => {
    supa.query = { data: [{ player_id: "p-blank", display_name: "" }], error: null };
    const result = await loadRoster();

    expect(result.origin).toBe("bundled");
    expect(result.names).toHaveLength(BUNDLED_ROSTER.length);
  });

  // The single promise this layer makes, checked across every branch at once.
  it("never returns an empty list, in any branch", async () => {
    const branches: Array<() => void> = [
      () => { supa.query = { data: [], error: null }; },
      () => { supa.query = { data: null, error: null }; },
      () => { supa.query = { data: null, error: { message: "nope" } }; },
      () => { supa.thrown = new Error("offline"); },
      () => { supa.query = { data: [{ player_id: "p-ade", display_name: "Ade" }], error: null }; },
    ];

    for (const setUp of branches) {
      supa.query = { data: [], error: null };
      supa.thrown = null;
      setUp();
      const result = await loadRoster();
      expect(result.names.length).toBeGreaterThanOrEqual(BUNDLED_ROSTER.length);
    }
  });
});

describe("BUNDLED_ROSTER is the curated 66", () => {
  // Prevents: a regenerated names.ts that silently parsed half the seed file,
  // which would look fine until the missing half showed up to play.
  it("holds exactly 66 people", () => {
    expect(BUNDLED_ROSTER).toHaveLength(66);
  });

  // Prevents: two rows for one person, which is the same broken standings the
  // walk-in dedupe exists to avoid, only baked into the build.
  it("has no duplicate playerIds", () => {
    const ids = BUNDLED_ROSTER.map((x) => x.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no blank names or ids", () => {
    for (const entry of BUNDLED_ROSTER) {
      expect(entry.playerId.trim()).not.toBe("");
      expect(entry.displayName.trim()).not.toBe("");
    }
  });

  // Prevents: the generated file drifting out of sort order, which would make
  // the list jump the first time a remote read merged and re-sorted it.
  it("already arrives sorted the way merge sorts", () => {
    const resorted = mergeRoster(BUNDLED_ROSTER, []);
    expect(resorted).toEqual([...BUNDLED_ROSTER]);
  });
});


describe("a club list that never answers", () => {
  // The failure this covers is not an error, it is silence. supabase-js sets no
  // fetch timeout, and the client refreshes its auth token behind a lock shared
  // with every other tab on this origin, so a request can wait on that lock and
  // never open a socket. Before the deadline, loadRoster simply never settled:
  // the hook stayed on loading with error null, which reads as "all is well"
  // while a member added since the last deploy is quietly missing from the
  // picker and gets typed in as a walk-in.
  beforeEach(() => {
    supa.query = { data: [], error: null };
    supa.thrown = null;
    supa.hang = false;
    vi.useRealTimers();
  });

  it("gives up and hands back the bundled names", async () => {
    supa.hang = true;
    const result = await Promise.race([
      loadRoster(),
      new Promise<"never">((r) => setTimeout(() => r("never"), 9000)),
    ]);
    expect(result).not.toBe("never");
    const load = result as Awaited<ReturnType<typeof loadRoster>>;
    expect(load.origin).toBe("bundled");
    expect(load.names).toHaveLength(BUNDLED_ROSTER.length);
    // Silence must not be reported as health. An operator reading this state
    // needs to know the refresh did not happen.
    expect(load.error).not.toBeNull();
  }, 12000);
});
