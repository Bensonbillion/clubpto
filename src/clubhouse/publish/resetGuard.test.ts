import { describe, expect, it } from "vitest";
import { resetDecision, type ResetGuardInput } from "./resetGuard";

const g = (over: Partial<ResetGuardInput> = {}): ResetGuardInput => ({
  publishId: "night-2026-08-12-1755040000000",
  publishedId: null,
  hasContent: true,
  peopleCount: 16,
  ...over,
});

describe("Reset, standing next to Publish", () => {
  // The whole point: Reset nulls the start instant the publish id is derived
  // from, so pressing it first does not just lose the data, it loses the
  // ability to file the night at all.
  it("holds an unpublished night", () => {
    const d = resetDecision(g());
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("has not been published yet");
  });

  it("lets a published night go", () => {
    const d = resetDecision(g({ publishedId: "night-2026-08-12-1755040000000" }));
    expect(d.allowed).toBe(true);
    expect(d.reason).toBeNull();
  });

  // A stale flag from an earlier night must not open the door on this one.
  it("does not accept a different night's publish as this night's", () => {
    const d = resetDecision(g({ publishedId: "night-2026-08-05-1754400000000" }));
    expect(d.allowed).toBe(false);
  });

  it("never gets in the way of an empty screen", () => {
    expect(resetDecision(g({ hasContent: false })).allowed).toBe(true);
    expect(resetDecision(g({ hasContent: false, publishId: null })).allowed).toBe(true);
  });
});

// A hard block on the wrong night is its own trap. Every held case has a way
// through, and the way through says what it costs first.
describe("the door out", () => {
  it("always offers an override when it holds", () => {
    for (const input of [g(), g({ publishId: null })]) {
      const d = resetDecision(input);
      expect(d.allowed).toBe(false);
      expect(d.overrideLabel).toBeTruthy();
      expect(d.consequence).toBeTruthy();
    }
  });

  it("names the cost in people, not in rows", () => {
    const d = resetDecision(g({ peopleCount: 16 }));
    expect(d.consequence).toContain("16 people");
    expect(d.consequence).toContain("will not appear in the clubhouse");
    // And it does not overclaim: the archive still has the night.
    expect(d.consequence).toContain("archived");
  });

  it("says person, not people, for one", () => {
    expect(resetDecision(g({ peopleCount: 1 })).consequence).toContain("1 person");
  });

  it("still explains itself when nobody was counted", () => {
    const d = resetDecision(g({ peopleCount: 0 }));
    expect(d.consequence).toContain("archived");
    expect(d.consequence).not.toContain("0 people");
  });

  // A night with people that was never started cannot be published at all.
  // Telling the admin to publish first would be a loop with no exit.
  it("does not tell an unstartable night to publish first", () => {
    const d = resetDecision(g({ publishId: null }));
    expect(d.reason).toContain("never started");
    expect(d.reason).toContain("cannot be published");
    expect(d.overrideLabel).toBe("Discard this night");
  });
});
