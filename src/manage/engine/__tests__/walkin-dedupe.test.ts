// A double tap must not mint the same person twice.
//
// Found on the live site: after a walk-in add, the search box kept the query,
// the empty-search branch drew "Add C10 as a walk-in" AGAIN, and the second
// tap created a second C10. Two ids for one human splits their night in two:
// half their games on each, and a standings table that adds up to nothing.
// The roster dedupe could not catch it, because it checks the catalogue and a
// walk-in is by definition not in the catalogue. The guard lives in the
// writer, where no caller can route around it.

import { describe, expect, it } from "vitest";
import type { Session } from "../../types";
import { addWalkInSession } from "../../useSession";

const base = (): Session => ({
  id: "night-x", dayLabel: "Wednesday", date: "2026-08-20", status: "setup",
  players: [], courts: [], matches: [], startedAt: null, endedAt: null,
});

describe("adding a walk-in is idempotent by name", () => {
  it("a second add of the same name returns the SAME id and adds nobody", () => {
    const first = addWalkInSession(base(), "C10", 1000);
    const second = addWalkInSession(first.session, "C10", 2000);
    expect(second.id).toBe(first.id);
    expect(second.session.players).toHaveLength(1);
  });

  it("matches case-insensitively and ignores padding, like the roster dedupe", () => {
    const first = addWalkInSession(base(), "C10", 1000);
    const second = addWalkInSession(first.session, "  c10 ", 2000);
    expect(second.id).toBe(first.id);
    expect(second.session.players).toHaveLength(1);
  });

  it("a genuinely different name still adds", () => {
    const first = addWalkInSession(base(), "C10", 1000);
    const second = addWalkInSession(first.session, "C11", 2000);
    expect(second.id).not.toBe(first.id);
    expect(second.session.players).toHaveLength(2);
  });
});
