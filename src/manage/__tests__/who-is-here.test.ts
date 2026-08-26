// The who-step search, after a live Wednesday found its blind spots.
//
// The operator's report, in order: people from last week arrived pre-ticked,
// searching one of them showed nothing, and the only button on screen was
// "Add as a walk-in", which silently did nothing because the add is
// idempotent. Three symptoms, one cause: a name already in the night was
// filtered OUT of the results instead of being shown as already in.

import { describe, expect, it } from "vitest";
import type { RosterRow } from "../screens/setup/WhoIsHere";
import { offersWalkIn, rosterMatches } from "../screens/setup/WhoIsHere";

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

describe("the walk-in offer is reachable for any name nobody carries exactly", () => {
  const rows = [row("Benson Hills", true), row("Benita Ojo", false)];

  it("a substring of somebody in still gets the offer", () => {
    // The dead end the review caught: Benson in, a second person called Ben
    // at the door, and the only matching row inert.
    expect(offersWalkIn([row("Benson Hills", true)], "Ben")).toBe(true);
  });

  it("a substring of an addable row gets the offer too, under that row's Add", () => {
    // The other half, caught on the live walk: Benita on the club list also
    // matched "Ben" and suppressed the offer, so Ben still could not be
    // added. Substring matches never count against the offer any more.
    expect(offersWalkIn(rows, "Ben")).toBe(true);
  });

  it("no offer when a row carries the exact typed name", () => {
    // An equal un-ticked row's own Add is the right path, and an equal
    // ticked row is already in. Case does not matter.
    expect(offersWalkIn(rows, "benita ojo")).toBe(false);
    expect(offersWalkIn(rows, "Benson Hills")).toBe(false);
  });

  it("no offer for an empty box, an offer for a name nobody carries", () => {
    expect(offersWalkIn(rows, "")).toBe(false);
    expect(offersWalkIn(rows, "zed")).toBe(true);
  });
});
