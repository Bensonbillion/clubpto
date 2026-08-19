import { describe, expect, it } from "vitest";
import { clubDate, defaultVenueFor, knownVenues, weekdayOf } from "./clubDate";

// The old expression, kept here as the thing being replaced. Every test below
// that names it is a test that fails against the code as it shipped.
const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const at = (iso: string) => new Date(iso).getTime();

describe("what day a night belongs to (C6)", () => {
  // Wednesday 13 August 2026, 8:30pm in Toronto. EDT is UTC-4, so this is
  // 00:30 on Thursday the 14th in UTC. Every session that ran past 8pm was
  // being stamped with tomorrow's date.
  it("a Wednesday evening is still Wednesday", () => {
    const ms = at("2026-08-14T00:30:00Z");
    expect(clubDate(ms)).toBe("2026-08-13");
    expect(utcDate(ms)).toBe("2026-08-14"); // what it used to say
  });

  it("a Sunday night that runs late is still Sunday", () => {
    const ms = at("2026-08-17T01:45:00Z"); // 9:45pm Sunday the 16th, EDT
    expect(clubDate(ms)).toBe("2026-08-16");
    expect(utcDate(ms)).toBe("2026-08-17");
  });

  // Winter is worse, not better: EST is UTC-5, so the window opens at 7pm.
  it("holds through the winter offset", () => {
    const ms = at("2026-01-15T02:30:00Z"); // 9:30pm Wednesday the 14th, EST
    expect(clubDate(ms)).toBe("2026-01-14");
    expect(utcDate(ms)).toBe("2026-01-15");
  });

  it("is unchanged in the afternoon, when the two agree", () => {
    const ms = at("2026-08-13T18:00:00Z"); // 2pm Thursday, EDT
    expect(clubDate(ms)).toBe("2026-08-13");
    expect(utcDate(ms)).toBe("2026-08-13");
  });

  // The night the clocks go forward: 2am becomes 3am on 8 March 2026.
  it("survives the spring-forward night", () => {
    expect(clubDate(at("2026-03-08T06:30:00Z"))).toBe("2026-03-08"); // 1:30am EST
    expect(clubDate(at("2026-03-08T07:30:00Z"))).toBe("2026-03-08"); // 3:30am EDT
    expect(clubDate(at("2026-03-08T04:59:00Z"))).toBe("2026-03-07"); // 11:59pm the night before
  });

  // And the night they go back: 2am becomes 1am on 1 November 2026, so
  // 05:30Z happens twice in Toronto, once as EDT and once as EST.
  it("survives the fall-back night", () => {
    expect(clubDate(at("2026-11-01T05:30:00Z"))).toBe("2026-11-01"); // 1:30am EDT
    expect(clubDate(at("2026-11-01T06:30:00Z"))).toBe("2026-11-01"); // 1:30am EST, the repeat
    expect(clubDate(at("2026-11-01T03:59:00Z"))).toBe("2026-10-31");
  });

  it("pads single-digit months and days", () => {
    expect(clubDate(at("2026-01-05T17:00:00Z"))).toBe("2026-01-05");
  });
});

describe("the weekday of a calendar date", () => {
  // new Date("2026-08-12") is UTC midnight, which is the evening of the 11th
  // in Toronto — so asking that Date for its local weekday is off by one for
  // anyone west of Greenwich.
  it("reads a date string as a date, not as an instant", () => {
    expect(weekdayOf("2026-08-12")).toBe(3); // Wednesday
    expect(weekdayOf("2026-08-16")).toBe(0); // Sunday
    expect(new Date("2026-08-12").getUTCDay()).toBe(3); // agrees, by construction
  });
});

describe("where the club plays", () => {
  it("suggests the right venue for each of the two nights", () => {
    expect(defaultVenueFor("2026-08-12")).toBe("The District Padel"); // Wednesday
    expect(defaultVenueFor("2026-08-16")).toBe("North Padel"); // Sunday
  });

  // A night moved for a holiday, or a one-off. The confirm has to ask.
  it("suggests nothing for any other day", () => {
    for (const iso of ["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-17", "2026-08-18"]) {
      expect(defaultVenueFor(iso)).toBeNull();
    }
  });

  it("offers both venues for the override", () => {
    expect(knownVenues()).toEqual(["The District Padel", "North Padel"]);
  });
});
