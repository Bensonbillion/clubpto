// The who-step search, after a live Wednesday found its blind spots.
//
// The operator's report, in order: people from last week arrived pre-ticked,
// searching one of them showed nothing, and the only button on screen was
// "Add as a walk-in", which silently did nothing because the add is
// idempotent. Three symptoms, one cause: a name already in the night was
// filtered OUT of the results instead of being shown as already in.

import { describe, expect, it } from "vitest";
import type { RosterRow } from "../screens/setup/WhoIsHere";
import { rosterMatches } from "../screens/setup/WhoIsHere";

const row = (displayName: string, ticked: boolean): RosterRow => ({
  playerId: displayName.toLowerCase().replace(/\s+/g, "-"),
  displayName,
  ticked,
  onBookingList: true,
});

describe("searching a name that is already in tonight", () => {
  const rows = [row("Benson Hills", true), row("Bandele Ojo", false), row("Tumi Ade", false)];

  it("still shows the name, marked as in, instead of an empty result", () => {
    const got = rosterMatches(rows, "benson");
    expect(got.map((r) => r.displayName)).toEqual(["Benson Hills"]);
    expect(got[0].ticked).toBe(true);
  });

  it("never offers the walk-in button for somebody who is in", () => {
    // The offer renders only when NOTHING matches. A ticked match counts as a
    // match, so the screen can no longer claim "no one called Benson" while
    // Benson is standing in the list below.
    expect(rosterMatches(rows, "benson").length).toBeGreaterThan(0);
  });

  it("a genuinely unknown name still matches nothing, which is the walk-in case", () => {
    expect(rosterMatches(rows, "zed")).toEqual([]);
  });

  it("an empty query draws no results panel", () => {
    expect(rosterMatches(rows, "")).toEqual([]);
    expect(rosterMatches(rows, "   ")).toEqual([]);
  });
});
